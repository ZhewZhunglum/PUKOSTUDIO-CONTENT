import mimetypes
import os
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.platforms import detect_import_platform, import_platforms_payload
from app.core.storage import storage
from app.core.task_utils import enqueue_task, get_task_status
from app.modules.asset import service
from app.modules.asset.schemas import (
    AssetFacetsResponse,
    AssetListRequest,
    AssetListResponse,
    AssetOut,
    AssetSearchRequest,
    AssetUpdate,
    BulkAITagEstimate,
    BulkAITagRequest,
    BulkAITagResponse,
    UploadCompleteRequest,
    UploadInitRequest,
    UploadInitResponse,
)

router = APIRouter(prefix="/assets", tags=["assets"])
DbSession = Annotated[AsyncSession, Depends(get_db)]
AssetListParams = Annotated[AssetListRequest, Depends()]


# ── AI tagging Pydantic models (defined before routes that use them) ───────────

class AITagResponse(BaseModel):
    task_id: int
    asset_id: int
    message: str


# ── Upload ─────────────────────────────────────────────────────────────────────

@router.post("/upload/init", response_model=UploadInitResponse)
async def upload_init(req: UploadInitRequest, db: DbSession) -> UploadInitResponse:
    if req.file_md5:
        existing = await service.find_by_md5(db, req.file_md5)
        if existing:
            return UploadInitResponse(
                upload_url=None,
                storage_key=existing.storage_key,
                asset_id=existing.id,
                is_duplicate=True,
            )

    ext = os.path.splitext(req.filename)[1] or _ext_from_mime(req.mime_type)
    storage_key = storage.build_key(_asset_type_folder(req.asset_type), str(uuid.uuid4()), ext)

    upload_url = await storage.generate_presigned_upload_url(
        key=storage_key,
        content_type=req.mime_type,
        expires_in=3600,
    )
    return UploadInitResponse(
        upload_url=upload_url,
        storage_key=storage_key,
        asset_id=None,
        is_duplicate=False,
    )


@router.post("/upload/complete", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def upload_complete(req: UploadCompleteRequest, db: DbSession) -> AssetOut:
    from app.modules.asset.schemas import AssetCreate

    create_data = AssetCreate(
        name=req.name or req.filename,
        storage_key=req.storage_key,
        cdn_url=storage.public_url(req.storage_key),
        asset_type=req.asset_type,
        original_filename=req.filename,
        mime_type=req.mime_type,
        file_size=req.file_size,
        file_md5=req.file_md5,
        file_format=os.path.splitext(req.filename)[1].lstrip(".").lower() or None,
    )
    asset = await service.create_asset(db, create_data, tags=req.tags)
    await db.commit()

    if asset.asset_type in (1, 2):
        await enqueue_task("generate_thumbnail", {"asset_id": asset.id})
    if settings.auto_ai_tag_on_ingest and asset.asset_type in (1, 2):
        await enqueue_task("ai_tag", {"asset_id": asset.id, "quality": "bulk_local"})
    if settings.auto_embedding_on_ingest and asset.asset_type == 1:
        await enqueue_task("embed_visual", {"asset_id": asset.id})

    return AssetOut.model_validate(asset)


class ThumbnailBackfillResponse(BaseModel):
    queued: int
    remaining: int
    message: str


@router.post("/thumbnails/backfill", response_model=ThumbnailBackfillResponse)
async def backfill_thumbnails(db: DbSession) -> ThumbnailBackfillResponse:
    """Enqueue cover generation for existing assets that are missing one."""
    queued, remaining = await service.backfill_thumbnails(db)
    return ThumbnailBackfillResponse(
        queued=queued,
        remaining=remaining,
        message=f"Enqueued {queued} thumbnail tasks ({remaining} remaining)",
    )


# ── URL Import ────────────────────────────────────────────────────────────────

class ImportUrlRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=2048)
    name: str | None = Field(default=None, max_length=256)
    tags: list[str] = Field(default_factory=list, max_length=20)
    sku_id: int | None = None
    brand_id: int | None = None
    force: bool = False


class ImportUrlResponse(BaseModel):
    task_id: int | None = None
    asset_id: int | None = None
    status: str = "queued"
    platform: str | None = None
    reason: str | None = None
    message: str


class ImportUrlSubmission(BaseModel):
    url: str
    status: str
    task_id: int | None = None
    asset_id: int | None = None
    platform: str | None = None
    reason: str | None = None


class ImportUrlsRequest(BaseModel):
    items: list[ImportUrlRequest] = Field(min_length=1, max_length=200)
    force: bool = False


