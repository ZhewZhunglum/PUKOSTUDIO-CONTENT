"""Phase 8 tests: template CRUD, AI image cdn_url fix, asset schema fields."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.main import app
from app.modules.template.schemas import TemplateCreate, TemplateUpdate

# ── DB mock ─────────────────────────────────────────────────────────────────

def _make_mock_db():
    db = AsyncMock(spec=AsyncSession)
    db.execute = AsyncMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()
    return db


def _db_override(db):
    async def _inner():
        yield db
    return _inner


# ── Template CRUD ────────────────────────────────────────────────────────────

class TestTemplateAPI:
    @pytest.mark.asyncio
    async def test_list_templates_empty(self):
        db = _make_mock_db()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute.return_value = mock_result
        app.dependency_overrides[get_db] = _db_override(db)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.get("/api/templates")
        assert r.status_code == 200
        assert r.json() == []
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_create_template_missing_name_422(self):
        db = _make_mock_db()
        app.dependency_overrides[get_db] = _db_override(db)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.post("/api/templates", json={})
        assert r.status_code == 422
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_create_template_success(self):
        from datetime import UTC, datetime

        from app.modules.template.models import Template

        db = _make_mock_db()

        fake_tmpl = Template(
            id=1,
            name="测试模板",
            category="测评",
            template_type=1,
            platform="douyin",
            style="conversational",
            duration=30,
            description="测试",
            hooks=["钩子1"],
            outline=["步骤1"],
            cta="关注我",
            body=None,
            variables=[],
            is_builtin=False,
            use_count=0,
            status=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        async def fake_refresh(obj):
            pass

        db.refresh = fake_refresh

        async def fake_flush():
            fake_tmpl.id = 1

        db.flush = fake_flush

        app.dependency_overrides[get_db] = _db_override(db)

        with patch("app.modules.template.service.create_template", return_value=fake_tmpl):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                r = await client.post("/api/templates", json={
                    "name": "测试模板",
                    "category": "测评",
                    "platform": "douyin",
                    "duration": 30,
                    "hooks": ["钩子1"],
                    "outline": ["步骤1"],
                    "cta": "关注我",
                })
        assert r.status_code == 201
        assert r.json()["name"] == "测试模板"
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_template_not_found_404(self):
        db = _make_mock_db()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute.return_value = mock_result
        app.dependency_overrides[get_db] = _db_override(db)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.get("/api/templates/9999")
        assert r.status_code == 404
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_delete_template_not_found_404(self):
        db = _make_mock_db()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute.return_value = mock_result
        app.dependency_overrides[get_db] = _db_override(db)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.delete("/api/templates/9999")
        assert r.status_code == 404
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_update_template_not_found_404(self):
        db = _make_mock_db()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute.return_value = mock_result
        app.dependency_overrides[get_db] = _db_override(db)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.patch("/api/templates/9999", json={"name": "新名"})
        assert r.status_code == 404
        app.dependency_overrides.clear()


# ── TemplateCreate schema validation ────────────────────────────────────────

class TestTemplateSchemas:
    def test_create_defaults(self):
        t = TemplateCreate(name="My Template")
        assert t.template_type == 1
        assert t.hooks == []
        assert t.outline == []
        assert t.variables == []
        assert t.is_builtin is False

    def test_duration_validation(self):
        t = TemplateCreate(name="x", duration=30)
        assert t.duration == 30

    def test_name_required(self):
        with pytest.raises(ValidationError):
            TemplateCreate(name="")

    def test_update_all_optional(self):
        u = TemplateUpdate()
        assert u.name is None
        assert u.hooks is None

    def test_template_type_range(self):
        t1 = TemplateCreate(name="x", template_type=1)
        t2 = TemplateCreate(name="x", template_type=2)
        assert t1.template_type == 1
        assert t2.template_type == 2
        with pytest.raises(ValidationError):
            TemplateCreate(name="x", template_type=3)


# ── AssetCreate cdn_url field ────────────────────────────────────────────────

class TestAssetCreateSchema:
    def test_cdn_url_field_exists(self):
        from app.modules.asset.schemas import AssetCreate
        a = AssetCreate(
            name="test",
            storage_key="assets/test.png",
            asset_type=9,
            cdn_url="http://localhost:9000/assets/test.png",
            source_model="gpt-image-1",
            source_prompt="a cat",
        )
        assert a.cdn_url == "http://localhost:9000/assets/test.png"
        assert a.source_model == "gpt-image-1"
        assert a.source_prompt == "a cat"

    def test_cdn_url_optional(self):
        from app.modules.asset.schemas import AssetCreate
        a = AssetCreate(name="test", storage_key="key", asset_type=1)
        assert a.cdn_url is None
        assert a.source_model is None
        assert a.source_prompt is None


# ── AI image response includes cdn_urls ─────────────────────────────────────

class TestImageGenResponse:
    def test_cdn_urls_in_response_schema(self):
        from app.modules.ai.router import ImageGenResponse
        r = ImageGenResponse(
            images=["assets/ai_assets/2026/05/abc.png"],
            cdn_urls=["http://localhost:9000/contentforge-assets/assets/ai_assets/2026/05/abc.png"],
            model_used="gpt-image-1",
            cost_usd=0.04,
            asset_ids=[42],
        )
        assert len(r.cdn_urls) == 1
        assert "localhost" in r.cdn_urls[0]
        assert r.asset_ids == [42]
