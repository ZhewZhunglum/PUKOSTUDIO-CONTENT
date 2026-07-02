"""Load tag seed data from config/tags_seed.yaml (idempotent)."""
from pathlib import Path

import yaml
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.modules.tag.models import Tag

SEED_PATH = Path(__file__).parents[5] / "config" / "tags_seed.yaml"


async def seed_tags(db: AsyncSession) -> None:
    if not SEED_PATH.exists():
        logger.warning(f"Tag seed file not found: {SEED_PATH}")
        return

    with open(SEED_PATH, encoding="utf-8") as f:
        data: dict[str, list[str]] = yaml.safe_load(f)

    inserted = 0
    for category, names in data.items():
        for raw_name in names:
            name = raw_name.strip().lower()
            result = await db.execute(select(Tag).where(Tag.name == name))
            if result.scalar_one_or_none():
                continue
            tag = Tag(
                name=name,
                category=category,
                is_system=True,
                created_at=utcnow(),
            )
            db.add(tag)
            inserted += 1

    await db.flush()
    logger.info(f"Tag seed: inserted {inserted} tags")
