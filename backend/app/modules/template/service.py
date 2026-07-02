from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.modules.template.models import Template
from app.modules.template.schemas import TemplateCreate, TemplateUpdate


async def list_templates(
    db: AsyncSession,
    category: str | None = None,
    platform: str | None = None,
    template_type: int | None = None,
) -> list[Template]:
    stmt = select(Template).where(Template.status == 1)
    if category:
        stmt = stmt.where(Template.category == category)
    if platform:
        stmt = stmt.where(Template.platform == platform)
    if template_type is not None:
        stmt = stmt.where(Template.template_type == template_type)
    stmt = stmt.order_by(Template.is_builtin.desc(), Template.use_count.desc(), Template.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_template(db: AsyncSession, template_id: int) -> Template | None:
    result = await db.execute(
        select(Template).where(Template.id == template_id, Template.status == 1)
    )
    return result.scalar_one_or_none()


async def create_template(db: AsyncSession, data: TemplateCreate) -> Template:
    now = utcnow()
    tmpl = Template(
        name=data.name,
        category=data.category,
        template_type=data.template_type,
        platform=data.platform,
        style=data.style,
        duration=data.duration,
        description=data.description,
        hooks=data.hooks,
        outline=data.outline,
        cta=data.cta,
        body=data.body,
        variables=data.variables,
        is_builtin=data.is_builtin,
        created_at=now,
        updated_at=now,
    )
    db.add(tmpl)
    await db.flush()
    await db.refresh(tmpl)
    return tmpl


async def update_template(db: AsyncSession, template_id: int, data: TemplateUpdate) -> Template | None:
    tmpl = await get_template(db, template_id)
    if not tmpl:
        return None
    patch = data.model_dump(exclude_none=True)
    patch["updated_at"] = utcnow()
    await db.execute(update(Template).where(Template.id == template_id).values(**patch))
    await db.refresh(tmpl)
    return tmpl


async def delete_template(db: AsyncSession, template_id: int) -> bool:
    tmpl = await get_template(db, template_id)
    if not tmpl:
        return False
    await db.execute(
        update(Template).where(Template.id == template_id).values(status=0, updated_at=utcnow())
    )
    return True


async def increment_use_count(db: AsyncSession, template_id: int) -> None:
    await db.execute(
        update(Template)
        .where(Template.id == template_id)
        .values(use_count=Template.use_count + 1, updated_at=utcnow())
    )
