export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  // S3 attachment fields — all optional (null when no file attached)
  attachment_key?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;        // bytes
  attachment_content_type?: string | null;
  attachment_url?: string | null;         // pre-signed download/preview URL (15-min TTL)
}

export interface TodoCreateInput {
  title: string;
  description?: string;
  is_completed?: boolean;
  // Sent after browser uploads file directly to MinIO via pre-signed PUT URL
  attachment_key?: string;
  attachment_name?: string;
  attachment_size?: number;
  attachment_content_type?: string;
}

export interface TodoUpdateInput {
  title?: string;
  description?: string;
  is_completed?: boolean;
  attachment_key?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_content_type?: string | null;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
}

export interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  session_state?: string;
  scope?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// ─── S3 Pre-Signed Upload ──────────────────────────────────────────────────────

export interface PresignedUploadRequest {
  file_name: string;    // original filename used to derive extension
  content_type: string; // MIME type (must match PUT Content-Type header)
}

export interface PresignedUploadResponse {
  upload_url: string; // browser PUTs bytes here directly (bypasses FastAPI)
  s3_key: string;     // saved in TodoCreateInput.attachment_key
}
