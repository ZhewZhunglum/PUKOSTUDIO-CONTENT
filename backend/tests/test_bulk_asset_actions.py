"""Bulk favorite/delete/tag — the asset library's multi-select toolbar used to
fire one request per selected asset; these actions collapse that into a
single set-based query regardless of how many assets are selected."""
from unittest.mock import AsyncMock, MagicMock, patch

from app.modules.tag.models import Tag


def _tag(tag_id: int = 1, name: str = "launch", use_count: int = 0) -> Tag:
    return Tag(id=tag_id, name=name, use_count=use_count, is_system=False)


# ── Router: delegates to service ────────────────────────────────────────────


async def test_bulk_favorite_endpoint_delegates_to_service(client):
    with patch(
        "app.modules.asset.router.service.bulk_set_favorite",
        new_callable=AsyncMock,
        return_value=3,
    ) as mock_bulk:
        resp = await client.post(
            "/api/assets/bulk-favorite",
            json={"asset_ids": [1, 2, 3], "favorite": True},
        )

    assert resp.status_code == 200
    assert resp.json() == {"updated": 3}
    mock_bulk.assert_awaited_once()
    assert mock_bulk.call_args.args[1:] == ([1, 2, 3], True)


async def test_bulk_delete_endpoint_delegates_to_service(client):
    with patch(
        "app.modules.asset.router.service.bulk_soft_delete",
        new_callable=AsyncMock,
        return_value=2,
    ) as mock_bulk:
        resp = await client.post("/api/assets/bulk-delete", json={"asset_ids": [5, 6]})

    assert resp.status_code == 200
    assert resp.json() == {"updated": 2}
    mock_bulk.assert_awaited_once()
    assert mock_bulk.call_args.args[1:] == ([5, 6],)


async def test_bulk_tag_endpoint_delegates_to_service(client):
    with patch(
        "app.modules.tag.service.bulk_add_tag_to_assets",
        new_callable=AsyncMock,
        return_value=_tag(),
    ) as mock_bulk:
        resp = await client.post(
            "/api/assets/bulk-tag",
            json={"asset_ids": [7, 8, 9], "tag": "launch"},
        )

    assert resp.status_code == 200
    assert resp.json() == {"updated": 3}
    mock_bulk.assert_awaited_once()
    assert mock_bulk.call_args.args[1:] == ([7, 8, 9], "launch")
    assert mock_bulk.call_args.kwargs == {"source": 1}


async def test_bulk_endpoints_reject_empty_asset_ids(client):
    resp = await client.post("/api/assets/bulk-favorite", json={"asset_ids": [], "favorite": True})
    assert resp.status_code == 422


# ── Service: one query regardless of how many ids are passed ───────────────


async def test_bulk_set_favorite_issues_one_update():
    from app.modules.asset.service import bulk_set_favorite

    result = MagicMock()
    result.rowcount = 3
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    updated = await bulk_set_favorite(db, [1, 2, 3], True)

    assert updated == 3
    db.execute.assert_awaited_once()


async def test_bulk_set_favorite_short_circuits_on_empty_ids():
    from app.modules.asset.service import bulk_set_favorite

    db = AsyncMock()
    assert await bulk_set_favorite(db, [], True) == 0
    db.execute.assert_not_awaited()


async def test_bulk_soft_delete_issues_one_update():
    from app.modules.asset.service import bulk_soft_delete

    result = MagicMock()
    result.rowcount = 2
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    updated = await bulk_soft_delete(db, [5, 6])

    assert updated == 2
    db.execute.assert_awaited_once()


async def test_bulk_add_tag_to_assets_issues_fixed_query_count_regardless_of_size():
    from app.modules.tag.service import bulk_add_tag_to_assets

    tag = _tag()
    count_result = MagicMock()
    count_result.scalar.return_value = 25
    db = AsyncMock()
    db.execute = AsyncMock(return_value=count_result)

    with patch(
        "app.modules.tag.service.get_or_create_tag", new_callable=AsyncMock, return_value=tag
    ):
        result = await bulk_add_tag_to_assets(db, list(range(1, 26)), "launch", source=1)

    assert result is tag
    assert tag.use_count == 25
    # insert + use_count select + array_append update — 3 calls no matter how
    # many asset ids were passed (25 here).
    assert db.execute.await_count == 3


async def test_bulk_add_tag_to_assets_short_circuits_on_empty_asset_ids():
    from app.modules.tag.service import bulk_add_tag_to_assets

    tag = _tag()
    db = AsyncMock()

    with patch(
        "app.modules.tag.service.get_or_create_tag", new_callable=AsyncMock, return_value=tag
    ):
        result = await bulk_add_tag_to_assets(db, [], "launch", source=1)

    assert result is tag
    db.execute.assert_not_awaited()
