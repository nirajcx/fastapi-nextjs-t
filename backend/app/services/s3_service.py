"""
S3 Storage Service — MinIO / AWS S3 abstraction layer.

How it works:
─────────────
1. boto3 creates an S3 client pointing at our MinIO instance.
2. On application startup, `ensure_bucket_exists()` creates the bucket if absent.
3. `generate_presigned_upload_url()` asks MinIO to sign a one-time PUT URL.
   The URL is valid for `s3_presign_expiry` seconds (default 15 min).
   The browser uploads directly to MinIO — FastAPI never touches the file bytes.
4. `generate_presigned_download_url()` signs a temporary GET URL so browsers
   can preview images or download files without the bucket being public.
5. `delete_object()` is called when a todo with an attachment is deleted, so
   MinIO stays clean and we don't accumulate orphan blobs.

Docker / LAN hostname split & S3v4 Signatures:
──────────────────────────────────────────────
In AWS S3 Signature Version 4 (AWS4-HMAC-SHA256), the `Host` header is a canonical
signed header (X-Amz-SignedHeaders=...;host).
If a pre-signed URL is generated using http://minio:9000 and then the hostname is
rewritten to http://192.168.1.3:9000, MinIO will calculate the expected signature
using Host: 192.168.1.3:9000, causing a SignatureDoesNotMatch (HTTP 403 Forbidden).

To solve this cleanly:
  • `_build_internal_client()`: points to `s3_endpoint_url` (http://minio:9000).
    Used for backend network calls (head_bucket, create_bucket, delete_object).
  • `_build_presign_client()`: points directly to `s3_public_endpoint_url` (http://192.168.1.3:9000).
    Used for generating pre-signed URLs. Because generate_presigned_url is an offline
    cryptographic operation, it doesn't need network access from the container to
    the public IP, and the resulting signature is 100% valid for the browser's Host header!
"""

import re
import uuid

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings


def _build_internal_client():
    """
    Create a boto3 S3 client for backend container internal requests.
    Used for head_bucket, create_bucket, delete_object.
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
        region_name="us-east-1",
    )


def _build_presign_client():
    """
    Create a boto3 S3 client for generating pre-signed URLs.
    
    Must be configured with s3_public_endpoint_url so that boto3 signs
    the exact Host header the user's browser will send (e.g. 192.168.1.3:9000).
    This prevents HTTP 403 SignatureDoesNotMatch errors.
    """
    public_endpoint = settings.s3_public_endpoint_url or settings.s3_endpoint_url
    return boto3.client(
        "s3",
        endpoint_url=public_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
        region_name="us-east-1",
    )


def ensure_bucket_exists() -> None:
    """
    Called once at FastAPI startup.

    Creates the bucket if it doesn't already exist. Idempotent — safe to call
    on every restart. In production this is a no-op after the first deploy.
    """
    client = _build_internal_client()
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
    """
    ext = ""
    if "." in file_name:
        raw_ext = file_name.rsplit(".", 1)[-1]
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

    Signed directly with s3_public_endpoint_url so the Host header matches
    the browser's request exactly.

    Returns:
        {
            "upload_url": "http://192.168.1.3:9000/todo-attachments/...?X-Amz-...",
            "s3_key":     "users/<uid>/todos/<uuid>.png"
        }
    """
    client = _build_presign_client()
    s3_key = build_s3_key(user_id, file_name)

    # Note: We deliberately do NOT put ContentType in Params.
    # When ContentType is in Params, boto3 adds 'content-type' to X-Amz-SignedHeaders,
    # which causes MinIO to reject the upload if the browser sends slightly different
    # headers or if the browser navigates with GET.
    # Leaving it to only sign 'host' allows the browser to send any Content-Type safely,
    # and MinIO will still preserve and store the Content-Type sent by the browser.
    upload_url = client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": settings.s3_bucket_name,
            "Key": s3_key,
        },
        ExpiresIn=settings.s3_presign_expiry,
    )

    return {
        "upload_url": upload_url,
        "s3_key": s3_key,
    }


def generate_presigned_download_url(s3_key: str) -> str:
    """
    Return a temporary signed GET URL so the browser can fetch a private object.
    """
    client = _build_presign_client()
    return client.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": settings.s3_bucket_name,
            "Key": s3_key,
        },
        ExpiresIn=settings.s3_presign_expiry,
    )


def delete_object(s3_key: str) -> None:
    """
    Permanently delete an object from MinIO.
    Uses internal client so it connects reliably over Docker network.
    """
    client = _build_internal_client()
    client.delete_object(Bucket=settings.s3_bucket_name, Key=s3_key)
