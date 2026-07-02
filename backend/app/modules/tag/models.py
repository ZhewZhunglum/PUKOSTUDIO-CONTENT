from datetime import datetime

from sqlalchemy import TIMESTAMP, BigInteger, Boolean, Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Tag(Base):
    __tablename__ = "tag"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    category: Mapped[str | None] = mapped_column(String(32))
    parent_id: Mapped[int | None] = mapped_column(BigInteger)
    aliases: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    color: Mapped[str | None] = mapped_column(String(7))
    description: Mapped[str | None] = mapped_column(Text)
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)


class AssetTag(Base):
    __tablename__ = "asset_tag"

    asset_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    tag_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    source: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Numeric(3, 2))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
