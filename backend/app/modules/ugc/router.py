"""Legacy UGC Outreach router.

This router is intentionally not mounted by ContentForge. UGC Outreach now runs
as a separate app, while historical models/migrations stay available for data
compatibility.
"""
from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import date, timedelta, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import and_, asc, case, delete, desc, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import verify_token
from app.core.database import get_db
from app.modules.ugc.deps import get_team_id
from app.modules.ugc.models import (
    AIDraftStatus,
    CampaignInfluencerStatus,
    CampaignStatus,
    CampaignType,
    EmailDirection,
    EmailStatus,
    InfluencerStatus,
    PlatformType,
    TemplateCategory,
    UGCAIDraft,
    UGCCampaign,
    UGCCampaignInfluencer,
    UGCCampaignStep,
    UGCConversation,
    UGCEmailAccount,
    UGCEmailMessage,
    UGCEmailTemplate,
    UGCInfluencer,
    UGCInfluencerPlatform,
    UGCTag,
    ugc_influencer_tags,
)

router = APIRouter(prefix="/api/ugc", tags=["ugc"])

# ─────────────────────────────────────────────────────────────────────────────
# Shared dependency shorthand
# ─────────────────────────────────────────────────────────────────────────────

Authenticated = Depends(verify_token)
TeamId = Depends(get_team_id)
DB = Depends(get_db)


def _404(msg: str = "Not found") -> HTTPException:
    return HTTPException(status_code=404, detail=msg)


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas (inline for simplicity)
# ─────────────────────────────────────────────────────────────────────────────

class PlatformIn(BaseModel):
    platform: str
    username: str
    data_provider: str | None = None
    external_id: str | None = None
    profile_url: str | None = None
    followers: int | None = None
    engagement_rate: float | None = None
    avg_views: int | None = None


class InfluencerCreate(BaseModel):
    name: str
    email: str | None = None
    niche: str | None = None
    country: str | None = None
    notes: str | None = None
    source: str | None = None
    tag_ids: list[uuid.UUID] = []
    platforms: list[PlatformIn] = []


class InfluencerUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    niche: str | None = None
    country: str | None = None
    notes: str | None = None
    status: str | None = None
    tag_ids: list[uuid.UUID] | None = None
    platforms: list[dict] | None = None


class CRMActionRequest(BaseModel):
    action: str
    note: str | None = None


class EnrollRequest(BaseModel):
    influencer_ids: list[uuid.UUID]


class StepIn(BaseModel):
    step_order: int = 1
    step_type: str = "initial"
    template_id: uuid.UUID
    delay_days: int = 0
    condition: dict | None = None


class CampaignCreate(BaseModel):
    name: str
    description: str | None = None
    campaign_type: str = "ugc"
    steps: list[StepIn]
    target_criteria: dict | None = None
    schedule_config: dict | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class TemplateCreate(BaseModel):
    name: str
    subject: str
    body_html: str
    body_text: str | None = None
    category: str = "custom"
    language: str = "en"
    variables: dict | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body_html: str | None = None
    body_text: str | None = None
    category: str | None = None
    language: str | None = None


class EmailAccountCreate(BaseModel):
    email_address: str
    display_name: str | None = None
    provider_type: str
    provider_config: dict | None = None
    signature: str | None = None
    daily_limit: int = 50


class EmailAccountUpdate(BaseModel):
    display_name: str | None = None
    provider_config: dict | None = None
    signature: str | None = None
    daily_limit: int | None = None
    is_active: bool | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _inf_to_dict(inf: UGCInfluencer) -> dict:
    return {
        "id": str(inf.id),
        "name": inf.name,
        "email": inf.email,
        "email_verified": inf.email_verified,
        "avatar_url": inf.avatar_url,
        "niche": inf.niche,
        "country": inf.country,
        "status": inf.status,
        "notes": inf.notes,
        "source": inf.source,
        "created_at": inf.created_at.isoformat() if inf.created_at else None,
        "updated_at": inf.updated_at.isoformat() if inf.updated_at else None,
        "platforms": [
            {
                "id": str(p.id),
                "platform": p.platform,
                "username": p.username,
                "data_provider": p.data_provider,
                "external_id": p.external_id,
                "profile_url": p.profile_url,
                "followers": p.followers,
                "engagement_rate": p.engagement_rate,
                "avg_views": p.avg_views,
                "last_synced_at": p.last_synced_at.isoformat() if p.last_synced_at else None,
            }
            for p in (inf.platforms or [])
        ],
        "tags": [{"id": str(t.id), "name": t.name, "color": t.color} for t in (inf.tags or [])],
    }


