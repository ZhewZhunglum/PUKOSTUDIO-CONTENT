from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    TIMESTAMP,
    BigInteger,
    Boolean,
    Date,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Asset(Base):
    __tablename__ = "asset"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    uuid: Mapped[str] = mapped_column(UUID(as_uuid=False), unique=True)

    name: Mapped[str] = mapped_column(Text, nullable=False)
    original_filename: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)

    asset_type: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    asset_subtype: Mapped[str | None] = mapped_column(String(64))
    mime_type: Mapped[str | None] = mapped_column(String(128))
    file_format: Mapped[str | None] = mapped_column(String(16))

    file_size: Mapped[int | None] = mapped_column(BigInteger)
    file_md5: Mapped[str | None] = mapped_column(String(32))
    file_phash: Mapped[str | None] = mapped_column(String(64))
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    storage_bucket: Mapped[str] = mapped_column(String(64), default="assets")
    thumbnail_key: Mapped[str | None] = mapped_column(Text)
    preview_key: Mapped[str | None] = mapped_column(Text)
    cdn_url: Mapped[str | None] = mapped_column(Text)
    backup_status: Mapped[int] = mapped_column(SmallInteger, default=0)

    duration_ms: Mapped[int | None] = mapped_column(Integer)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    fps: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    bitrate: Mapped[int | None] = mapped_column(Integer)
    codec: Mapped[str | None] = mapped_column(String(32))
    has_audio: Mapped[bool | None] = mapped_column(Boolean)
    audio_codec: Mapped[str | None] = mapped_column(String(32))
    color_palette: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    collection_ids: Mapped[list[int] | None] = mapped_column(ARRAY(BigInteger))
    sku_id: Mapped[int | None] = mapped_column(BigInteger)
    brand_id: Mapped[int | None] = mapped_column(BigInteger)
    project_id: Mapped[int | None] = mapped_column(BigInteger)

    user_tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    ai_tags: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)
    smart_tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text))

    ai_description: Mapped[str | None] = mapped_column(Text)
    ocr_text: Mapped[str | None] = mapped_column(Text)
    asr_text: Mapped[str | None] = mapped_column(Text)
    asr_segments: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)
    detected_objects: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    has_face: Mapped[bool] = mapped_column(Boolean, default=False)
    face_count: Mapped[int | None] = mapped_column(SmallInteger)
    scene_segments: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)
    highlights: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)

    source: Mapped[int] = mapped_column(SmallInteger, default=1)
    source_task_id: Mapped[int | None] = mapped_column(BigInteger)
    source_url: Mapped[str | None] = mapped_column(Text)
    source_model: Mapped[str | None] = mapped_column(String(64))
    source_prompt: Mapped[str | None] = mapped_column(Text)
    parent_id: Mapped[int | None] = mapped_column(BigInteger)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_latest: Mapped[bool] = mapped_column(Boolean, default=True)

    copyright_status: Mapped[int] = mapped_column(SmallInteger, default=1)
    copyright_notes: Mapped[str | None] = mapped_column(Text)
    license_expiry: Mapped[date | None] = mapped_column(Date)

    use_count: Mapped[int] = mapped_column(Integer, default=0)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    rating: Mapped[int] = mapped_column(SmallInteger, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)

    status: Mapped[int] = mapped_column(SmallInteger, default=1)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    ai_processing_status: Mapped[int] = mapped_column(SmallInteger, default=0)

    captured_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    imported_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)

    embedding_text: Mapped[list[float] | None] = mapped_column(Vector(3072))
    embedding_visual: Mapped[list[float] | None] = mapped_column(Vector(1024))

    @property
    def source_platform(self) -> str | None:
        return _tag_value(self.user_tags, "来源:")

    @property
    def source_extractor(self) -> str | None:
        return _tag_value(self.user_tags, "extractor:")


def _tag_value(tags: list[str] | None, prefix: str) -> str | None:
    for tag in tags or []:
        if tag.startswith(prefix):
            return tag.removeprefix(prefix)
    return None
