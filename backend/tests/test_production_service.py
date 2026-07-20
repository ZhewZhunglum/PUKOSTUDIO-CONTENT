from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.production.schemas import ProductionCreate


@pytest.mark.asyncio
async def test_create_production_rejects_missing_asset() -> None:
    from app.modules.production import service

    db = AsyncMock()
    with patch(
        "app.modules.production.service._get_valid_production_asset",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(service.ProductionAssetError):
            await service.create_production(db, ProductionCreate(asset_id=999, title="Launch"))

    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_create_production_accepts_video_asset() -> None:
    from app.modules.production import service

    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()

    with patch(
        "app.modules.production.service._get_valid_production_asset",
        new_callable=AsyncMock,
        return_value=MagicMock(),
    ):
        prod = await service.create_production(
            db,
            ProductionCreate(
                asset_id=10,
                title="Launch",
                platform="tiktok",
                published_at=datetime.now(UTC).replace(tzinfo=None),
            ),
        )

    assert prod.asset_id == 10
    assert prod.platform == "tiktok"
    db.add.assert_called_once()
    db.flush.assert_awaited_once()


def _production(prod_id: int, asset_id: int):
    from app.modules.production.models import Production

    now = datetime.now(UTC).replace(tzinfo=None)
    return Production(
        id=prod_id, asset_id=asset_id, title=f"Prod {prod_id}",
        status=0, created_at=now, updated_at=now,
    )


def _asset(asset_id: int, name: str):
    from app.modules.asset.models import Asset

    return Asset(id=asset_id, name=name, storage_key=f"assets/{asset_id}")


def _ad(ad_id: int, production_id: int):
    from app.modules.production.models import AdPerformance

    now = datetime.now(UTC).replace(tzinfo=None)
    return AdPerformance(
        id=ad_id, production_id=production_id, currency="USD",
        created_at=now, updated_at=now,
    )


@pytest.mark.asyncio
async def test_list_productions_batches_asset_and_ad_lookups() -> None:
    from app.modules.production import service

    prods = [_production(1, 100), _production(2, 200), _production(3, 100)]
    assets_result = MagicMock()
    assets_result.scalars.return_value = [_asset(100, "Video A"), _asset(200, "Video B")]
    ads_result = MagicMock()
    ads_result.scalars.return_value = [_ad(1, 1), _ad(2, 1), _ad(3, 3)]

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[assets_result, ads_result])

    items = await service._enrich_many(db, prods)

    # One query for all assets + one for all ad performances, regardless of
    # how many production rows are being enriched — not 2 per row.
    assert db.execute.await_count == 2
    assert [i.asset_name for i in items] == ["Video A", "Video B", "Video A"]
    assert len(items[0].ad_performances) == 2
    assert len(items[1].ad_performances) == 0
    assert len(items[2].ad_performances) == 1


@pytest.mark.asyncio
async def test_enrich_many_returns_empty_list_without_querying() -> None:
    from app.modules.production import service

    db = AsyncMock()
    assert await service._enrich_many(db, []) == []
    db.execute.assert_not_awaited()
