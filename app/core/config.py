from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Todo API"
    environment: str = "local"
    database_url: SecretStr          # SecretStr → value .env se aati hai, logs mein nahi dikhti
    rate_limit_requests: int = 60          # default: 60 requests
    rate_limit_window_seconds: int = 60    # default: per 60 seconds
    secret_key: SecretStr            # session sign karne ke liye (future use)
    session_expire_hours: int = 168  # 7 days default

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()