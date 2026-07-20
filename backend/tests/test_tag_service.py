from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.modules.tag.schemas import TagMergeRequest


def _tag_mock(tag_id: int = 1, name: str = "summer") -> MagicMock:
    tag = MagicMock()
    tag.id = tag_id
    tag.name = name
    tag.category = "场景"
    tag.parent_id = None
    tag.aliases = ["summer-vibes"]
    tag.color = None
    tag.description = None
    tag.use_count = 3
    tag.is_system = False
    tag.created_at = datetime.now(UTC)
    return tag


def test_tag_merge_allows_single_source_tag():
    req = TagMergeRequest(source_ids=[1], target_name="夏季")

    assert req.source_ids == [1]
    assert req.target_name == "夏季"


async def test_tag_merge_endpoint_delegates_to_service(client):
    target = _tag_mock(tag_id=9, name="夏季")
    with patch(
        "app.modules.tag.router.service.merge_tags",
        new_callable=AsyncMock,
        return_value=target,
    ) as mock_merge:
        resp = await client.post(
            "/api/tags/merge",
            json={"source_ids": [1], "target_name": "夏季"},
        )

    assert resp.status_code == 200
    assert resp.json()["aliases"] == ["summer-vibes"]
    mock_merge.assert_awaited_once()
    assert mock_merge.call_args.args[1] == [1]
    assert mock_merge.call_args.args[2] == "夏季"


async def test_asset_tag_routes_are_not_shadowed_by_tag_id_route(client):
    with patch(
        "app.modules.tag.router.service.get_tags_for_asset",
        new_callable=AsyncMock,
        return_value=[],
    ) as mock_get_tags:
        resp = await client.get("/api/tags/asset/123")

    assert resp.status_code == 200
    assert resp.json() == []
    mock_get_tags.assert_awaited_once()
    assert mock_get_tags.call_args.args[1] == 123


def _result(kind: str, value):
    r = MagicMock()
    if kind == "scalar_one_or_none":
        r.scalar_one_or_none.return_value = value
    elif kind == "scalars_all":
        r.scalars.return_value.all.return_value = value
    elif kind == "scalar":
        r.scalar.return_value = value
    return r


async def test_merge_tags_checks_target_links_once_not_per_row():
    from app.modules.tag.service import merge_tags

    target = _tag_mock(tag_id=1, name="target")
    target.aliases = []
    source_a = _tag_mock(tag_id=2, name="src-a")
    source_a.aliases = []
    source_b = _tag_mock(tag_id=3, name="src-b")
    source_b.aliases = ["alias-b"]

    # asset 100 is already linked to target — its src-a row must be dropped,
    # not relinked (would violate the asset_tag composite PK).
    at_conflict = SimpleNamespace(asset_id=100, tag_id=2)
    at_relink_a = SimpleNamespace(asset_id=200, tag_id=2)
    at_relink_b = SimpleNamespace(asset_id=300, tag_id=3)

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _result("scalar_one_or_none", target),  # get_or_create_tag
            _result("scalars_all", [100]),  # target_linked_ids fetch
            _result("scalar_one_or_none", source_a),  # get_tag(2)
            _result("scalars_all", [at_conflict, at_relink_a]),  # source 2's rows
            _result("scalar_one_or_none", source_b),  # get_tag(3)
            _result("scalars_all", [at_relink_b]),  # source 3's rows
            _result("scalar", 3),  # final use_count for target
        ]
    )

    with patch("app.modules.tag.service._sync_asset_user_tags", new_callable=AsyncMock):
        result = await merge_tags(db, [2, 3], "target")

    assert result is target
    # 7 calls total: no per-AssetTag-row existence check regardless of how
    # many rows each source tag had linked.
    assert db.execute.await_count == 7
    assert at_conflict.tag_id == 2  # left alone, deleted below instead of relinked
    assert at_relink_a.tag_id == 1
    assert at_relink_b.tag_id == 1
    db.delete.assert_any_call(at_conflict)
    db.delete.assert_any_call(source_a)
    db.delete.assert_any_call(source_b)
    assert target.use_count == 3
    assert target.aliases == ["alias-b", "src-a", "src-b"]


async def test_tag_category_rename_route_delegates_to_service(client):
    with patch(
        "app.modules.tag.router.service.rename_category",
        new_callable=AsyncMock,
        return_value=2,
    ) as mock_rename:
        resp = await client.patch(
            "/api/tags/categories/rename",
            json={"old_name": "场景", "new_name": "素材场景"},
        )

    assert resp.status_code == 200
    assert resp.json() == {"old_name": "场景", "new_name": "素材场景", "updated": 2}
    mock_rename.assert_awaited_once()
    assert mock_rename.call_args.args[1] == "场景"
    assert mock_rename.call_args.args[2] == "素材场景"
