from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    environment: str = "development"
    log_level: str = "DEBUG"
    secret_key: str = "change-me-in-production"
    admin_username: str = ""
    admin_password: str = ""
    auto_ai_tag_on_ingest: bool = False
    auto_embedding_on_ingest: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://cf:dev@localhost:5432/contentforge"
    # Echo every SQL statement to stdout — very noisy; opt in explicitly when debugging
    sql_echo: bool = False

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Storage (MinIO local / R2 prod)
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "contentforge-assets"
    s3_public_domain: str = "http://localhost:9000/contentforge-assets"
    s3_presigned_endpoint: str = ""

    # AI APIs
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    google_api_key: str = ""
    google_project_id: str = ""
    google_location: str = "us-central1"
    replicate_api_token: str = ""
    elevenlabs_api_key: str = ""
    heygen_api_key: str = ""
    assemblyai_api_key: str = ""
    together_api_key: str = ""

    # CORS — comma-separated list of allowed origins
    # e.g. "http://localhost:3847,http://1.2.3.4"
    allowed_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3847,http://127.0.0.1:3847"
    )

    # Online asset import (yt-dlp)
    ytdlp_cookies_file: str = ""
    ytdlp_proxy: str = ""
    ytdlp_user_agent: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
