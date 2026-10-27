"""Application configuration.

All settings are read from environment variables (or a local .env file) so the
app behaves the same whether it runs under Docker Compose, in CI, or locally.
"""
from functools import lru_cache
from typing import Annotated, List

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- App ---
    APP_NAME: str = "Sales & Inventory Management System"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"

    # --- Database ---
    # Example: mysql+pymysql://user:password@host:3306/dbname
    DATABASE_URL: str = "mysql+pymysql://sims:sims@db:3306/sims"

    # --- Auth / JWT ---
    SECRET_KEY: str = "change-me-in-production-please-use-a-long-random-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours
    ALGORITHM: str = "HS256"

    # --- Business rules ---
    # Orders whose total is strictly greater than this require manager approval.
    APPROVAL_THRESHOLD: float = 500.0

    # --- CORS ---
    # NoDecode: keep pydantic-settings from JSON-parsing the env value; the
    # validator below splits a plain comma-separated string instead.
    CORS_ORIGINS: Annotated[List[str], NoDecode] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # --- Email ---
    # backend: "console" (log emails) or "smtp" (really send).
    EMAIL_BACKEND: str = "console"
    EMAIL_FROM: str = "no-reply@sims.io"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = False
    # Fallback manager inbox used if no manager users exist yet.
    MANAGER_FALLBACK_EMAIL: str = "manager@sims.io"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
