from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TemplateBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str | None = None
    template_type: int = Field(default=1, ge=1, le=2)
    platform: str | None = None
    style: str | None = None
    duration: int | None = Field(default=None, ge=5, le=600)
    description: str | None = None
    hooks: list[str] = []
    outline: list[str] = []
    cta: str | None = None
    body: str | None = None
    variables: list[str] = []


class TemplateCreate(TemplateBase):
    is_builtin: bool = False


class TemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = None
    platform: str | None = None
    style: str | None = None
    duration: int | None = None
    description: str | None = None
    hooks: list[str] | None = None
    outline: list[str] | None = None
    cta: str | None = None
    body: str | None = None
    variables: list[str] | None = None
    status: int | None = None


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str | None
    template_type: int
    platform: str | None
    style: str | None
    duration: int | None
    description: str | None
    hooks: list[str]
    outline: list[str]
    cta: str | None
    body: str | None
    variables: list[str]
    is_builtin: bool
    use_count: int
    status: int
    created_at: datetime
    updated_at: datetime
