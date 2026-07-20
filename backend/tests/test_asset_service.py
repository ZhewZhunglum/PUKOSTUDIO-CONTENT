from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.dialects import postgresql

from app.modules.asset.schemas import AssetListRequest, AssetSearchRequest
from app.modules.asset.service import (
    _build_list_query,
    _build_search_query,
    _escape_like,
    find_existing_by_source_urls,
)


def test_asset_list_search_covers_long_term_metadata_fields():
    query = _build_list_query(AssetListRequest(search="launch clip"))
    compiled = query.compile(dialect=postgresql.dialect())
    sql = str(compiled)

    assert "asset.name ILIKE" in sql
    assert "asset.original_filename ILIKE" in sql
    assert "asset.description ILIKE" in sql
    assert "asset.ai_description ILIKE" in sql
    assert "asset.ocr_text ILIKE" in sql
    assert "asset.asr_text ILIKE" in sql
    assert "asset.user_tags @>" in sql
    assert "asset.smart_tags @>" in sql


def test_asset_list_search_escapes_like_wildcards():
    assert _escape_like(r"100%_cotton\raw") == r"100\%\_cotton\\raw"


async def test_find_existing_by_source_urls_maps_by_url_in_one_query():
    asset_a = SimpleNamespace(id=1, source_url="https://vimeo.com/1")
    asset_b = SimpleNamespace(id=2, source_url="https://vimeo.com/2")
    result = MagicMock()
    result.scalars.return_value.all.return_value = [asset_a, asset_b]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    found = await find_existing_by_source_urls(
        db, ["https://vimeo.com/1", "https://vimeo.com/2", "https://vimeo.com/3"]
    )

    assert found == {"https://vimeo.com/1": asset_a, "https://vimeo.com/2": asset_b}
    db.execute.assert_awaited_once()


async def test_find_existing_by_source_urls_skips_query_when_empty():
    db = AsyncMock()

    found = await find_existing_by_source_urls(db, [])

    assert found == {}
    db.execute.assert_not_awaited()


def test_asset_structured_search_applies_filters_and_keyword_fields():
    req = AssetSearchRequest(
        query="summer beach",
        keyword="vlog",
        filters={
            "asset_type": [1, 2],
            "duration_ms": {"gte": 5000, "lte": 30000},
            "width": {"gte": 1080},
            "tags_all": ["夏季"],
            "tags_not": ["低质"],
            "favorite": True,
            "rating_gte": 4,
            "sku_id": 9,
            "brand_id": 3,
            "project_id": 7,
        },
    )
    compiled = _build_search_query(req).compile(dialect=postgresql.dialect())
    sql = str(compiled)

    assert "asset.asset_type IN" in sql
    assert "asset.duration_ms >=" in sql
    assert "asset.duration_ms <=" in sql
    assert "asset.width >=" in sql
    assert "asset.user_tags @>" in sql
    assert "asset.favorite = true" in sql
    assert "asset.rating >=" in sql
    assert "asset.sku_id =" in sql
    assert "asset.brand_id =" in sql
    assert "asset.project_id =" in sql
    assert compiled.params["name_1"] == "%summer beach vlog%"


async def test_asset_search_endpoint_delegates_to_service(client):
    mocked_response = {"items": [], "next_cursor": None, "total_hint": 0}
    with patch(
        "app.modules.asset.router.service.search_assets",
        new_callable=AsyncMock,
        return_value=mocked_response,
    ) as mock_search:
        resp = await client.post(
            "/api/assets/search",
            json={"query": "summer", "filters": {"asset_type": [1]}, "limit": 20},
        )

    assert resp.status_code == 200
    assert resp.json() == mocked_response
    req = mock_search.call_args.args[1]
    assert req.query == "summer"
    assert req.filters.asset_type == [1]
    assert req.limit == 20


async def test_asset_facets_endpoint_delegates_to_service(client):
    mocked_response = {
        "by_type": {"1": 12, "2": 4},
        "top_tags": [{"name": "summer", "use_count": 8}],
    }
    with patch(
        "app.modules.asset.router.service.get_facets",
        new_callable=AsyncMock,
        return_value=mocked_response,
    ) as mock_facets:
        resp = await client.get("/api/assets/facets")

    assert resp.status_code == 200
    assert resp.json() == mocked_response
    mock_facets.assert_awaited_once()
