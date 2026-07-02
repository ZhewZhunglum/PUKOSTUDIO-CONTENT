from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.modules.project.models import Project
from app.modules.project.schemas import ProjectCreate, ProjectUpdate


async def create_project(db: AsyncSession, data: ProjectCreate) -> Project:
    now = utcnow()
    project = Project(
        **data.model_dump(),
        created_at=now,
        updated_at=now,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def get_project(db: AsyncSession, project_id: int) -> Project | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def list_projects(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
    status: int | None = None,
) -> list[Project]:
    query = select(Project)
    if status is not None:
        query = query.where(Project.status == status)
    query = query.order_by(Project.id.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_project(
    db: AsyncSession, project_id: int, data: ProjectUpdate
) -> Project | None:
    project = await get_project(db, project_id)
    if project is None:
        return None
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(project, field, value)
    project.updated_at = utcnow()
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project_id: int) -> bool:
    project = await get_project(db, project_id)
    if project is None:
        return False
    await db.delete(project)
    await db.commit()
    return True
