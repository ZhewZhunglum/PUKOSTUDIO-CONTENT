from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SkuCreate(BaseModel):
    name: str
    brand_id: int | None = None
    description: str | None = None
    category: str | None = None
    price_cny: Decimal | None = None
    cover_asset_id: int | None = None
    tags: list[str] | None = None
    status: int = 1
    notes: str | None = None


class SkuUpdate(BaseModel):
    name: str | None = None
    brand_id: int | None = None
    description: str | None = None
    category: str | None = None
    price_cny: Decimal | None = None
    cover_asset_id: int | None = None
    tags: list[str] | None = None
    status: int | None = None
    notes: str | None = None


class SkuOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    brand_id: int | None
    description: str | None
    category: str | None
    price_cny: Decimal | None
    cover_asset_id: int | None
    tags: list[str] | None
    status: int
    notes: str | None
    created_at: datetime
    updated_at: datetime
