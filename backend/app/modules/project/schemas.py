from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    status: int = 0
    cover_asset_id: int | None = None
    sku_id: int | None = None
    brand_id: int | None = None
    deadline: datetime | None = None
    notes: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: int | None = None
    cover_asset_id: int | None = None
    sku_id: int | None = None
    brand_id: int | None = None
    deadline: datetime | None = None
    notes: str | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    status: int
    cover_asset_id: int | None
    sku_id: int | None
    brand_id: int | None
    deadline: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
