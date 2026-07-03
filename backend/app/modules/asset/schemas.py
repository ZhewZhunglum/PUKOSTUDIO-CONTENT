from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.core.storage import storage

ASSET_TYPE_NAMES = {
    1: "image", 2: "video", 3: "audio", 4: "subtitle",
    5: "script", 6: "product", 7: "brand", 8: "avatar",
    9: "ai_asset", 10: "output", 11: "reference",
}


class AssetBase(BaseModel):
    name: str
    description: str | None = None
    asset_type: int = Field(ge=1, le=11)
    asset_subtype: str | None = None
    user_tags: list[str] = []
    favorite: bool = False
    rating: int = Field(default=0, ge=0, le=5)
    sku_id: int | None = None
    brand_id: int | None = None
    project_id: int | None = None
    copyright_status: int = 1


class AssetCreate(AssetBase):
    storage_key: str
    storage_bucket: str = "contentforge-assets"
    original_filename: str | None = None
    mime_type: str | None = None
    file_format: str | None = None
    file_size: int | None = None
    file_md5: str | None = None
    cdn_url: str | None = None
    source: int = 1
    source_url: str | None = None
    source_model: str | None = None
    source_prompt: str | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    user_tags: list[str] | None = None
    favorite: bool | None = None
    rating: int | None = Field(default=None, ge=0, le=5)
    sku_id: int | None = None
    brand_id: int | None = None
    project_id: int | None = None
    copyright_status: int | None = None
    copyright_notes: str | None = None
    user_tags_add: list[str] | None = None
    user_tags_remove: list[str] | None = None


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    name: str
    description: str | None
    asset_type: int
    asset_subtype: str | None
    mime_type: str | None
    file_format: str | None
    file_size: int | None
    file_md5: str | None
    storage_key: str
    thumbnail_key: str | None
    preview_key: str | None
    cdn_url: str | None

    duration_ms: int | None
    width: int | None
    height: int | None
    fps: Decimal | None
    has_audio: bool | None
    color_palette: dict[str, Any] | None

    user_tags: list[str]
    ai_tags: list[dict[str, Any]] | None
    smart_tags: list[str] | None
    ai_description: str | None

    source: int
    source_url: str | None = None
    source_platform: str | None = None
    source_extractor: str | None = None
    source_model: str | None
    source_prompt: str | None
    favorite: bool
    rating: int
    use_count: int
    view_count: int
    status: int
    is_deleted: bool
    ai_processing_status: int

    imported_at: datetime
    updated_at: datetime
    captured_at: datetime | None

    @property
    def asset_type_name(self) -> str:
        return ASSET_TYPE_NAMES.get(self.asset_type, "unknown")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def thumbnail_url(self) -> str | None:
        return storage.public_url(self.thumbnail_key) if self.thumbnail_key else None


class AssetListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    name: str
    asset_type: int
    mime_type: str | None
    file_size: int | None
    thumbnail_key: str | None
    cdn_url: str | None
    duration_ms: int | None
    width: int | None
    height: int | None
    favorite: bool
    rating: int
    use_count: int
    user_tags: list[str]
    ai_processing_status: int
    imported_at: datetime
    source_url: str | None = None
    source_platform: str | None = None
    source_extractor: str | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def thumbnail_url(self) -> str | None:
        return storage.public_url(self.thumbnail_key) if self.thumbnail_key else None


class UploadInitRequest(BaseModel):
    filename: str
    file_size: int = Field(gt=0)
    mime_type: str
    file_md5: str | None = None
    asset_type: int = Field(ge=1, le=11)


class UploadInitResponse(BaseModel):
    upload_url: str | None  # None if instant upload (dedup hit)
    storage_key: str
    asset_id: int | None  # set if dedup hit
    is_duplicate: bool = False


class UploadCompleteRequest(BaseModel):
    storage_key: str
    filename: str
    mime_type: str
    file_size: int
    file_md5: str | None = None
    asset_type: int = Field(ge=1, le=11)
    name: str | None = None


class AssetListRequest(BaseModel):
    asset_types: list[int] | None = None
    favorite: bool | None = None
    rating_gte: int | None = None
    tags_all: list[str] | None = None
    tags_any: list[str] | None = None
    tags_not: list[str] | None = None
    search: str | None = None
    imported_after: datetime | None = None
    imported_before: datetime | None = None
    sku_id: int | None = None
    sort: str = "recency"  # recency | use_count | rating | name
    cursor: int | None = None
    limit: int = Field(default=50, ge=1, le=200)


class AssetListResponse(BaseModel):
    items: list[AssetListItem]
    next_cursor: int | None
    total_hint: int | None = None


class AssetFacetTag(BaseModel):
    name: str
    use_count: int


class AssetFacetsResponse(BaseModel):
    by_type: dict[str, int]
    top_tags: list[AssetFacetTag]


class BulkAITagRequest(BaseModel):
    asset_ids: list[int] | None = None
    force: bool = False
    quality: str = "bulk_local"


class BulkAITagResponse(BaseModel):
    enqueued: int
    message: str


class BulkAITagEstimate(BaseModel):
    untagged_count: int
    estimated_cost_usd: float


class IntRangeFilter(BaseModel):
    gte: int | None = None
    lte: int | None = None


class AssetSearchFilters(BaseModel):
    asset_ids: list[int] | None = None
    asset_type: list[int] | None = None
    duration_ms: IntRangeFilter | None = None
    width: IntRangeFilter | None = None
    height: IntRangeFilter | None = None
    tags_all: list[str] | None = None
    tags_any: list[str] | None = None
    tags_not: list[str] | None = None
    favorite: bool | None = None
    rating_gte: int | None = Field(default=None, ge=0, le=5)
    imported_after: datetime | None = None
    imported_before: datetime | None = None
    sku_id: int | None = None
    brand_id: int | None = None
    project_id: int | None = None


class AssetSearchRequest(BaseModel):
    query: str | None = None
    keyword: str | None = None
    search_mode: str = "keyword"
    filters: AssetSearchFilters = Field(default_factory=AssetSearchFilters)
    sort: str = "relevance"
    cursor: int | None = None
    limit: int = Field(default=50, ge=1, le=200)
