import io
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from PIL import Image

from app.modules.asset.thumbnails import THUMBNAIL_MAX_WIDTH, _downscale_image_to_jpeg
from app.modules.tag.service import delete_tag


def _png_bytes(width: int, height: int) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(120, 40, 200)).save(buf, "PNG")
    return buf.getvalue()


def test_downscale_image_produces_bounded_jpeg():
    thumb = _downscale_image_to_jpeg(_png_bytes(2400, 1200))

    assert thumb is not None
    with Image.open(io.BytesIO(thumb)) as img:
        assert img.format == "JPEG"
        assert img.width == THUMBNAIL_MAX_WIDTH
        assert img.height == 480


def test_downscale_image_keeps_small_images_unscaled():
    thumb = _downscale_image_to_jpeg(_png_bytes(200, 100))

    assert thumb is not None
    with Image.open(io.BytesIO(thumb)) as img:
        assert (img.width, img.height) == (200, 100)


def test_downscale_image_converts_rgba_to_rgb():
    buf = io.BytesIO()
    Image.new("RGBA", (100, 100), color=(120, 40, 200, 128)).save(buf, "PNG")

    thumb = _downscale_image_to_jpeg(buf.getvalue())

    assert thumb is not None
    with Image.open(io.BytesIO(thumb)) as img:
        assert img.format == "JPEG"


async def test_delete_tag_unlinks_assets_and_strips_user_tags():
    tag = MagicMock()
    tag.is_system = False
    tag.name = "summer"

    linked_result = MagicMock()
    linked_result.scalars.return_value.all.return_value = [11, 22]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=linked_result)

    with patch("app.modules.tag.service.get_tag", new_callable=AsyncMock, return_value=tag):
        assert await delete_tag(db, tag_id=5) is True

    db.delete.assert_awaited_once_with(tag)
    # select linked assets + delete asset_tag rows + one bulk user_tags update
    assert db.execute.await_count == 3


async def test_delete_tag_refuses_system_tags():
    tag = MagicMock()
    tag.is_system = True
    db = AsyncMock()

    with patch("app.modules.tag.service.get_tag", new_callable=AsyncMock, return_value=tag):
        assert await delete_tag(db, tag_id=5) is False

    db.delete.assert_not_awaited()


def _asset_stub(asset_id: int = 7, asset_type: int = 1) -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=asset_id,
        uuid="u-1",
        name="pic.png",
        description=None,
        asset_type=asset_type,
        asset_subtype=None,
        mime_type="image/png",
        file_format="png",
        file_size=10,
        file_md5=None,
        storage_key="assets/image/x.png",
        thumbnail_key=None,
        preview_key=None,
        cdn_url=None,
        duration_ms=None,
        width=None,
        height=None,
        fps=None,
        has_audio=None,
        color_palette=None,
        user_tags=["产品图"],
        ai_tags=None,
        smart_tags=None,
        ai_description=None,
        source=1,
        source_url=None,
        source_platform=None,
        source_extractor=None,
        source_model=None,
        source_prompt=None,
        favorite=False,
        rating=0,
        use_count=0,
        view_count=0,
        status=1,
        is_deleted=False,
        ai_processing_status=0,
        imported_at=now,
        updated_at=now,
        captured_at=None,
    )


async def test_upload_complete_passes_tags_and_enqueues_thumbnail(client):
    asset = _asset_stub()
    with (
        patch(
            "app.modules.asset.router.service.create_asset",
            new_callable=AsyncMock,
            return_value=asset,
        ) as mock_create,
        patch(
            "app.modules.asset.router.enqueue_task", new_callable=AsyncMock
        ) as mock_enqueue,
    ):
        resp = await client.post(
            "/api/assets/upload/complete",
            json={
                "storage_key": "assets/image/x.png",
                "filename": "pic.png",
                "mime_type": "image/png",
                "file_size": 10,
                "asset_type": 1,
                "tags": ["产品图", "秋季"],
            },
        )

    assert resp.status_code == 201
    assert resp.json()["user_tags"] == ["产品图"]
    assert mock_create.call_args.kwargs["tags"] == ["产品图", "秋季"]
    task_types = [call.args[0] for call in mock_enqueue.await_args_list]
    assert "generate_thumbnail" in task_types


async def test_upload_complete_rejects_oversize_tag(client):
    resp = await client.post(
        "/api/assets/upload/complete",
        json={
            "storage_key": "assets/image/x.png",
            "filename": "pic.png",
            "mime_type": "image/png",
            "file_size": 10,
            "asset_type": 1,
            "tags": ["x" * 65],
        },
    )
    assert resp.status_code == 422


async def test_create_asset_attaches_tags():
    from app.modules.asset.schemas import AssetCreate
    from app.modules.asset.service import create_asset

    db = AsyncMock()
    db.add = MagicMock()
    with patch(
        "app.modules.tag.service.add_tags_to_asset", new_callable=AsyncMock
    ) as mock_add_tags:
        await create_asset(
            db,
            AssetCreate(name="pic", storage_key="assets/image/x.png", asset_type=1),
            tags=["产品图"],
        )

    mock_add_tags.assert_awaited_once()
    assert mock_add_tags.call_args.args[2] == ["产品图"]


async def test_backfill_endpoint_enqueues_missing_thumbnails(client):
    with patch(
        "app.modules.asset.router.service.backfill_thumbnails",
        new_callable=AsyncMock,
        return_value=(3, 2),
    ) as mock_backfill:
        resp = await client.post("/api/assets/thumbnails/backfill")

    assert resp.status_code == 200
    assert resp.json()["queued"] == 3
    assert resp.json()["remaining"] == 2
    mock_backfill.assert_awaited_once()


async def test_backfill_service_enqueues_each_missing_asset():
    from app.modules.asset.service import backfill_thumbnails

    count_result = MagicMock()
    count_result.scalar_one.return_value = 2
    ids_result = MagicMock()
    ids_result.scalars.return_value.all.return_value = [11, 22]
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[count_result, ids_result])

    with patch(
        "app.modules.asset.service.enqueue_task", new_callable=AsyncMock
    ) as mock_enqueue:
        queued, remaining = await backfill_thumbnails(db)

    assert (queued, remaining) == (2, 0)
    enqueued_ids = [call.args[1]["asset_id"] for call in mock_enqueue.await_args_list]
    assert enqueued_ids == [11, 22]


def test_downscale_composites_transparency_onto_white():
    buf = io.BytesIO()
    Image.new("RGBA", (10, 10), color=(0, 0, 0, 0)).save(buf, "PNG")

    thumb = _downscale_image_to_jpeg(buf.getvalue())

    assert thumb is not None
    with Image.open(io.BytesIO(thumb)) as img:
        r, g, b = img.getpixel((5, 5))
        assert r > 240 and g > 240 and b > 240
