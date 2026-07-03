from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str | None
    parent_id: int | None
    aliases: list[str] | None
    color: str | None
    description: str | None
    use_count: int
    is_system: bool
    created_at: datetime


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    category: str | None = None
    parent_id: int | None = None
    aliases: list[str] | None = None
    color: str | None = None
    description: str | None = None


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    category: str | None = None
    aliases: list[str] | None = None
    color: str | None = None
    description: str | None = None


class TagMergeRequest(BaseModel):
    source_ids: list[int] = Field(min_length=1)
    target_name: str


class TagCategoryRenameRequest(BaseModel):
    old_name: str = Field(min_length=1, max_length=64)
    new_name: str = Field(min_length=1, max_length=64)


class AddTagsRequest(BaseModel):
    tag_names: list[str] = Field(min_length=1)
    source: int = 1  # 1 user, 2 AI, 3 system
