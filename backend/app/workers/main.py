"""
ContentForge asyncio Worker
Polls the task table and dispatches to registered handlers.
Run: python -m app.workers.main
"""
import asyncio
import json
import os
import signal
import socket
from collections.abc import Callable, Coroutine
from typing import Any

from loguru import logger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.core.logger import setup_logger
from app.workers.registry import _HANDLERS, register_handler  # noqa: F401 (re-exported for back-compat)

WORKER_ID = f"{socket.gethostname()}-{os.getpid()}"
POLL_INTERVAL = 2.0  # seconds
CONCURRENCY = int(os.getenv("WORKER_CONCURRENCY", "4"))

_shutdown = asyncio.Event()


async def _claim_task(session: AsyncSession) -> dict[str, Any] | None:
    """Atomically claim one pending task using SKIP LOCKED."""
    result = await session.execute(
        text("""
            UPDATE task
            SET status = 'running',
                started_at = NOW(),
                worker_id = :worker_id
            WHERE id = (
                SELECT id FROM task
                WHERE status = 'pending'
                  AND scheduled_at <= NOW()
                ORDER BY priority DESC, scheduled_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, uuid, type, payload, retry_count, max_retries
        """),
        {"worker_id": WORKER_ID},
    )
    await session.commit()
    row = result.fetchone()
    return dict(row._mapping) if row else None


async def _complete_task(
    session: AsyncSession, task_id: int, result: dict[str, Any]
) -> None:
    await session.execute(
        text("""
            UPDATE task
            SET status = 'done', result = CAST(:result AS JSON), finished_at = NOW(), progress = 100
            WHERE id = :id
        """),
        {"id": task_id, "result": json.dumps(result)},
    )
    await session.commit()


async def _fail_task(
    session: AsyncSession, task_id: int, error: str, retry_count: int, max_retries: int
) -> None:
    if retry_count < max_retries:
        await session.execute(
            text("""
                UPDATE task
                SET status = 'pending',
                    retry_count = retry_count + 1,
                    error = :error,
                    worker_id = NULL,
                    scheduled_at = NOW() + (POWER(2, retry_count) * interval '10 seconds')
                WHERE id = :id
            """),
            {"id": task_id, "error": error},
        )
    else:
        await session.execute(
            text("""
                UPDATE task
                SET status = 'failed', error = :error, finished_at = NOW()
                WHERE id = :id
            """),
            {"id": task_id, "error": error},
        )
    await session.commit()


async def _process_one() -> bool:
    """Try to claim and process one task. Returns True if a task was processed."""
    async with async_session_factory() as session:
        task = await _claim_task(session)
        if not task:
            return False

    task_id: int = task["id"]
    task_type: str = task["type"]
    payload: dict[str, Any] = task["payload"]
    retry_count: int = task["retry_count"]
    max_retries: int = task["max_retries"]

    handler = _HANDLERS.get(task_type)
    if not handler:
        async with async_session_factory() as session:
            await _fail_task(session, task_id, f"No handler for task type: {task_type}", retry_count, max_retries)
        logger.warning(f"No handler for task type: {task_type}")
        return True

    logger.info(f"Processing task {task_id} type={task_type}")
    try:
        result = await handler(payload)
        async with async_session_factory() as session:
            await _complete_task(session, task_id, result)
        logger.info(f"Task {task_id} completed")
    except Exception as exc:
        logger.exception(f"Task {task_id} failed: {exc}")
        async with async_session_factory() as session:
            await _fail_task(session, task_id, str(exc), retry_count, max_retries)

    return True


async def _consumer(slot: int) -> None:
    """One independent consumer slot: claims and processes tasks until shutdown.

    Slots never wait on each other — a long-running task in one slot does not
    stop the other slots from claiming new work.
    """
    while not _shutdown.is_set():
        try:
            did_work = await _process_one()
        except Exception as exc:
            # e.g. DB temporarily unreachable during claim — back off and retry
            logger.warning(f"consumer {slot}: claim/process error: {exc}")
            did_work = False

        if not did_work:
            try:
                await asyncio.wait_for(_shutdown.wait(), timeout=POLL_INTERVAL)
            except TimeoutError:
                pass


async def worker_loop() -> None:
    logger.info(f"Worker ready — id={WORKER_ID} concurrency={CONCURRENCY}")
    await asyncio.gather(*(_consumer(i) for i in range(CONCURRENCY)))


def _handle_signal() -> None:
    logger.info("Shutdown signal received, draining workers…")
    _shutdown.set()


if __name__ == "__main__":
    setup_logger()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _handle_signal)

    # Import handlers so they self-register via @register_handler
    import app.workers.handlers  # noqa: F401

    try:
        loop.run_until_complete(worker_loop())
    finally:
        loop.close()
    logger.info("Worker stopped")
