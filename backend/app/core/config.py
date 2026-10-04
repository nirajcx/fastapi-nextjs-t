from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    app_name: str = "Todo API"
    environment: str = "local"
    database_url: SecretStr          # SecretStr: read from .env and masked in application logs
    rate_limit_requests: int = 60          # default: 60 requests
    rate_limit_window_seconds: int = 60    # default: per 60 seconds
    secret_key: SecretStr            # Secret key for session signature validation
    session_expire_hours: int = 168  # 7 days session expiration
    redis_url: str = "redis://localhost:6379/0"  # default local Redis instance

    # Keycloak Configuration
    keycloak_server_url: str = "http://192.168.1.3:8080"
    keycloak_realm: str = "todo-realm"
    keycloak_client_id: str = "todo-app"

    # ─── MinIO / S3 Configuration ──────────────────────────────────────────────
    # s3_endpoint_url     : URL the *backend container* uses to reach MinIO
    #                       (Docker internal DNS: http://minio:9000 in prod,
    #                        LAN address for local dev: http://192.168.1.3:9000)
    # s3_public_endpoint_url : URL that the *browser* will use when following
    #                          a pre-signed URL. In prod the browser resolves the
    #                          LAN IP, never the internal container hostname.
    s3_endpoint_url: str = "http://192.168.1.3:9000"
    s3_public_endpoint_url: str = "http://192.168.1.3:9000"
    s3_access_key: str = "admin"
    s3_secret_key: str = "admin123"
    s3_bucket_name: str = "todo-attachments"
    # Expiry (seconds) for pre-signed upload/download URLs (default: 15 minutes)
    s3_presign_expiry: int = 900

    @property
    def keycloak_issuer(self) -> str:
        return f"{self.keycloak_server_url.rstrip('/')}/realms/{self.keycloak_realm}"

    @property
    def keycloak_jwks_url(self) -> str:
        return f"{self.keycloak_issuer}/protocol/openid-connect/certs"

    model_config = SettingsConfigDict(
        env_file=[str(BASE_DIR / ".env"), ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()