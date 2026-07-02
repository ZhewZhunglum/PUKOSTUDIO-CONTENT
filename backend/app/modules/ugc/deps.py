"""UGC dependencies — resolve single fixed team_id for the owner account."""
from __future__ import annotations

import uuid

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

_UGC_TEAM_KEY = "ugc_owner_team_id"
_UGC_TEAM_FIXED = str(uuid.UUID("00000000-0000-0000-0000-000000000001"))


async def get_team_id(db: AsyncSession = Depends(get_db)) -> uuid.UUID:
    """Return the single owner team-id for all UGC operations."""
    row = await db.execute(
        text("SELECT value FROM settings WHERE key = :k"), {"k": _UGC_TEAM_KEY}
    )
    val = row.scalar_one_or_none()
    if val is None:
        await db.execute(
            text(
                "INSERT INTO settings (key, value, description, updated_at) "
                "VALUES (:k, CAST(:v AS JSONB), :d, NOW()) "
                "ON CONFLICT (key) DO NOTHING"
            ),
            {"k": _UGC_TEAM_KEY, "v": f'"{_UGC_TEAM_FIXED}"', "d": "UGC owner team UUID"},
        )
        await db.commit()
        return uuid.UUID(_UGC_TEAM_FIXED)
    clean = str(val).strip('"')
    return uuid.UUID(clean)
