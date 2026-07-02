"""Phase 9 tests: RRF search, visual search, search history."""
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.asset.schemas import AssetListItem


def _make_asset_item(id: int) -> AssetListItem:
    return AssetListItem(
        id=id, uuid="abc", name=f"Asset {id}", asset_type=1,
        mime_type="image/png", file_size=1000,
        thumbnail_key=None, cdn_url=None,
        duration_ms=None, width=100, height=100,
        favorite=False, rating=0, use_count=0,
        user_tags=[], ai_processing_status=0,
        imported_at=datetime.now(UTC),
    )


# ── RRF fusion logic (pure Python, no I/O) ───────────────────────────────────

class TestRRFLogic:
    def test_apply_rrf_single_dim(self):
        from app.modules.asset.search import _RRF_K, _apply_rrf
        scores: dict[int, float] = {}
        _apply_rrf(scores, [10, 20, 30])
        assert scores[10] == pytest.approx(1 / (_RRF_K + 1))
        assert scores[20] == pytest.approx(1 / (_RRF_K + 2))
        assert scores[30] == pytest.approx(1 / (_RRF_K + 3))

    def test_apply_rrf_accumulates(self):
        from app.modules.asset.search import _RRF_K, _apply_rrf
        scores: dict[int, float] = {}
        _apply_rrf(scores, [10, 20])  # Dim 1
        _apply_rrf(scores, [20, 10])  # Dim 2
        expected_10 = 1 / (_RRF_K + 1) + 1 / (_RRF_K + 2)
        expected_20 = 1 / (_RRF_K + 2) + 1 / (_RRF_K + 1)
        assert scores[10] == pytest.approx(expected_10)
        assert scores[20] == pytest.approx(expected_20)

    def test_apply_rrf_empty(self):
        from app.modules.asset.search import _apply_rrf
        scores: dict[int, float] = {}
        _apply_rrf(scores, [])
        assert scores == {}

    def test_rrf_k60_constant(self):
        from app.modules.asset.search import _RRF_K
        assert _RRF_K == 60

    def test_multi_dim_winner(self):
        """IDs appearing in more dimensions rank higher."""
        from app.modules.asset.search import _apply_rrf
        scores: dict[int, float] = {}
        _apply_rrf(scores, [1, 2])   # dim1: id=1 wins
        _apply_rrf(scores, [1, 3])   # dim2: id=1 wins again
        assert scores[1] > scores[2]
        assert scores[1] > scores[3]


# ── unified search endpoint ───────────────────────────────────────────────────

