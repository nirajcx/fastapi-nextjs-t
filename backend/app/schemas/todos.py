from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator


class TodoBase(BaseModel):
    title: str
    description: Optional[str] = None
    is_completed: bool = False

    model_config = ConfigDict(from_attributes=True)


class TodoCreate(TodoBase):
    # After the browser uploads the file directly to MinIO via the pre-signed
    # PUT URL, it sends back these fields so the backend can record the metadata.
    # All are optional — todos without attachments are still valid.
    attachment_key: Optional[str] = None           # S3 object path returned by /presign
    attachment_name: Optional[str] = None          # Original filename e.g. "receipt.pdf"
    attachment_size: Optional[int] = None          # Size in bytes
    attachment_content_type: Optional[str] = None  # MIME type e.g. "image/png"


class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_completed: Optional[bool] = None
    # Allow clearing attachment by sending null, or updating key if re-uploading
    attachment_key: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_size: Optional[int] = None
    attachment_content_type: Optional[str] = None


class TodoResponse(TodoBase):
    id: UUID
    user_id: UUID         # kis user ka todo hai
    created_at: datetime
    updated_at: datetime

    # Attachment metadata stored in DB
    attachment_key: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_size: Optional[int] = None
    attachment_content_type: Optional[str] = None

    # Computed signed URL — generated fresh on every response.
    # Frontend uses this directly to display image previews or download links.
    # It is NOT stored in the DB; it is a transient 15-min window.
    attachment_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Pre-Signed Upload Schemas ─────────────────────────────────────────────────

class PresignedUploadRequest(BaseModel):
    """
    What the frontend sends to request an upload slot.
    """
    file_name: str        # Original filename, used to derive the extension
    content_type: str     # MIME type; must match the Content-Type header in PUT


class PresignedUploadResponse(BaseModel):
    """
    What the backend returns — a one-time upload URL + the key to store in DB.
    """
    upload_url: str   # Browser does: fetch(upload_url, { method: 'PUT', body: file })
    s3_key: str       # Store this and pass it back in TodoCreate.attachment_key