def _campaign_to_dict(c: UGCCampaign) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "description": c.description,
        "status": c.status,
        "campaign_type": c.campaign_type,
        "target_criteria": c.target_criteria,
        "schedule_config": c.schedule_config,
        "started_at": c.started_at.isoformat() if c.started_at else None,
        "completed_at": c.completed_at.isoformat() if c.completed_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "steps": [
            {
                "id": str(s.id),
                "step_order": s.step_order,
                "step_type": s.step_type,
                "template_id": str(s.template_id),
                "delay_days": s.delay_days,
                "condition": s.condition,
            }
            for s in (c.steps or [])
        ],
    }


def _template_to_dict(t: UGCEmailTemplate) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "subject": t.subject,
        "body_html": t.body_html,
        "body_text": t.body_text,
        "category": t.category,
        "language": t.language,
        "is_library": t.is_library,
        "variables": t.variables,
        "open_count": t.open_count,
        "reply_count": t.reply_count,
        "send_count": t.send_count,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


def _extract_vars(text: str) -> list[str]:
    return list(set(re.findall(r"\{\{(\w+)\}\}", text)))


# ─────────────────────────────────────────────────────────────────────────────
# Influencers
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/influencers")
async def list_influencers(
    search: str | None = Query(None),
    status: str | None = Query(None),
    niche: str | None = Query(None),
    platform: str | None = Query(None),
    source: str | None = Query(None),
    has_email: bool | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    query = (
        select(UGCInfluencer)
        .where(UGCInfluencer.team_id == team_id)
        .options(selectinload(UGCInfluencer.platforms), selectinload(UGCInfluencer.tags))
    )
    if search:
        query = query.where(
            or_(UGCInfluencer.name.ilike(f"%{search}%"), UGCInfluencer.email.ilike(f"%{search}%"))
        )
    if status:
        query = query.where(UGCInfluencer.status == status)
    if niche:
        query = query.where(UGCInfluencer.niche == niche)
    if source:
        query = query.where(UGCInfluencer.source == source)
    if has_email is True:
        query = query.where(UGCInfluencer.email.is_not(None), UGCInfluencer.email != "")
    elif has_email is False:
        query = query.where(or_(UGCInfluencer.email.is_(None), UGCInfluencer.email == ""))
    if platform:
        query = query.join(UGCInfluencerPlatform).where(
            UGCInfluencerPlatform.platform == platform
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(UGCInfluencer.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(query)).scalars().all()

    return {
        "items": [_inf_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }


@router.post("/influencers", status_code=201)
async def create_influencer(
    data: InfluencerCreate,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    inf = UGCInfluencer(
        team_id=team_id, name=data.name, email=data.email,
        niche=data.niche, country=data.country, notes=data.notes, source=data.source,
    )
    db.add(inf)
    await db.flush()
    for p in data.platforms:
        db.add(UGCInfluencerPlatform(
            team_id=team_id, influencer_id=inf.id,
            platform=PlatformType(p.platform), username=p.username,
            data_provider=p.data_provider, external_id=p.external_id,
            profile_url=p.profile_url, followers=p.followers,
            engagement_rate=p.engagement_rate, avg_views=p.avg_views,
        ))
    if data.tag_ids:
        tags = (await db.execute(select(UGCTag).where(UGCTag.id.in_(data.tag_ids)))).scalars().all()
        inf.tags = list(tags)
    await db.commit()
    await db.refresh(inf)
    result = await db.execute(
        select(UGCInfluencer).where(UGCInfluencer.id == inf.id)
        .options(selectinload(UGCInfluencer.platforms), selectinload(UGCInfluencer.tags))
    )
    return _inf_to_dict(result.scalar_one())


@router.get("/influencers/{influencer_id}")
async def get_influencer(
    influencer_id: uuid.UUID,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCInfluencer)
        .where(UGCInfluencer.id == influencer_id, UGCInfluencer.team_id == team_id)
        .options(selectinload(UGCInfluencer.platforms), selectinload(UGCInfluencer.tags))
    )
    inf = result.scalar_one_or_none()
    if not inf:
        raise _404("Influencer not found")
    return _inf_to_dict(inf)


@router.patch("/influencers/{influencer_id}")
async def update_influencer(
    influencer_id: uuid.UUID,
    data: InfluencerUpdate,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCInfluencer)
        .where(UGCInfluencer.id == influencer_id, UGCInfluencer.team_id == team_id)
        .options(selectinload(UGCInfluencer.platforms), selectinload(UGCInfluencer.tags))
    )
    inf = result.scalar_one_or_none()
    if not inf:
        raise _404()
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "tag_ids" and value is not None:
            tags = (await db.execute(select(UGCTag).where(UGCTag.id.in_(value)))).scalars().all()
            inf.tags = list(tags)
        elif field == "platforms" and value is not None:
            await db.execute(delete(UGCInfluencerPlatform).where(
                UGCInfluencerPlatform.influencer_id == inf.id
            ))
            for pd in value:
                db.add(UGCInfluencerPlatform(
                    team_id=team_id, influencer_id=inf.id,
                    platform=PlatformType(pd["platform"]), username=pd["username"],
                    data_provider=pd.get("data_provider"), external_id=pd.get("external_id"),
                    profile_url=pd.get("profile_url"), followers=pd.get("followers"),
                    engagement_rate=pd.get("engagement_rate"), avg_views=pd.get("avg_views"),
                ))
        elif field == "status" and value is not None:
            inf.status = InfluencerStatus(value)
        elif field not in {"tag_ids", "platforms"}:
            setattr(inf, field, value)
    await db.commit()
    result2 = await db.execute(
        select(UGCInfluencer).where(UGCInfluencer.id == influencer_id)
        .options(selectinload(UGCInfluencer.platforms), selectinload(UGCInfluencer.tags))
    )
    return _inf_to_dict(result2.scalar_one())


@router.delete("/influencers/{influencer_id}", status_code=204)
async def delete_influencer(
    influencer_id: uuid.UUID,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> None:
    result = await db.execute(
        select(UGCInfluencer).where(
            UGCInfluencer.id == influencer_id, UGCInfluencer.team_id == team_id
        )
    )
    inf = result.scalar_one_or_none()
    if not inf:
        raise _404()
    await db.delete(inf)
    await db.commit()


@router.post("/influencers/{influencer_id}/crm-action")
async def crm_action(
    influencer_id: uuid.UUID,
    data: CRMActionRequest,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCInfluencer)
        .where(UGCInfluencer.id == influencer_id, UGCInfluencer.team_id == team_id)
        .options(selectinload(UGCInfluencer.platforms), selectinload(UGCInfluencer.tags))
    )
    inf = result.scalar_one_or_none()
    if not inf:
        raise _404()
    STATUS_MAP = {
        "mark_contacted": InfluencerStatus.contacted,
        "mark_replied": InfluencerStatus.replied,
        "mark_negotiating": InfluencerStatus.negotiating,
        "mark_signed": InfluencerStatus.signed,
        "mark_rejected": InfluencerStatus.rejected,
        "blacklist": InfluencerStatus.blacklisted,
        "restore": InfluencerStatus.new,
    }
    if data.action in STATUS_MAP:
        inf.status = STATUS_MAP[data.action]
    if data.note:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        entry = f"[{ts}] {data.note}"
        inf.notes = f"{inf.notes}\n{entry}" if inf.notes else entry
    await db.commit()
    result2 = await db.execute(
        select(UGCInfluencer).where(UGCInfluencer.id == influencer_id)
        .options(selectinload(UGCInfluencer.platforms), selectinload(UGCInfluencer.tags))
    )
    return _inf_to_dict(result2.scalar_one())


@router.post("/influencers/import")
async def import_influencers(
    file: UploadFile = File(...),
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    content = await file.read()
    text_content = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text_content))
    rows = list(reader)

    imported = skipped = 0
    errors: list[str] = []
    for i, row in enumerate(rows):
        name = row.get("name", "").strip()
        email = row.get("email", "").strip() or None
        if not name:
            errors.append(f"Row {i+1}: missing name")
            skipped += 1
            continue
        if email:
            dup = (await db.execute(
                select(UGCInfluencer).where(
                    UGCInfluencer.email == email, UGCInfluencer.team_id == team_id
                )
            )).scalar_one_or_none()
            if dup:
                skipped += 1
                continue
        inf = UGCInfluencer(
            team_id=team_id, name=name, email=email,
            niche=row.get("niche", "").strip() or None,
            country=row.get("country", "US").strip() or "US",
            source="csv_import",
        )
        db.add(inf)
        await db.flush()
        pname = row.get("platform", "").strip().lower()
        uname = row.get("username", "").strip()
        if pname and uname and pname in ("tiktok", "instagram", "youtube"):
            try:
                followers = int(row.get("followers", "") or 0) or None
            except ValueError:
                followers = None
            try:
                er = float(row.get("engagement_rate", "") or 0) or None
            except ValueError:
                er = None
            db.add(UGCInfluencerPlatform(
                team_id=team_id, influencer_id=inf.id,
                platform=PlatformType(pname), username=uname,
                profile_url=row.get("profile_url", "").strip() or None,
                followers=followers, engagement_rate=er,
            ))
        imported += 1
    await db.commit()
    return {"total_rows": len(rows), "imported": imported, "skipped": skipped, "errors": errors}


@router.get("/influencers/export/csv")
async def export_influencers(
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    from fastapi.responses import StreamingResponse
    rows = (await db.execute(
        select(UGCInfluencer)
        .where(UGCInfluencer.team_id == team_id)
        .options(selectinload(UGCInfluencer.platforms))
        .order_by(UGCInfluencer.created_at.desc())
    )).scalars().all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["name", "email", "niche", "country", "status", "source", "platform", "username", "followers", "engagement_rate"])
    for r in rows:
        p = r.platforms[0] if r.platforms else None
        w.writerow([r.name, r.email, r.niche, r.country, r.status, r.source,
                    p.platform if p else "", p.username if p else "",
                    p.followers if p else "", p.engagement_rate if p else ""])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=influencers.csv"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tags
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/tags")
async def list_tags(
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    rows = (await db.execute(
        select(UGCTag).where(UGCTag.team_id == team_id).order_by(UGCTag.name)
    )).scalars().all()
    return [{"id": str(t.id), "name": t.name, "color": t.color} for t in rows]


@router.post("/tags", status_code=201)
async def create_tag(
    data: dict,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    tag = UGCTag(team_id=team_id, name=data["name"], color=data.get("color"))
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return {"id": str(tag.id), "name": tag.name, "color": tag.color}


# ─────────────────────────────────────────────────────────────────────────────
# Campaigns
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/campaigns")
async def list_campaigns(
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    rows = (await db.execute(
        select(UGCCampaign)
        .where(UGCCampaign.team_id == team_id)
        .options(selectinload(UGCCampaign.steps))
        .order_by(UGCCampaign.created_at.desc())
    )).scalars().all()
    return [_campaign_to_dict(c) for c in rows]


@router.post("/campaigns", status_code=201)
async def create_campaign(
    data: CampaignCreate,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    campaign = UGCCampaign(
        team_id=team_id, name=data.name, description=data.description,
        campaign_type=CampaignType(data.campaign_type),
        target_criteria=data.target_criteria, schedule_config=data.schedule_config,
    )
    db.add(campaign)
    await db.flush()
    for s in data.steps:
        db.add(UGCCampaignStep(
            campaign_id=campaign.id, step_order=s.step_order,
            step_type=s.step_type, template_id=s.template_id,
            delay_days=s.delay_days, condition=s.condition,
        ))
    await db.commit()
    result = await db.execute(
        select(UGCCampaign).where(UGCCampaign.id == campaign.id)
        .options(selectinload(UGCCampaign.steps))
    )
    return _campaign_to_dict(result.scalar_one())


@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: uuid.UUID,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCCampaign)
        .where(UGCCampaign.id == campaign_id, UGCCampaign.team_id == team_id)
        .options(selectinload(UGCCampaign.steps), selectinload(UGCCampaign.influencers))
    )
    c = result.scalar_one_or_none()
    if not c:
        raise _404()
    return _campaign_to_dict(c)


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: uuid.UUID,
    data: CampaignUpdate,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCCampaign)
        .where(UGCCampaign.id == campaign_id, UGCCampaign.team_id == team_id)
        .options(selectinload(UGCCampaign.steps))
    )
    c = result.scalar_one_or_none()
    if not c:
        raise _404()
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    await db.commit()
    result2 = await db.execute(
        select(UGCCampaign).where(UGCCampaign.id == campaign_id)
        .options(selectinload(UGCCampaign.steps))
    )
    return _campaign_to_dict(result2.scalar_one())


@router.post("/campaigns/{campaign_id}/start")
async def start_campaign(
    campaign_id: uuid.UUID,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCCampaign)
        .where(UGCCampaign.id == campaign_id, UGCCampaign.team_id == team_id)
        .options(selectinload(UGCCampaign.steps), selectinload(UGCCampaign.influencers))
    )
    c = result.scalar_one_or_none()
    if not c:
        raise _404()
    if c.status not in (CampaignStatus.draft, CampaignStatus.paused):
        raise HTTPException(400, "Cannot start campaign from current status")
    if not c.steps:
        raise HTTPException(400, "Campaign needs at least one step")
    if not c.influencers:
        raise HTTPException(400, "No influencers enrolled")
    c.status = CampaignStatus.active
    c.started_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "active"}


