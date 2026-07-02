from datetime import datetime
from typing import Any

from sqlalchemy import JSON, TIMESTAMP, BigInteger, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Collection(Base):
    __tablename__ = "collection"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    cover_asset_id: Mapped[int | None] = mapped_column(BigInteger)
    asset_count: Mapped[int] = mapped_column(Integer, default=0)
    is_smart: Mapped[bool] = mapped_column(Boolean, default=False)
    smart_rules: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)


class CollectionAsset(Base):
    __tablename__ = "collection_asset"

    collection_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    asset_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    added_at: Mapped[datetime] = mapped_column(TIMESTAMP)
