from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = None
    cover_asset_id: int | None = None
    is_smart: bool = False
    smart_rules: dict[str, Any] | None = None
    sort_order: int = 0


class CollectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = None
    cover_asset_id: int | None = None
    is_smart: bool | None = None
    smart_rules: dict[str, Any] | None = None
    sort_order: int | None = None


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    cover_asset_id: int | None
    asset_count: int
    is_smart: bool
    smart_rules: dict[str, Any] | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class AddAssetsRequest(BaseModel):
    asset_ids: list[int] = Field(min_length=1)
