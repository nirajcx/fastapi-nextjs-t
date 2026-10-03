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