from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _make_engine_url(raw: str) -> tuple[str, dict]:
    """Strip SSL query params from the URL and return (clean_url, connect_args).

    asyncpg does not accept ``sslmode`` or ``channel_binding`` as URL parameters —
    SSL must be passed via ``connect_args`` instead.
    """
    ssl_params = {"sslmode", "channel_binding", "sslrootcert", "sslcert", "sslkey"}
    needs_ssl = False

    if "?" in raw:
        base, qs = raw.split("?", 1)
        kept: list[str] = []
        for pair in qs.split("&"):
            key = pair.split("=")[0].lower()
            if key in ssl_params:
                if pair.lower() in ("sslmode=require", "sslmode=verify-full",
                                    "sslmode=verify-ca"):
                    needs_ssl = True
            else:
                kept.append(pair)
        clean = f"{base}?{'&'.join(kept)}" if kept else base
    else:
        clean = raw

    connect_args: dict = {"ssl": True} if needs_ssl else {}
    return clean, connect_args


_db_url, _connect_args = _make_engine_url(settings.database_url)

engine = create_async_engine(
    _db_url,
    connect_args=_connect_args,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=settings.sql_echo,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
