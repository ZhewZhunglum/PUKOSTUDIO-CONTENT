from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.mark.asyncio
async def test_add_assets_issues_one_insert_regardless_of_count() -> None:
    from app.modules.collection import service

    insert_result = MagicMock()
    insert_result.fetchall.return_value = [(1,), (2,), (3,)]
    update_result = MagicMock()
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[insert_result, update_result])

    added = await service.add_assets(db, col_id=1, asset_ids=[1, 2, 3])

    assert added == 3
    # One batched INSERT ... ON CONFLICT DO NOTHING + one asset_count UPDATE —
    # not one existence-check query per asset.
    assert db.execute.await_count == 2


@pytest.mark.asyncio
async def test_add_assets_counts_only_newly_inserted_rows() -> None:
    from app.modules.collection import service

    insert_result = MagicMock()
    insert_result.fetchall.return_value = [(2,)]  # asset 1 already in the collection
    update_result = MagicMock()
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[insert_result, update_result])

    added = await service.add_assets(db, col_id=1, asset_ids=[1, 2])

    assert added == 1
    assert db.execute.await_count == 2


@pytest.mark.asyncio
async def test_add_assets_short_circuits_on_empty_ids() -> None:
    from app.modules.collection import service

    db = AsyncMock()
    assert await service.add_assets(db, col_id=1, asset_ids=[]) == 0
    db.execute.assert_not_awaited()
