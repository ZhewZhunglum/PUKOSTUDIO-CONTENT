from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient


async def test_import_url_returns_existing_asset(client: AsyncClient):
    existing = MagicMock()
    existing.id = 123
    existing.name = "Already here"
    existing.asset_type = 2

    with (
        patch(
            "app.modules.asset.router.service.find_by_source_url",
            new_callable=AsyncMock,
            return_value=existing,
        ),
        patch("app.modules.asset.router.enqueue_task", new_callable=AsyncMock) as enqueue,
    ):
        resp = await client.post(
            "/api/assets/import-url",
            json={"url": "https://www.youtube.com/watch?v=abc"},
        )

    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "existing"
    assert data["task_id"] is None
    assert data["asset_id"] == 123
    enqueue.assert_not_awaited()


async def test_import_urls_batches_queued_existing_and_rejected(client: AsyncClient):
    existing = MagicMock()
    existing.id = 456
    existing.name = "Existing"
    existing.asset_type = 2

    async def find_existing(_db, url):
        if "vimeo.com" in url:
            return existing
        return None

    with (
        patch("app.modules.asset.router.service.find_by_source_url", side_effect=find_existing),
        patch("app.modules.asset.router.enqueue_task", new_callable=AsyncMock, return_value=99),
    ):
        resp = await client.post(
            "/api/assets/import-urls",
            json={
                "items": [
                    {"url": "https://www.tiktok.com/@x/video/1", "tags": ["launch"]},
                    {"url": "https://vimeo.com/123"},
                    {"url": "https://www.tiktok.com/@x/video/1"},
                    {"url": "not-a-url"},
                ]
            },
        )

    assert resp.status_code == 202
    data = resp.json()
    assert data["submitted"] == 1
    assert data["existing"] == 1
    assert data["rejected"] == 2
    assert [item["status"] for item in data["items"]] == [
        "queued",
        "existing",
        "rejected",
        "rejected",
    ]


async def test_import_url_status_includes_error_code(client: AsyncClient):
    from app.core.task_utils import TaskStatus

    with patch(
        "app.modules.asset.router.get_task_status",
        new_callable=AsyncMock,
        return_value=TaskStatus(status="failed", result=None, error="auth_required: sign in to confirm"),
    ):
        resp = await client.get("/api/assets/import-url/7")

    assert resp.status_code == 200
    assert resp.json()["error_code"] == "auth_required"


async def test_import_url_platforms_reports_registry(client: AsyncClient):
    resp = await client.get("/api/assets/import-url/platforms")

    assert resp.status_code == 200
    data = resp.json()
    assert data["extractor_count"] >= 0
    assert any(platform["key"] == "tiktok" for platform in data["platforms"])
    assert any(platform["tier"] == "generic_ytdlp" for platform in data["platforms"])


async def test_import_worker_existing_result_short_circuits():
    from app.workers.handlers import import_url

    existing = MagicMock()
    existing.id = 99
    existing.name = "Existing asset"
    existing.asset_type = 2

    with patch(
        "app.workers.handlers.import_url._find_existing_asset",
        new_callable=AsyncMock,
        return_value=existing,
    ):
        result = await import_url.handle_import_url({"url": "https://youtu.be/abc"})

    assert result["existing"] is True
    assert result["asset_id"] == 99
    assert result["platform_key"] == "youtube"


def test_import_worker_error_classification():
    from app.workers.handlers.import_url import _classify_error

    assert _classify_error(Exception("Please sign in and pass cookies")) == "auth_required"
    assert _classify_error(Exception("not available in your country")) == "geo_restricted"
    assert _classify_error(Exception("Unsupported URL")) == "unsupported_url"
    assert _classify_error(Exception("file is larger than max-filesize")) == "too_large"
    assert _classify_error(Exception("connection reset")) == "download_failed"
