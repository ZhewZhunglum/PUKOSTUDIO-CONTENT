from datetime import UTC, datetime
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