@router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: uuid.UUID,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCCampaign)
        .where(UGCCampaign.id == campaign_id, UGCCampaign.team_id == team_id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise _404()
    c.status = CampaignStatus.paused
    await db.commit()
    return {"status": "paused"}


@router.post("/campaigns/{campaign_id}/enroll", status_code=201)
async def enroll_influencers(
    campaign_id: uuid.UUID,
    data: EnrollRequest,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCCampaign)
        .where(UGCCampaign.id == campaign_id, UGCCampaign.team_id == team_id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise _404()
    enrolled = 0
    for inf_id in data.influencer_ids:
        existing = (await db.execute(
            select(UGCCampaignInfluencer).where(
                UGCCampaignInfluencer.campaign_id == campaign_id,
                UGCCampaignInfluencer.influencer_id == inf_id,
            )
        )).scalar_one_or_none()
        if not existing:
            db.add(UGCCampaignInfluencer(
                campaign_id=campaign_id, influencer_id=inf_id,
                enrolled_at=datetime.now(timezone.utc),
            ))
            enrolled += 1
    await db.commit()
    return {"enrolled": enrolled}


@router.delete("/campaigns/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: uuid.UUID,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> None:
    result = await db.execute(
        select(UGCCampaign)
        .where(UGCCampaign.id == campaign_id, UGCCampaign.team_id == team_id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise _404()
    await db.delete(c)
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Email Templates
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/templates")
async def list_templates(
    language: str | None = Query(None),
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    q = select(UGCEmailTemplate).where(
        UGCEmailTemplate.team_id == team_id,
        UGCEmailTemplate.is_library.is_(False),
    ).order_by(UGCEmailTemplate.created_at.desc())
    if language:
        q = q.where(UGCEmailTemplate.language == language)
    rows = (await db.execute(q)).scalars().all()
    return [_template_to_dict(t) for t in rows]


@router.post("/templates", status_code=201)
async def create_template(
    data: TemplateCreate,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    variables = _extract_vars(data.subject + " " + data.body_html)
    tmpl = UGCEmailTemplate(
        team_id=team_id, name=data.name, subject=data.subject,
        body_html=data.body_html, body_text=data.body_text,
        category=data.category, language=data.language,
        variables={"fields": variables} if variables else data.variables,
    )
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)
    return _template_to_dict(tmpl)


@router.get("/templates/{template_id}")
async def get_template(
    template_id: uuid.UUID,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCEmailTemplate).where(
            UGCEmailTemplate.id == template_id, UGCEmailTemplate.team_id == team_id
        )
    )
    t = result.scalar_one_or_none()
    if not t:
        raise _404()
    return _template_to_dict(t)


@router.put("/templates/{template_id}")
async def update_template(
    template_id: uuid.UUID,
    data: TemplateUpdate,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCEmailTemplate).where(
            UGCEmailTemplate.id == template_id, UGCEmailTemplate.team_id == team_id
        )
    )
    t = result.scalar_one_or_none()
    if not t:
        raise _404()
    if t.is_library:
        raise HTTPException(400, "Clone library templates before editing")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    await db.commit()
    await db.refresh(t)
    return _template_to_dict(t)


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: uuid.UUID,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> None:
    result = await db.execute(
        select(UGCEmailTemplate).where(
            UGCEmailTemplate.id == template_id, UGCEmailTemplate.team_id == team_id
        )
    )
    t = result.scalar_one_or_none()
    if not t:
        raise _404()
    await db.delete(t)
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Email Accounts (settings)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/email-accounts")
async def list_email_accounts(
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    rows = (await db.execute(
        select(UGCEmailAccount)
        .where(UGCEmailAccount.team_id == team_id)
        .order_by(UGCEmailAccount.created_at.desc())
    )).scalars().all()
    return [
        {
            "id": str(a.id), "email_address": a.email_address, "display_name": a.display_name,
            "provider_type": a.provider_type, "daily_limit": a.daily_limit,
            "sent_today": a.sent_today, "warmup_stage": a.warmup_stage,
            "is_active": a.is_active, "health_status": a.health_status,
            "signature": a.signature,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in rows
    ]


@router.post("/email-accounts", status_code=201)
async def create_email_account(
    data: EmailAccountCreate,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    acct = UGCEmailAccount(
        team_id=team_id, email_address=data.email_address, display_name=data.display_name,
        provider_type=data.provider_type, provider_config=data.provider_config,
        signature=data.signature, daily_limit=data.daily_limit,
    )
    db.add(acct)
    await db.commit()
    await db.refresh(acct)
    return {"id": str(acct.id), "email_address": acct.email_address, "is_active": acct.is_active}


@router.patch("/email-accounts/{account_id}")
async def update_email_account(
    account_id: uuid.UUID,
    data: EmailAccountUpdate,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCEmailAccount).where(
            UGCEmailAccount.id == account_id, UGCEmailAccount.team_id == team_id
        )
    )
    acct = result.scalar_one_or_none()
    if not acct:
        raise _404()
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(acct, field, value)
    await db.commit()
    return {"id": str(acct.id), "is_active": acct.is_active}


@router.delete("/email-accounts/{account_id}", status_code=204)
async def delete_email_account(
    account_id: uuid.UUID,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> None:
    result = await db.execute(
        select(UGCEmailAccount).where(
            UGCEmailAccount.id == account_id, UGCEmailAccount.team_id == team_id
        )
    )
    acct = result.scalar_one_or_none()
    if not acct:
        raise _404()
    await db.delete(acct)
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Conversations (inbox)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(
    bucket: str = Query("all"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    q = (
        select(UGCConversation)
        .where(UGCConversation.team_id == team_id)
        .options(selectinload(UGCConversation.influencer))
    )
    if bucket == "review":
        q = q.where(UGCConversation.needs_review.is_(True))
    elif bucket == "ai_draft":
        # conversations that have pending AI drafts
        draft_subq = select(UGCAIDraft.conversation_id).where(
            UGCAIDraft.status == AIDraftStatus.pending
        ).subquery()
        q = q.where(UGCConversation.id.in_(select(draft_subq.c.conversation_id)))
    q = q.order_by(UGCConversation.last_message_at.desc().nullslast())

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.offset((page - 1) * per_page).limit(per_page))).scalars().all()

    items = []
    for conv in rows:
        inf = conv.influencer
        items.append({
            "id": str(conv.id),
            "influencer_id": str(conv.influencer_id),
            "influencer_name": inf.name if inf else "",
            "influencer_email": inf.email if inf else "",
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "unread_count": conv.unread_count,
            "ai_intent": conv.ai_intent,
            "ai_confidence": conv.ai_confidence,
            "needs_review": conv.needs_review,
            "latest_subject": conv.latest_subject,
        })
    return {"items": items, "total": total, "page": page, "per_page": per_page,
            "pages": max(1, -(-total // per_page))}


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: uuid.UUID,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCConversation)
        .where(UGCConversation.id == conversation_id, UGCConversation.team_id == team_id)
        .options(selectinload(UGCConversation.influencer))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise _404()
    messages = (await db.execute(
        select(UGCEmailMessage)
        .where(UGCEmailMessage.influencer_id == conv.influencer_id)
        .order_by(UGCEmailMessage.created_at.asc())
    )).scalars().all()
    drafts = (await db.execute(
        select(UGCAIDraft)
        .where(UGCAIDraft.conversation_id == conversation_id)
        .order_by(UGCAIDraft.created_at.desc())
    )).scalars().all()

    inf = conv.influencer
    return {
        "id": str(conv.id),
        "influencer": _inf_to_dict(inf) if inf else None,
        "ai_intent": conv.ai_intent,
        "ai_confidence": conv.ai_confidence,
        "needs_review": conv.needs_review,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "messages": [
            {
                "id": str(m.id), "direction": m.direction, "from_address": m.from_address,
                "to_address": m.to_address, "subject": m.subject,
                "body_html": m.body_html, "body_text": m.body_text,
                "status": m.status, "message_id": m.message_id,
                "sent_at": m.sent_at.isoformat() if m.sent_at else None,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
        "ai_drafts": [
            {
                "id": str(d.id), "subject": d.subject, "body_html": d.body_html,
                "status": d.status, "risk_level": d.risk_level, "risk_reason": d.risk_reason,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in drafts
        ],
    }


@router.patch("/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: uuid.UUID,
    data: dict,
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    result = await db.execute(
        select(UGCConversation).where(
            UGCConversation.id == conversation_id, UGCConversation.team_id == team_id
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise _404()
    for field, value in data.items():
        if hasattr(conv, field):
            setattr(conv, field, value)
    await db.commit()
    return {"id": str(conv.id), "needs_review": conv.needs_review}


# ─────────────────────────────────────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/analytics/dashboard")
async def dashboard(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    _: str = Authenticated,
    team_id: uuid.UUID = TeamId,
    db: AsyncSession = DB,
) -> Any:
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    inf_count = (await db.execute(
        select(func.count(UGCInfluencer.id)).where(UGCInfluencer.team_id == team_id)
    )).scalar() or 0

    camp_count = (await db.execute(
        select(func.count(UGCCampaign.id)).where(
            UGCCampaign.team_id == team_id, UGCCampaign.status == CampaignStatus.active
        )
    )).scalar() or 0

    email_q = await db.execute(
        select(
            func.count(case((
                and_(UGCEmailMessage.direction == EmailDirection.outbound,
                     UGCEmailMessage.status.in_(["sent", "delivered", "opened", "clicked"])),
                1))).label("sent"),
            func.count(case((
                and_(UGCEmailMessage.direction == EmailDirection.outbound,
                     UGCEmailMessage.status.in_(["delivered", "opened", "clicked"])),
                1))).label("delivered"),
            func.count(case((
                and_(UGCEmailMessage.direction == EmailDirection.outbound,
                     UGCEmailMessage.status.in_(["opened", "clicked"])),
                1))).label("opened"),
            func.count(case((
                and_(UGCEmailMessage.direction == EmailDirection.outbound,
                     UGCEmailMessage.status == "bounced"),
                1))).label("bounced"),
            func.count(case((UGCEmailMessage.direction == EmailDirection.inbound, 1))).label("replied"),
        )
        .where(
            UGCEmailMessage.team_id == team_id,
            func.date(UGCEmailMessage.created_at) >= start_date,
            func.date(UGCEmailMessage.created_at) <= end_date,
        )
    )
    es = email_q.one()
    sent = es.sent or 0
    delivered = es.delivered or 0
    opened = es.opened or 0
    bounced = es.bounced or 0
    replied = es.replied or 0

    daily_q = await db.execute(
        select(
            func.date(UGCEmailMessage.created_at).label("day"),
            func.count(case((
                and_(UGCEmailMessage.direction == EmailDirection.outbound,
                     UGCEmailMessage.status.in_(["sent", "delivered", "opened"])), 1))).label("sent"),
            func.count(case((
                and_(UGCEmailMessage.direction == EmailDirection.outbound,
                     UGCEmailMessage.status.in_(["opened", "clicked"])), 1))).label("opened"),
            func.count(case((UGCEmailMessage.direction == EmailDirection.inbound, 1))).label("replied"),
        )
        .where(
            UGCEmailMessage.team_id == team_id,
            func.date(UGCEmailMessage.created_at) >= start_date,
            func.date(UGCEmailMessage.created_at) <= end_date,
        )
        .group_by(func.date(UGCEmailMessage.created_at))
        .order_by(func.date(UGCEmailMessage.created_at))
    )

    return {
        "stats": {
            "total_influencers": inf_count,
            "active_campaigns": camp_count,
            "emails_sent": sent,
            "emails_delivered": delivered,
            "emails_opened": opened,
            "emails_replied": replied,
            "emails_bounced": bounced,
            "open_rate": round(opened / delivered * 100, 1) if delivered > 0 else 0.0,
            "reply_rate": round(replied / sent * 100, 1) if sent > 0 else 0.0,
            "bounce_rate": round(bounced / sent * 100, 1) if sent > 0 else 0.0,
        },
        "daily": [
            {
                "date": str(r.day), "emails_sent": r.sent or 0,
                "emails_opened": r.opened or 0, "emails_replied": r.replied or 0,
            }
            for r in daily_q.all()
        ],
    }
