from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, TIMESTAMP, BigInteger, Boolean, Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class VideoProject(Base):
    __tablename__ = "video_project"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    sku_id: Mapped[int | None] = mapped_column(BigInteger)
    brand_id: Mapped[int | None] = mapped_column(BigInteger)
    project_id: Mapped[int | None] = mapped_column(BigInteger)

    timeline: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    target_duration_ms: Mapped[int | None] = mapped_column(Integer)
    resolution: Mapped[str] = mapped_column(String(16), default="1080x1920")
    fps: Mapped[int] = mapped_column(SmallInteger, default=30)
    platform: Mapped[str] = mapped_column(String(32), default="tiktok")

    bgm_asset_id: Mapped[int | None] = mapped_column(BigInteger)
    bgm_volume: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("0.3"))
    narration_asset_id: Mapped[int | None] = mapped_column(BigInteger)
    narration_script: Mapped[str | None] = mapped_column(Text)

    output_asset_id: Mapped[int | None] = mapped_column(BigInteger)
    render_status: Mapped[int] = mapped_column(SmallInteger, default=0)
    render_error: Mapped[str | None] = mapped_column(Text)
    render_progress: Mapped[int] = mapped_column(SmallInteger, default=0)

    status: Mapped[int] = mapped_column(SmallInteger, default=1)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)


class VideoClip(Base):
    __tablename__ = "video_clip"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    video_project_id: Mapped[int] = mapped_column(BigInteger, nullable=False)

    position: Mapped[int] = mapped_column(Integer, nullable=False)
    clip_type: Mapped[str] = mapped_column(String(32), nullable=False)

    asset_id: Mapped[int | None] = mapped_column(BigInteger)

    ai_prompt: Mapped[str | None] = mapped_column(Text)
    ai_model: Mapped[str | None] = mapped_column(String(64))
    ai_reference_asset_id: Mapped[int | None] = mapped_column(BigInteger)
    ai_status: Mapped[int] = mapped_column(SmallInteger, default=0)

    start_ms: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    trim_start_ms: Mapped[int] = mapped_column(Integer, default=0)

    volume: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("1.0"))
    speed: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("1.0"))
    filters: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    text_content: Mapped[str | None] = mapped_column(Text)
    text_style: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    extra: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
