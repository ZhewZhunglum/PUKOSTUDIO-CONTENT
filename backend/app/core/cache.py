import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.logger import logger

_pool: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _pool


async def cache_get(key: str) -> Any | None:
    try:
        r = get_redis()
        raw = await r.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning("cache_get failed key={} err={}", key, exc)
        return None


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    try:
        r = get_redis()
        await r.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception as exc:
        logger.warning("cache_set failed key={} err={}", key, exc)


async def cache_delete(key: str) -> None:
    try:
        r = get_redis()
        await r.delete(key)
    except Exception as exc:
        logger.warning("cache_delete failed key={} err={}", key, exc)


async def cache_delete_pattern(pattern: str) -> None:
    try:
        r = get_redis()
        batch: list[str] = []
        async for key in r.scan_iter(match=pattern, count=200):
            batch.append(key)
            if len(batch) >= 200:
                await r.delete(*batch)
                batch.clear()
        if batch:
            await r.delete(*batch)
    except Exception as exc:
        logger.warning("cache_delete_pattern failed pattern={} err={}", pattern, exc)
