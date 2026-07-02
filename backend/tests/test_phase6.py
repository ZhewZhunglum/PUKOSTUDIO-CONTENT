"""Phase 6 tests: collections detail endpoint, cache utilities, rate limiter."""
import json
from datetime import UTC
from unittest.mock import AsyncMock, MagicMock, patch

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app


def _mock_db():
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.get = AsyncMock(return_value=None)
    session.add = MagicMock()
    return session


@pytest_asyncio.fixture
async def client():
    app.dependency_overrides[get_db] = _mock_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
    app.dependency_overrides.clear()


# ── Collection detail endpoint ──────────────────────────────────────────────

class TestCollectionDetail:
    async def test_collection_not_found_returns_404(self, client: AsyncClient):
        with patch(
            "app.modules.collection.router.service.get_collection",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await client.get("/api/collections/999/assets/detail")
        assert resp.status_code == 404

    async def test_collection_found_returns_assets(self, client: AsyncClient):
        from datetime import datetime

        col_mock = MagicMock()
        col_mock.id = 1

        asset_mock = MagicMock()
        asset_mock.id = 10
        asset_mock.uuid = "test-uuid-1234"
        asset_mock.name = "Test Image"
        asset_mock.description = None
        asset_mock.asset_type = 1
        asset_mock.asset_subtype = None
        asset_mock.mime_type = "image/jpeg"
        asset_mock.file_format = "jpg"
        asset_mock.file_size = 102400
        asset_mock.file_md5 = None
        asset_mock.storage_key = "images/test.jpg"
        asset_mock.thumbnail_key = None
        asset_mock.preview_key = None
        asset_mock.cdn_url = None
        asset_mock.duration_ms = None
        asset_mock.width = 1920
        asset_mock.height = 1080
        asset_mock.fps = None
        asset_mock.has_audio = None
        asset_mock.color_palette = None
        asset_mock.user_tags = ["nature"]
        asset_mock.ai_tags = None
        asset_mock.smart_tags = None
        asset_mock.ai_description = None
        asset_mock.source = 1
        asset_mock.source_url = None
        asset_mock.source_platform = None
        asset_mock.source_extractor = None
        asset_mock.source_model = None
        asset_mock.source_prompt = None
        asset_mock.favorite = False
        asset_mock.rating = 0
        asset_mock.use_count = 0
        asset_mock.view_count = 0
        asset_mock.status = 1
        asset_mock.is_deleted = False
        asset_mock.ai_processing_status = 0
        asset_mock.imported_at = datetime.now(UTC)
        asset_mock.updated_at = datetime.now(UTC)
        asset_mock.captured_at = None

        with (
            patch(
                "app.modules.collection.router.service.get_collection",
                new_callable=AsyncMock,
                return_value=col_mock,
            ),
            patch(
                "app.modules.collection.router.service.get_collection_assets",
                new_callable=AsyncMock,
                return_value=[asset_mock],
            ),
        ):
            resp = await client.get("/api/collections/1/assets/detail")

        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["id"] == 10
        assert data[0]["name"] == "Test Image"

    async def test_empty_collection_returns_empty_list(self, client: AsyncClient):
        col_mock = MagicMock()
        col_mock.id = 2

        with (
            patch(
                "app.modules.collection.router.service.get_collection",
                new_callable=AsyncMock,
                return_value=col_mock,
            ),
            patch(
                "app.modules.collection.router.service.get_collection_assets",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            resp = await client.get("/api/collections/2/assets/detail")

        assert resp.status_code == 200
        assert resp.json() == []


class TestTaskStatusEndpoints:
    async def test_ai_collect_status_uses_task_error(self, client: AsyncClient):
        from app.core.task_utils import TaskStatus

        with patch(
            "app.modules.collection.router.get_task_status",
            new_callable=AsyncMock,
            return_value=TaskStatus(status="failed", result=None, error="collect failed"),
        ):
            resp = await client.get("/api/collections/ai-collect/7")

        assert resp.status_code == 200
        assert resp.json()["error"] == "collect failed"

    async def test_import_url_status_uses_task_error(self, client: AsyncClient):
        from app.core.task_utils import TaskStatus

        with patch(
            "app.modules.asset.router.get_task_status",
            new_callable=AsyncMock,
            return_value=TaskStatus(status="failed", result=None, error="download failed"),
        ):
            resp = await client.get("/api/assets/import-url/9")

        assert resp.status_code == 200
        assert resp.json()["error"] == "download failed"


# ── Cache utilities ─────────────────────────────────────────────────────────

class TestCacheUtils:
    async def test_cache_get_miss_returns_none(self):
        from app.core.cache import cache_get
        with patch("app.core.cache.get_redis") as mock_get:
            r = AsyncMock()
            r.get = AsyncMock(return_value=None)
            mock_get.return_value = r
            result = await cache_get("nonexistent:key")
        assert result is None

    async def test_cache_get_hit_deserializes_json(self):
        from app.core.cache import cache_get
        payload = {"total": 5, "by_type": {"1": 3}}
        with patch("app.core.cache.get_redis") as mock_get:
            r = AsyncMock()
            r.get = AsyncMock(return_value=json.dumps(payload))
            mock_get.return_value = r
            result = await cache_get("stats:overview")
        assert result == payload

    async def test_cache_set_serializes_and_stores(self):
        from app.core.cache import cache_set
        with patch("app.core.cache.get_redis") as mock_get:
            r = AsyncMock()
            r.set = AsyncMock()
            mock_get.return_value = r
            await cache_set("test:key", {"x": 1}, ttl=120)
        r.set.assert_called_once()
        call_args = r.set.call_args
        assert call_args[0][0] == "test:key"
        assert json.loads(call_args[0][1]) == {"x": 1}
        assert call_args[1].get("ex") == 120

    async def test_cache_delete_calls_redis(self):
        from app.core.cache import cache_delete
        with patch("app.core.cache.get_redis") as mock_get:
            r = AsyncMock()
            r.delete = AsyncMock()
            mock_get.return_value = r
            await cache_delete("stats:overview")
        r.delete.assert_called_once_with("stats:overview")

    async def test_cache_get_swallows_redis_error(self):
        from app.core.cache import cache_get
        with patch("app.core.cache.get_redis") as mock_get:
            r = AsyncMock()
            r.get = AsyncMock(side_effect=Exception("Connection refused"))
            mock_get.return_value = r
            result = await cache_get("any:key")
        assert result is None  # Does not raise

    async def test_cache_set_swallows_redis_error(self):
        from app.core.cache import cache_set
        with patch("app.core.cache.get_redis") as mock_get:
            r = AsyncMock()
            r.set = AsyncMock(side_effect=Exception("Connection refused"))
            mock_get.return_value = r
            await cache_set("any:key", {"data": 1})  # Must not raise

    async def test_cache_delete_pattern_uses_scan_iter(self):
        from app.core.cache import cache_delete_pattern

        async def scan_iter(match: str, count: int):
            assert match == "stats:*"
            assert count == 200
            for key in ("stats:overview", "stats:storage"):
                yield key

        with patch("app.core.cache.get_redis") as mock_get:
            r = MagicMock()
            r.scan_iter = scan_iter
            r.delete = AsyncMock()
            mock_get.return_value = r
            await cache_delete_pattern("stats:*")

        r.delete.assert_awaited_once_with("stats:overview", "stats:storage")


# ── Storage utilities ───────────────────────────────────────────────────────

class TestStorageClient:
    async def test_check_health_runs_sync_client_in_thread(self):
        from app.core.storage import storage

        with patch.object(storage, "_check_health_sync", return_value=True) as mock_check:
            assert await storage.check_health() is True
        mock_check.assert_called_once()


# ── Task status helpers ─────────────────────────────────────────────────────

class TestTaskStatusHelpers:
    async def test_get_task_status_reads_task_error_column(self):
        from app.core.task_utils import get_task_status

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.mappings.return_value.first.return_value = {
            "status": "failed",
            "result": None,
            "error": "boom",
        }
        db.execute = AsyncMock(return_value=mock_result)

        task = await get_task_status(db, 42)

        assert task is not None
        assert task.status == "failed"
        assert task.error == "boom"
        sql = str(db.execute.call_args.args[0])
        assert "error FROM task" in sql
        assert "error_message" not in sql


# ── Rate limiter ─────────────────────────────────────────────────────────────

class TestRateLimiter:
    def test_rate_limit_config_has_ai_paths(self):
        from app.core.rate_limit import _LIMITS
        assert "/api/ai/" in _LIMITS
        assert "/api/analyzer/" in _LIMITS
        assert "/api/pipeline/" in _LIMITS

    def test_rate_limit_config_values_are_tuples(self):
        from app.core.rate_limit import _LIMITS
        for _path, config in _LIMITS.items():
            assert isinstance(config, tuple)
            assert len(config) == 2
            max_calls, window = config
            assert max_calls > 0
            assert window > 0

    async def test_stats_overview_cached(self, client: AsyncClient):
        cached_data = {
            "assets": {"total": 10, "by_type": {}},
            "video_projects": {"total": 0, "by_status": {}},
            "tasks": {"by_status": {}},
            "ai_calls": {"total": 0, "total_cost_usd": 0.0},
            "tags": {"total": 0},
            "collections": {"total": 0},
            "pipelines": {"by_status": {}},
        }
        with patch("app.modules.stats.router.cache_get", new_callable=AsyncMock, return_value=cached_data):
            resp = await client.get("/api/stats/overview")
        assert resp.status_code == 200
        assert resp.json()["assets"]["total"] == 10


# ── Collection service: get_collection_assets ────────────────────────────────

class TestCollectionService:
    async def test_get_collection_assets_joins_asset(self):
        """get_collection_assets executes a SELECT with JOIN."""
        from app.modules.collection import service

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=mock_result)

        result = await service.get_collection_assets(db, col_id=1)
        assert result == []
        db.execute.assert_called_once()

    async def test_get_collection_asset_ids_returns_list(self):
        from app.modules.collection import service

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [1, 2, 3]
        db.execute = AsyncMock(return_value=mock_result)

        ids = await service.get_collection_asset_ids(db, col_id=5)
        assert ids == [1, 2, 3]
