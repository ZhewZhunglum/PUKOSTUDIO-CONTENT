from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

# ── AdPerformance ─────────────────────────────────────────────────────────────

class AdPerformanceCreate(BaseModel):
    platform: str | None = None
    campaign_name: str | None = None
    date_start: date | None = None
    date_end: date | None = None
    spend: Decimal | None = None
    currency: str = "CNY"
    impressions: int | None = None
    clicks: int | None = None
    plays: int | None = None
    ctr: Decimal | None = None
    completion_rate: Decimal | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    conversions: int | None = None
    revenue: Decimal | None = None
    roas: Decimal | None = None
    notes: str | None = None


class AdPerformanceUpdate(BaseModel):
    platform: str | None = None
    campaign_name: str | None = None
    date_start: date | None = None
    date_end: date | None = None
    spend: Decimal | None = None
    currency: str | None = None
    impressions: int | None = None
    clicks: int | None = None
    plays: int | None = None
    ctr: Decimal | None = None
    completion_rate: Decimal | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    conversions: int | None = None
    revenue: Decimal | None = None
    roas: Decimal | None = None
    notes: str | None = None


class AdPerformanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    production_id: int
    platform: str | None
    campaign_name: str | None
    date_start: date | None
    date_end: date | None
    spend: Decimal | None
    currency: str
    impressions: int | None
    clicks: int | None
    plays: int | None
    ctr: Decimal | None
    completion_rate: Decimal | None
    likes: int | None
    comments: int | None
    shares: int | None
    conversions: int | None
    revenue: Decimal | None
    roas: Decimal | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ── Production ─────────────────────────────────────────────────────────────────

class ProductionCreate(BaseModel):
    asset_id: int
    title: str
    description: str | None = None
    platform: str | None = None
    platform_url: str | None = None
    published_at: datetime | None = None
    status: int = 0
    sku_id: int | None = None
    brand_id: int | None = None
    video_project_id: int | None = None
    notes: str | None = None


class ProductionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    platform: str | None = None
    platform_url: str | None = None
    published_at: datetime | None = None
    status: int | None = None
    sku_id: int | None = None
    brand_id: int | None = None
    video_project_id: int | None = None
    notes: str | None = None


class ProductionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_id: int
    title: str
    description: str | None
    platform: str | None
    platform_url: str | None
    published_at: datetime | None
    status: int
    sku_id: int | None
    brand_id: int | None
    video_project_id: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    # Joined fields (populated by service layer)
    ad_performances: list[AdPerformanceOut] = []
    asset_thumbnail_url: str | None = None
    asset_preview_url: str | None = None
    asset_name: str | None = None
    asset_duration_ms: int | None = None


class ProductionListResponse(BaseModel):
    items: list[ProductionOut]
    total: int
