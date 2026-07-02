from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BrandCreate(BaseModel):
    name: str
    description: str | None = None
    logo_asset_id: int | None = None
    website: str | None = None
    color_primary: str | None = None
    notes: str | None = None


class BrandUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    logo_asset_id: int | None = None
    website: str | None = None
    color_primary: str | None = None
    notes: str | None = None


class BrandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    logo_asset_id: int | None
    website: str | None
    color_primary: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
