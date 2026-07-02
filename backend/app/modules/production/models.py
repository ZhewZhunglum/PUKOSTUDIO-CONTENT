from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import TIMESTAMP, BigInteger, Date, Numeric, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Production(Base):
    """A published / ready-to-publish short video with optional business links."""

    __tablename__ = "production"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    asset_id: Mapped[int] = mapped_column(BigInteger, nullable=False)   # video asset

    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Publishing
    platform: Mapped[str | None] = mapped_column(String(32))            # tiktok / youtube / instagram / ...
    platform_url: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    status: Mapped[int] = mapped_column(SmallInteger, default=0)        # 0=draft 1=published 2=archived

    # Business linkage (optional)
    sku_id: Mapped[int | None] = mapped_column(BigInteger)
    brand_id: Mapped[int | None] = mapped_column(BigInteger)
    video_project_id: Mapped[int | None] = mapped_column(BigInteger)

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)


class AdPerformance(Base):
    """Per-campaign advertising performance snapshot for a production."""

    __tablename__ = "ad_performance"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    production_id: Mapped[int] = mapped_column(BigInteger, nullable=False)

    platform: Mapped[str | None] = mapped_column(String(32))
    campaign_name: Mapped[str | None] = mapped_column(String(256))
    date_start: Mapped[date | None] = mapped_column(Date)
    date_end: Mapped[date | None] = mapped_column(Date)

    # Cost
    spend: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    currency: Mapped[str] = mapped_column(String(8), default="CNY")

    # Volume
    impressions: Mapped[int | None] = mapped_column(BigInteger)
    clicks: Mapped[int | None] = mapped_column(BigInteger)
    plays: Mapped[int | None] = mapped_column(BigInteger)

    # Rates (0–100 %)
    ctr: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    completion_rate: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))

    # Engagement
    likes: Mapped[int | None] = mapped_column(BigInteger)
    comments: Mapped[int | None] = mapped_column(BigInteger)
    shares: Mapped[int | None] = mapped_column(BigInteger)

    # Conversion
    conversions: Mapped[int | None] = mapped_column(BigInteger)
    revenue: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    roas: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)
