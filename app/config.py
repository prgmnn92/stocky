"""Application configuration."""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # App
    app_env: str = "dev"
    tz: str = "Europe/Berlin"
    log_level: str = "INFO"
    log_format: str = "json"

    # Database
    database_url: str = "sqlite:///data/trader.db"

    # Market Data
    data_provider: str = "yahoo"
    alpha_vantage_key: str = ""

    # Scheduler
    sched_hour: int = 20
    sched_minute: int = 0
    sched_timezone: str = "Europe/Berlin"

    # Lookback for initial data fetch (days)
    lookback_days: int = 400

    # OpenAI
    openai_api_key: str = ""

    # Authentication
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 43200  # 30 days

    class Config:
        """Pydantic config."""

        env_file = ".env"
        case_sensitive = False


settings = Settings()