class ImportUrlsResponse(BaseModel):
    submitted: int
    existing: int
    rejected: int
    items: list[ImportUrlSubmission]


class ImportUrlStatusResponse(BaseModel):
    task_id: int
    status: str          # pending | running | done | failed
    asset_id: int | None = None
    name: str | None = None
    platform: str | None = None
    platform_key: str | None = None
    extractor: str | None = None
    strategy: str | None = None
    error_code: str | None = None
    source_url: str | None = None
    asset_type: int | None = None
    error: str | None = None


@router.post("/import-url", response_model=ImportUrlResponse, status_code=status.HTTP_202_ACCEPTED)
async def import_from_url(req: ImportUrlRequest, db: DbSession) -> ImportUrlResponse:
    """Queue a background download of a video/image from a URL into the asset library."""
    submission = await _submit_import_url(db, req, force=req.force)
    if submission.status == "rejected":
        raise HTTPException(status_code=422, detail=submission.reason or "Invalid URL")
    return ImportUrlResponse(
        task_id=submission.task_id,
        asset_id=submission.asset_id,
        status=submission.status,
        platform=submission.platform,
        reason=submission.reason,
        message="素材已存在，已跳过下载" if submission.status == "existing" else "下载任务已提交，请稍候",
    )


@router.post("/import-urls", response_model=ImportUrlsResponse, status_code=status.HTTP_202_ACCEPTED)
async def import_from_urls(req: ImportUrlsRequest, db: DbSession) -> ImportUrlsResponse:
    """Queue a batch migration of online media URLs into the asset library."""
    items: list[ImportUrlSubmission] = []
    seen: set[str] = set()

    for item in req.items:
        url = _normalize_import_url(item.url)
        if url in seen:
            items.append(
                ImportUrlSubmission(
                    url=item.url,
                    status="rejected",
                    platform=_detect_platform_label(item.url),
                    reason="duplicate_in_batch",
                )
            )
            continue
        seen.add(url)
        items.append(await _submit_import_url(db, item, force=req.force or item.force))

    return ImportUrlsResponse(
        submitted=sum(1 for item in items if item.status == "queued"),
        existing=sum(1 for item in items if item.status == "existing"),
        rejected=sum(1 for item in items if item.status == "rejected"),
        items=items,
    )


@router.get("/import-url/platforms")
async def import_url_platforms() -> dict[str, object]:
    """Return online import platform registry and current yt-dlp capabilities."""
    try:
        import yt_dlp
        from yt_dlp.extractor import list_extractors

        ytdlp_version = yt_dlp.version.__version__
        extractor_count = len(list_extractors())
    except Exception:
        ytdlp_version = "unavailable"
        extractor_count = 0

    return {
        "platforms": import_platforms_payload(),
        "ytdlp_version": ytdlp_version,
        "extractor_count": extractor_count,
        "cookies_configured": bool(settings.ytdlp_cookies_file),
        "proxy_configured": bool(settings.ytdlp_proxy),
        "user_agent_configured": bool(settings.ytdlp_user_agent),
    }


