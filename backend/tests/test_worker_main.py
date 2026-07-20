from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_enqueue_tasks_uses_asyncpg_safe_jsonb_cast() -> None:
    from app.core import task_utils

    captured_sql: list[str] = []

    class FakeResult:
        def fetchall(self):
            return [(1,), (2,)]

    class FakeSession:
        async def execute(self, clause, params):
            captured_sql.append(str(clause))
            return FakeResult()

        async def commit(self):
            pass

    class SessionContext:
        async def __aenter__(self):
            return FakeSession()

        async def __aexit__(self, exc_type, exc, tb):
            return None

    with patch(
        "app.core.task_utils.async_session_factory", return_value=SessionContext()
    ):
        task_ids = await task_utils.enqueue_tasks("ai_tag", [{"asset_id": 1}, {"asset_id": 2}])

    assert task_ids == [1, 2]
    sql = captured_sql[0]
    assert "INSERT INTO task" in sql
    assert "CAST(:payload_0 AS JSONB)" in sql
    assert "CAST(:payload_1 AS JSONB)" in sql
    assert "::jsonb" not in sql


@pytest.mark.asyncio
async def test_enqueue_tasks_returns_empty_list_without_querying() -> None:
    from app.core import task_utils

    with patch("app.core.task_utils.async_session_factory") as mock_factory:
        result = await task_utils.enqueue_tasks("ai_tag", [])

    assert result == []
    mock_factory.assert_not_called()


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
