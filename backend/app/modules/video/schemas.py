from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

ClipType = Literal["footage", "ai_video", "image", "text_overlay", "transition"]
RenderStatus = Literal[0, 1, 2, 3]  # draft | rendering | done | failed


class TextStyle(BaseModel):
    font: str = "NotoSansSC"
    size: int = 36
    color: str = "#FFFFFF"
    bg_color: str | None = "#00000088"
    position: str = "bottom"  # top | center | bottom
    align: str = "center"


class ClipFilters(BaseModel):
    brightness: float = 1.0
    contrast: float = 1.0
    saturation: float = 1.0
    blur: float = 0.0


class VideoClipCreate(BaseModel):
    position: int = Field(ge=0)
    clip_type: ClipType
    asset_id: int | None = None
    ai_prompt: str | None = None
    ai_model: str | None = None
    ai_reference_asset_id: int | None = None
    duration_ms: int | None = Field(default=None, ge=100)
    trim_start_ms: int = 0
    volume: Decimal = Decimal("1.0")
    speed: Decimal = Decimal("1.0")
    filters: dict[str, Any] | None = None
    text_content: str | None = None
    text_style: dict[str, Any] | None = None


class VideoClipUpdate(BaseModel):
    position: int | None = None
    asset_id: int | None = None
    ai_prompt: str | None = None
    duration_ms: int | None = None
    trim_start_ms: int | None = None
    volume: Decimal | None = None
    speed: Decimal | None = None
    filters: dict[str, Any] | None = None
    text_content: str | None = None
    text_style: dict[str, Any] | None = None


class VideoClipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    video_project_id: int
    position: int
    clip_type: str
    asset_id: int | None
    ai_prompt: str | None
    ai_model: str | None
    ai_reference_asset_id: int | None
    ai_status: int
    start_ms: int
    duration_ms: int | None
    trim_start_ms: int
    volume: Decimal
    speed: Decimal
    filters: dict[str, Any] | None
    text_content: str | None
    text_style: dict[str, Any] | None
    created_at: datetime


class VideoProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    description: str | None = None
    sku_id: int | None = None
    brand_id: int | None = None
    project_id: int | None = None
    target_duration_ms: int | None = None
    resolution: str = "1080x1920"
    fps: int = 30
    platform: str = "tiktok"
    narration_script: str | None = None


class VideoProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = None
    target_duration_ms: int | None = None
    resolution: str | None = None
    fps: int | None = None
    platform: str | None = None
    bgm_asset_id: int | None = None
    bgm_volume: Decimal | None = None
    narration_asset_id: int | None = None
    narration_script: str | None = None


class VideoProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    name: str
    description: str | None
    sku_id: int | None
    brand_id: int | None
    project_id: int | None
    target_duration_ms: int | None
    resolution: str
    fps: int
    platform: str
    bgm_asset_id: int | None
    bgm_volume: Decimal
    narration_asset_id: int | None
    narration_script: str | None
    output_asset_id: int | None
    render_status: int
    render_error: str | None
    render_progress: int
    status: int
    created_at: datetime
    updated_at: datetime
    clips: list[VideoClipOut] = []


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    voice_id: str = "nova"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    save_to_library: bool = True


class TtsResponse(BaseModel):
    asset_id: int | None
    duration_ms: int | None
    model_used: str
    cost_usd: float


class AsrRequest(BaseModel):
    asset_id: int
    language: str | None = None
    generate_srt: bool = True


class AsrResponse(BaseModel):
    text: str
    srt_content: str | None
    srt_asset_id: int | None
    segments: list[dict[str, Any]]
    model_used: str


class VideoGenRequest(BaseModel):
    video_project_id: int
    clip_id: int
    prompt: str = Field(min_length=1, max_length=2000)
    reference_asset_id: int | None = None
    duration_seconds: int = Field(default=5, ge=2, le=20)
    quality: str = "default"


class RenderRequest(BaseModel):
    video_project_id: int
    priority: int = Field(default=5, ge=1, le=10)
