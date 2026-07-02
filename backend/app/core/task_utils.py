"""Thin helpers for enqueuing tasks into the PostgreSQL task table."""
import json
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory


@dataclass(frozen=True)
class TaskStatus:
    status: str
    result: dict[str, Any] | None
    error: str | None


async def enqueue_task(
    task_type: str,
    payload: dict[str, Any],
    priority: int = 5,
    max_retries: int = 3,
) -> int:
    async with async_session_factory() as session:
        result = await session.execute(
            text("""
                INSERT INTO task (uuid, type, payload, status, priority, max_retries, scheduled_at)
                VALUES (:uuid, :type, CAST(:payload AS JSONB), 'pending', :priority, :max_retries, NOW())
                RETURNING id
            """),
            {
                "uuid": str(uuid.uuid4()),
                "type": task_type,
                "payload": json.dumps(payload),
                "priority": priority,
                "max_retries": max_retries,
            },
        )
        await session.commit()
        return result.scalar_one()


async def get_task_status(db: AsyncSession, task_id: int) -> TaskStatus | None:
    result = await db.execute(
        text("SELECT status, result, error FROM task WHERE id = :id"),
        {"id": task_id},
    )
    row = result.mappings().first()
    if not row:
        return None
    return TaskStatus(
        status=row["status"],
        result=row["result"],
        error=row["error"],
    )