@router.get("/import-url/{task_id}", response_model=ImportUrlStatusResponse)
async def import_url_status(task_id: int, db: DbSession) -> ImportUrlStatusResponse:
    """Poll the status of a URL import task."""
    task = await get_task_status(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    resp = ImportUrlStatusResponse(task_id=task_id, status=task.status)

    if task.status == "done" and task.result:
        resp.asset_id = task.result.get("asset_id")
        resp.name = task.result.get("name")
        resp.platform = task.result.get("platform")
        resp.platform_key = task.result.get("platform_key")
        resp.extractor = task.result.get("extractor")
        resp.strategy = task.result.get("strategy")
        resp.source_url = task.result.get("source_url")
        resp.asset_type = task.result.get("asset_type")
    elif task.status == "failed":
        resp.error = task.error
        resp.error_code = _parse_error_code(task.error)

    return resp


# ── List / search (static paths — must precede /{asset_id}) ───────────────────

@router.get("", response_model=AssetListResponse)
async def list_assets(req: AssetListParams, db: DbSession) -> AssetListResponse:
    return await service.list_assets(db, req)


@router.post("/search", response_model=AssetListResponse)
async def search_assets(req: AssetSearchRequest, db: DbSession) -> AssetListResponse:
    return await service.search_assets(db, req)


@router.get("/facets", response_model=AssetFacetsResponse)
async def asset_facets(db: DbSession) -> AssetFacetsResponse:
    return await service.get_facets(db)


# ── Bulk AI tag (static paths — must precede /{asset_id}) ─────────────────────

@router.get("/bulk-ai-tag/estimate", response_model=BulkAITagEstimate)
async def estimate_bulk_ai_tag(db: DbSession) -> BulkAITagEstimate:
    return await service.estimate_bulk_ai_tag(db)


@router.post("/bulk-ai-tag", response_model=BulkAITagResponse)
async def bulk_ai_tag(req: BulkAITagRequest, db: DbSession) -> BulkAITagResponse:
    return await service.bulk_ai_tag(db, req)


# ── Single asset CRUD (dynamic paths — must follow all static paths) ───────────

@router.get("/{asset_id}", response_model=AssetOut)
async def get_asset(asset_id: int, db: DbSession) -> AssetOut:
    asset = await service.get_asset(db, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return AssetOut.model_validate(asset)


@router.patch("/{asset_id}", response_model=AssetOut)
async def update_asset(asset_id: int, data: AssetUpdate, db: DbSession) -> AssetOut:
    asset = await service.update_asset(db, asset_id, data)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.commit()
    return AssetOut.model_validate(asset)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: int, db: DbSession) -> None:
    deleted = await service.soft_delete_asset(db, asset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.commit()


@router.post("/{asset_id}/ai-tag", response_model=AITagResponse)
async def trigger_ai_tag(asset_id: int, db: DbSession, force: bool = False) -> AITagResponse:
    asset = await service.get_asset(db, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    from sqlalchemy import update

    from app.modules.asset.models import Asset
    if force:
        await db.execute(
            update(Asset).where(Asset.id == asset_id).values(ai_processing_status=0)
        )
        await db.commit()

    task_id = await enqueue_task(
        "ai_tag",
        {"asset_id": asset_id, "force": force, "quality": "standard"},
        priority=8,
    )
    return AITagResponse(task_id=task_id, asset_id=asset_id, message="AI tagging task enqueued")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _ext_from_mime(mime_type: str) -> str:
    ext = mimetypes.guess_extension(mime_type)
    return ext or ""


def _asset_type_folder(asset_type: int) -> str:
    folders = {
        1: "images", 2: "videos", 3: "audio", 4: "subtitles",
        5: "scripts", 6: "products", 7: "brands", 8: "avatars",
        9: "ai_assets", 10: "outputs", 11: "references",
    }
    return folders.get(asset_type, "misc")


def _normalize_import_url(url: str) -> str:
    return url.strip()


def _is_valid_import_url(url: str) -> bool:
    return url.startswith(("http://", "https://")) and len(url) <= 2048


def _is_direct_import_url(url: str) -> bool:
    path = url.split("?", 1)[0].split("#", 1)[0].lower()
    return path.endswith((
        ".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".flv",
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif",
        ".mp3", ".m4a", ".wav", ".ogg", ".aac",
    ))


def _detect_platform_label(url: str) -> str:
    return detect_import_platform(url, is_direct_file=_is_direct_import_url(url)).label


async def _submit_import_url(
    db: AsyncSession,
    req: ImportUrlRequest,
    *,
    force: bool,
) -> ImportUrlSubmission:
    url = _normalize_import_url(req.url)
    platform = detect_import_platform(url, is_direct_file=_is_direct_import_url(url))
    if not _is_valid_import_url(url):
        return ImportUrlSubmission(
            url=req.url,
            status="rejected",
            platform=platform.label,
            reason="invalid_url",
        )

    if not force:
        existing = await service.find_by_source_url(db, url)
        if existing:
            return ImportUrlSubmission(
                url=url,
                status="existing",
                asset_id=existing.id,
                platform=platform.label,
                reason="source_url_exists",
            )

    task_id = await enqueue_task(
        "import_url",
        {
            "url": url,
            "name": req.name,
            "tags": req.tags,
            "sku_id": req.sku_id,
            "brand_id": req.brand_id,
            "force": force,
        },
        priority=6,
        max_retries=1,
    )
    return ImportUrlSubmission(
        url=url,
        status="queued",
        task_id=task_id,
        platform=platform.label,
    )


def _parse_error_code(error: str | None) -> str | None:
    if not error or ":" not in error:
        return None
    code = error.split(":", 1)[0]
    known_codes = {
        "unsupported_url",
        "auth_required",
        "geo_restricted",
        "too_large",
        "download_failed",
        "storage_failed",
    }
    return code if code in known_codes else None
