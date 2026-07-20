from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.pipeline.schemas import OneClickRequest


@pytest.mark.asyncio
async def test_create_run_persists_request_fields() -> None:
    from app.modules.pipeline import service

    db = AsyncMock()
    db.add = MagicMock()

    run = await service.create_run(
        db, OneClickRequest(product_name="Widget", platform="tiktok", clip_count=4)
    )

    assert run.product_name == "Widget"
    assert run.platform == "tiktok"
    assert run.clip_count == 4
    assert run.status == 0
    assert run.stage == "queued"
    db.add.assert_called_once_with(run)
    db.flush.assert_awaited_once()
    db.refresh.assert_awaited_once_with(run)


@pytest.mark.asyncio
async def test_list_runs_orders_by_created_at_desc() -> None:
    from app.modules.pipeline import service

    result = MagicMock()
    result.scalars.return_value.all.return_value = ["run2", "run1"]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    runs = await service.list_runs(db, limit=10)

    assert runs == ["run2", "run1"]
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_run_delegates_to_session_get() -> None:
    from app.modules.pipeline import service

    db = AsyncMock()
    db.get = AsyncMock(return_value="a-run")

    run = await service.get_run(db, 7)

    assert run == "a-run"
    db.get.assert_awaited_once()
