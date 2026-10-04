"""
S3 Storage Service — MinIO / AWS S3 abstraction layer.

How it works:
─────────────
1. boto3 creates an S3 client pointing at our MinIO instance (endpoint_url).
2. On application startup, `ensure_bucket_exists()` creates the bucket if absent.
3. `generate_presigned_upload_url()` asks MinIO to sign a one-time PUT URL.
   The URL is valid for `s3_presign_expiry` seconds (default 15 min).
   The browser uploads directly to MinIO — FastAPI never touches the file bytes.
4. `generate_presigned_download_url()` signs a temporary GET URL so browsers
   can preview images or download files without the bucket being public.
5. `delete_object()` is called when a todo with an attachment is deleted, so
   MinIO stays clean and we don't accumulate orphan blobs.

Docker / LAN hostname split:
─────────────────────────────
When a pre-signed URL is generated, boto3 embeds the endpoint hostname in the
URL. Inside Docker, the hostname is "minio" (Docker DNS). Outside Docker (the
user's browser), "minio" can't be resolved. So we use two settings:
  • s3_endpoint_url        → used to CREATE the boto3 client (backend-to-MinIO)
  • s3_public_endpoint_url → rewrite the host in every signed URL before
                             sending it back to the frontend

This means in production the signed URL the browser receives looks like:
    http://192.168.1.3:9000/todo-attachments/users/.../file.png?X-Amz-Signature=...
and in local dev both values are the same (192.168.1.3:9000), so no rewrite needed.
"""

import re
import uuid
from urllib.parse import urlparse, urlunparse

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings


def _build_client():
    """
    Create a boto3 S3 client pointed at MinIO.

    signature_version=s3v4  — MinIO requires Signature Version 4 (same as
                              modern AWS regions). V2 will be rejected.
    addressing_style=path   — Force path-style URLs:
                              http://host:9000/<bucket>/<key>
                              instead of virtual-hosted:
                              http://<bucket>.host:9000/<key>
                              MinIO doesn't support virtual-hosted style unless
                              you configure custom DNS, which we haven't.
    """
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
        region_name="us-east-1",   # MinIO ignores region but boto3 requires it
    )


def _rewrite_to_public(url: str) -> str:
    """
    Swap the internal endpoint host with the browser-accessible public host.

    Example:
        internal: http://minio:9000/todo-attachments/...
        public  : http://192.168.1.3:9000/todo-attachments/...

    If both settings are the same (local dev), the URL is returned unchanged.
    """
    if settings.s3_endpoint_url == settings.s3_public_endpoint_url:
        return url
    parsed = urlparse(url)
    public = urlparse(settings.s3_public_endpoint_url)
    rewritten = parsed._replace(scheme=public.scheme, netloc=public.netloc)
    return urlunparse(rewritten)


def ensure_bucket_exists() -> None:
    """
    Called once at FastAPI startup.

    Creates the bucket if it doesn't already exist. Idempotent — safe to call
    on every restart. In production this is a no-op after the first deploy.
    """
    client = _build_client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket_name)
    except ClientError as exc:
        error_code = int(exc.response["Error"]["Code"])
        if error_code == 404:
            client.create_bucket(Bucket=settings.s3_bucket_name)
        else:
            raise


def build_s3_key(user_id: str, file_name: str) -> str:
    """
    Generate a deterministic, unique, namespaced object key.

    Format: users/<user_id>/todos/<uuid>.<ext>

    Why namespace by user_id?
      • Easy to list / delete all files for a user.
      • Clear ownership at the storage layer.

    Why generate a new UUID instead of using the original filename?
      • Avoids collisions when the same user uploads "photo.jpg" twice.
      • Prevents path traversal attacks from malicious filenames.
      • Keeps the key URL-safe.
    """
    # Sanitise: keep only the extension (strip path components)
    ext = ""
    if "." in file_name:
        raw_ext = file_name.rsplit(".", 1)[-1]
        # Allow only alphanumeric extensions up to 10 chars
        if re.match(r"^[a-zA-Z0-9]{1,10}$", raw_ext):
            ext = f".{raw_ext.lower()}"
    return f"users/{user_id}/todos/{uuid.uuid4()}{ext}"


def generate_presigned_upload_url(
    user_id: str,
    file_name: str,
    content_type: str,
) -> dict:
    """
    Return a one-time pre-signed HTTP PUT URL for direct browser-to-MinIO upload.

    The frontend will:
      1. Call this endpoint → receive { upload_url, s3_key }
      2. PUT the raw file bytes directly to upload_url (Content-Type header required)
      3. Call POST /todos/create with { title, ..., s3_key, attachment_name, ... }

    FastAPI never sees the file bytes — zero bandwidth cost on the backend.

    Returns:
        {
            "upload_url": "http://192.168.1.3:9000/todo-attachments/...?X-Amz-...",
            "s3_key":     "users/<uid>/todos/<uuid>.png"
        }
    """
    client = _build_client()
    s3_key = build_s3_key(user_id, file_name)

    # generate_presigned_url with "put_object" creates a signed PUT URL.
    # The browser must send exactly the same Content-Type in its PUT request
    # header, otherwise MinIO will reject it (signature mismatch).
    raw_url = client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": settings.s3_bucket_name,
            "Key": s3_key,
            "ContentType": content_type,
        },
        ExpiresIn=settings.s3_presign_expiry,
    )

    return {
        "upload_url": _rewrite_to_public(raw_url),
        "s3_key": s3_key,
    }


def generate_presigned_download_url(s3_key: str) -> str:
    """
    Return a temporary signed GET URL so the browser can fetch a private object.

    This URL expires in s3_presign_expiry seconds (default 15 min).
    The frontend should call the todo GET endpoint each time it needs to
    display an attachment — never cache the URL permanently.

    Why not make the bucket public?
      • Private bucket + signed URLs = only authenticated todo owners see files.
      • Public bucket = anyone who guesses the key can download any attachment.
    """
    client = _build_client()
    raw_url = client.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": settings.s3_bucket_name,
            "Key": s3_key,
        },
        ExpiresIn=settings.s3_presign_expiry,
    )
    return _rewrite_to_public(raw_url)


def delete_object(s3_key: str) -> None:
    """
    Permanently delete an object from MinIO.

    Called automatically when a todo with an attachment is deleted.
    Idempotent — deleting a key that doesn't exist is a no-op in S3.
    """
    client = _build_client()
    client.delete_object(Bucket=settings.s3_bucket_name, Key=s3_key)
