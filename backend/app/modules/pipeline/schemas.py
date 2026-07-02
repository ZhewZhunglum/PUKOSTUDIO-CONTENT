from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.platforms import is_supported_social_platform


class OneClickRequest(BaseModel):
    product_name: str = Field(min_length=1, max_length=200)
    product_description: str | None = Field(default=None, max_length=2000)
    platform: str = "tiktok"
    style: Literal["conversational", "dramatic", "educational", "humorous"] = "conversational"
    duration_seconds: int = Field(default=30, ge=10, le=300)
    clip_count: int = Field(default=5, ge=2, le=10)

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, value: str) -> str:
        if not is_supported_social_platform(value):
            raise ValueError("Unsupported platform")
        return value


class PipelineRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    video_project_id: int | None
    status: int
    stage: str | None
    product_name: str
    platform: str
    style: str
    duration_seconds: int
    clip_count: int
    completed_clips: int
    error_message: str | None
    script_json: dict[str, Any] | None
    created_at: datetime
