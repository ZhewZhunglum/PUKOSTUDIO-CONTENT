from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.template import service
from app.modules.template.schemas import TemplateCreate, TemplateOut, TemplateUpdate

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
async def list_templates(
    category: str | None = None,
    platform: str | None = None,
    template_type: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await service.list_templates(db, category=category, platform=platform, template_type=template_type)


@router.get("/{template_id}", response_model=TemplateOut)
async def get_template(template_id: int, db: AsyncSession = Depends(get_db)):
    tmpl = await service.get_template(db, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tmpl


@router.post("", response_model=TemplateOut, status_code=201)
async def create_template(data: TemplateCreate, db: AsyncSession = Depends(get_db)):
    tmpl = await service.create_template(db, data)
    await db.commit()
    return tmpl


@router.patch("/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: int, data: TemplateUpdate, db: AsyncSession = Depends(get_db)
):
    tmpl = await service.update_template(db, template_id, data)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.commit()
    return tmpl


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: int, db: AsyncSession = Depends(get_db)):
    ok = await service.delete_template(db, template_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.commit()


@router.post("/{template_id}/use", status_code=204)
async def use_template(template_id: int, db: AsyncSession = Depends(get_db)):
    tmpl = await service.get_template(db, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await service.increment_use_count(db, template_id)
    await db.commit()
