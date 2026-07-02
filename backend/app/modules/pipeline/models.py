from datetime import datetime
from typing import Any

from sqlalchemy import JSON, TIMESTAMP, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PipelineRun(Base):
    __tablename__ = "pipeline_run"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_project_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("video_project.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    stage: Mapped[str | None] = mapped_column(String(80), nullable=True)
    product_name: Mapped[str] = mapped_column(Text, nullable=False)
    product_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False, default="tiktok")
    style: Mapped[str] = mapped_column(String(50), nullable=False, default="conversational")
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    clip_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_clips: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    script_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False)
