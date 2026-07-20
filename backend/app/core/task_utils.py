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
    task_ids = await enqueue_tasks(task_type, [payload], priority=priority, max_retries=max_retries)
    return task_ids[0]


async def enqueue_tasks(
    task_type: str,
    payloads: list[dict[str, Any]],
    priority: int = 5,
    max_retries: int = 3,
) -> list[int]:
    """Insert many same-type tasks in a single statement.

    Callers looping over hundreds of assets (bulk AI-tag, thumbnail backfill)
    were opening one session/transaction per task; this collapses that into
    one INSERT with multiple VALUES rows.
    """
    if not payloads:
        return []

    values_sql = ", ".join(
        f"(:uuid_{i}, :type, CAST(:payload_{i} AS JSONB), 'pending', :priority, :max_retries, NOW())"
        for i in range(len(payloads))
    )
    params: dict[str, Any] = {"type": task_type, "priority": priority, "max_retries": max_retries}
    for i, payload in enumerate(payloads):
        params[f"uuid_{i}"] = str(uuid.uuid4())
        params[f"payload_{i}"] = json.dumps(payload)

    async with async_session_factory() as session:
        # values_sql only ever interpolates the loop index into bind-parameter
        # NAMES (:uuid_0, :payload_0, ...); every actual value (task_type,
        # uuid, payload JSON) is passed through `params` as a bound parameter,
        # never string-formatted into the SQL text.
        sql = (
            "INSERT INTO task (uuid, type, payload, status, priority, max_retries, scheduled_at) "  # noqa: S608
            f"VALUES {values_sql} RETURNING id"
        )
        result = await session.execute(text(sql), params)
        await session.commit()
        return [row[0] for row in result.fetchall()]


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