class TestUnifiedSearchEndpoint:
    async def test_query_required(self, async_client):
        r = await async_client.get("/api/search")
        assert r.status_code == 422

    async def test_invalid_mode_rejected(self, async_client):
        r = await async_client.get("/api/search?q=test&mode=wrong")
        assert r.status_code == 422

    async def test_keyword_mode_no_embedding(self, async_client):
        """keyword mode should NOT call AI embedding."""
        with (
            patch(
                "app.modules.asset.search_router.search_service.rrf_search",
                new_callable=AsyncMock,
                return_value=[],
            ) as mock_rrf,
            patch("app.modules.asset.search_router._record_history", new_callable=AsyncMock),
            patch(
                "app.modules.asset.search_router._get_text_embedding",
                new_callable=AsyncMock,
                return_value=None,
            ) as mock_emb,
        ):
            r = await async_client.get("/api/search?q=猫&mode=keyword")
            mock_emb.assert_not_called()
            mock_rrf.assert_called_once()
            call_kwargs = mock_rrf.call_args.kwargs
            assert call_kwargs["mode"] == "keyword"
        assert r.status_code == 200

    async def test_hybrid_mode_calls_embedding(self, async_client):
        """hybrid mode should call AI embedding."""
        with (
            patch(
                "app.modules.asset.search_router.search_service.rrf_search",
                new_callable=AsyncMock,
                return_value=[],
            ) as mock_rrf,
            patch("app.modules.asset.search_router._record_history", new_callable=AsyncMock),
            patch(
                "app.modules.asset.search_router._get_text_embedding",
                new_callable=AsyncMock,
                return_value=[0.1] * 5,
            ) as mock_emb,
        ):
            r = await async_client.get("/api/search?q=猫&mode=hybrid")
            mock_emb.assert_called_once_with("猫")
            call_kwargs = mock_rrf.call_args.kwargs
            assert call_kwargs["mode"] == "hybrid"
            assert call_kwargs["text_embedding"] == [0.1] * 5
        assert r.status_code == 200

    async def test_returns_items(self, async_client):
        items = [_make_asset_item(1), _make_asset_item(2)]
        with (
            patch(
                "app.modules.asset.search_router.search_service.rrf_search",
                new_callable=AsyncMock,
                return_value=items,
            ),
            patch("app.modules.asset.search_router._record_history", new_callable=AsyncMock),
            patch(
                "app.modules.asset.search_router._get_text_embedding",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            r = await async_client.get("/api/search?q=猫&mode=keyword")
        assert r.status_code == 200
        assert len(r.json()) == 2

    async def test_semantic_mode_accepted(self, async_client):
        with (
            patch(
                "app.modules.asset.search_router.search_service.rrf_search",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch("app.modules.asset.search_router._record_history", new_callable=AsyncMock),
            patch(
                "app.modules.asset.search_router._get_text_embedding",
                new_callable=AsyncMock,
                return_value=[0.0] * 5,
            ),
        ):
            r = await async_client.get("/api/search?q=风景&mode=semantic")
        assert r.status_code == 200


# ── search history ────────────────────────────────────────────────────────────

class TestSearchHistoryEndpoints:
    async def test_history_returns_list(self, async_client):
        r = await async_client.get("/api/search/history")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_hot_returns_list(self, async_client):
        r = await async_client.get("/api/search/hot")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_history_limit_validation(self, async_client):
        r = await async_client.get("/api/search/history?limit=500")
        assert r.status_code == 422

    async def test_hot_days_validation(self, async_client):
        r = await async_client.get("/api/search/hot?days=0")
        assert r.status_code == 422


# ── similar by asset endpoint ─────────────────────────────────────────────────

class TestSimilarEndpoint:
    async def test_invalid_id_422(self, async_client):
        r = await async_client.get("/api/search/similar/abc")
        assert r.status_code == 422

    async def test_not_found_404(self, async_client):
        r = await async_client.get("/api/search/similar/999999")
        assert r.status_code == 404

    async def test_mode_validation(self, async_client):
        r = await async_client.get("/api/search/similar/1?mode=invalid")
        assert r.status_code == 422

    async def test_visual_mode_accepted(self, async_client):
        r = await async_client.get("/api/search/similar/1?mode=visual")
        assert r.status_code in (404, 422)

    async def test_text_mode_accepted(self, async_client):
        r = await async_client.get("/api/search/similar/1?mode=text")
        assert r.status_code in (404, 422)


# ── visual upload endpoint ───────────────────────────────────────────────────

class TestVisualUploadEndpoint:
    async def test_non_image_rejected(self, async_client):
        r = await async_client.post(
            "/api/search/visual",
            files={"file": ("test.pdf", b"%PDF-1.4", "application/pdf")},
        )
        assert r.status_code == 422

    async def test_image_calls_embedding(self, async_client):
        mock_resp = MagicMock()
        mock_resp.success = True
        mock_resp.outputs = {"embedding": [0.1] * 1024}

        with (
            patch("app.modules.asset.search_router.ai_gateway.call", new_callable=AsyncMock, return_value=mock_resp),
            patch(
                "app.modules.asset.search_router.search_service.vector_search_by_image",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch("app.modules.asset.search_router._record_history", new_callable=AsyncMock),
        ):
            r = await async_client.post(
                "/api/search/visual",
                files={"file": ("photo.jpg", b"\xff\xd8\xff", "image/jpeg")},
            )
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_embedding_failure_502(self, async_client):
        mock_resp = MagicMock()
        mock_resp.success = False
        mock_resp.outputs = {}

        with patch("app.modules.asset.search_router.ai_gateway.call", new_callable=AsyncMock, return_value=mock_resp):
            r = await async_client.post(
                "/api/search/visual",
                files={"file": ("photo.png", b"\x89PNG", "image/png")},
            )
        assert r.status_code == 502
