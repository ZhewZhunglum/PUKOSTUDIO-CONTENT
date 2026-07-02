"""Shared utility helpers for ContentForge backend."""
from datetime import UTC, datetime


def utcnow() -> datetime:
    """Return current UTC time as a naive datetime (compatible with TIMESTAMP WITHOUT TIME ZONE).

    asyncpg rejects timezone-aware datetimes when the column is declared as
    TIMESTAMP WITHOUT TIME ZONE (which all our migrations use).  Always call
    this helper instead of timezone-aware datetimes directly.
    """
    return datetime.now(UTC).replace(tzinfo=None)
