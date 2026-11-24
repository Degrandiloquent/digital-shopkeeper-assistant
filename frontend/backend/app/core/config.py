from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_SECRETS = {"", "change-me", "replace_with_a_long_random_secret", "dev-only-change-me"}


class Settings(BaseSettings):
    """Runtime configuration. Every value comes from the environment (or a git-ignored .env file)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Digital Shopkeeper's Assistant API"
    app_env: str = "development"
    api_prefix: str = "/api/v1"
    docs_enabled: bool = True

    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    bcrypt_rounds: int = 12

    # Comma separated list of browser origins allowed to call the API (the deployed frontend URL).
    cors_origins: str = ""

    # Brute-force protection for the sign-in endpoint (per email + IP, in memory).
    login_max_attempts: int = 5
    login_window_seconds: int = 600

    # How long browsers may cache the public shop page, in seconds. Keep this small: the point of the page
    # is that customers see current information.
    public_cache_seconds: int = 5

    # Fictional demo data. Never put real customer or payment data in this database.
    seed_demo_data: bool = True
    seed_demo_history: bool = True
    seed_owner_email: str = "owner@alexcorner.demo"
    seed_owner_password: str = "Owner#Demo2027"
    seed_staff_email: str = "staff@alexcorner.demo"
    seed_staff_password: str = "Staff#Demo2027"

    @field_validator("database_url")
    @classmethod
    def normalise_database_url(cls, value: str) -> str:
        """Render hands out postgres:// or postgresql:// URLs; SQLAlchemy needs the psycopg driver named."""
        value = value.strip()
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    @model_validator(mode="after")
    def refuse_weak_secret_outside_development(self) -> "Settings":
        if self.app_env != "development" and (
            self.jwt_secret_key in INSECURE_SECRETS or len(self.jwt_secret_key) < 32
        ):
            raise ValueError(
                "JWT_SECRET_KEY must be a random value of at least 32 characters when APP_ENV is not "
                "'development'."
            )
        return self

    @property
    def sync_database_url(self) -> str:
        """The same database, for Alembic, which runs migrations through a synchronous engine."""
        return self.database_url.replace("+aiosqlite", "")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
