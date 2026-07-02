from unittest.mock import AsyncMock, patch

import pytest


def test_enqueue_task_uses_asyncpg_safe_jsonb_cast() -> None:
    from app.core import task_utils

    source = task_utils.enqueue_task.__code__.co_consts
    sql = next(item for item in source if isinstance(item, str) and "INSERT INTO task" in item)

    assert "CAST(:payload AS JSONB)" in sql
    assert ":payload::jsonb" not in sql


@pytest.mark.asyncio
async def test_process_one_returns_false_when_no_task() -> None:
    from app.workers import main

    class SessionContext:
        async def __aenter__(self):
            return AsyncMock()

        async def __aexit__(self, exc_type, exc, tb):
            return None

    with (
        patch("app.workers.main.async_session_factory", return_value=SessionContext()),
        patch("app.workers.main._claim_task", new_callable=AsyncMock, return_value=None),
    ):
        assert await main._process_one() is False


@pytest.mark.asyncio
async def test_fail_task_retry_backoff_uses_power_expression() -> None:
    from app.workers.main import _fail_task

    session = AsyncMock()

    await _fail_task(session, task_id=1, error="boom", retry_count=0, max_retries=3)

    sql = str(session.execute.call_args.args[0])
    assert "POWER(2, retry_count)" in sql
    session.commit.assert_awaited_once()
