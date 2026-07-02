from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RelationCreate(BaseModel):
    source_asset_id: int
    target_asset_id: int
    relation_type: str = Field(min_length=1, max_length=32)
    extra_data: dict[str, Any] | None = None


class RelationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_asset_id: int
    target_asset_id: int
    relation_type: str
    metadata: dict[str, Any] | None
    created_at: datetime
