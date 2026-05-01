"""
Core configuration module using pydantic-settings.
Handles environment variables and dynamic database URL construction.
"""

from typing import Final

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Uses pydantic-settings BaseSettings for validation and type safety.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application settings
    APP_NAME: str = "askUS API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database settings
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "app_db"

    # Async database URL for asyncpg
    @property
    def DATABASE_URL(self) -> str:
        """
        Dynamically build the async database URL.
        Format: postgresql+asyncpg://user:password@host:port/dbname
        """
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    # Sync database URL (for Alembic migrations)
    @property
    def DATABASE_URL_SYNC(self) -> str:
        """
        Synchronous database URL for Alembic.
        Format: postgresql://user:password@host:port/dbname
        """
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


# JWT Settings
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7


# Global settings instance
settings: Final[Settings] = Settings()
