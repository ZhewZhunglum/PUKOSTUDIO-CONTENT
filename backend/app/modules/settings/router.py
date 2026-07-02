"""Settings endpoints — read/write AI API keys stored in the DB settings table.

Keys are stored as JSONB strings under the key name (e.g. 'api_key_anthropic').
They are returned masked so the UI can show whether a key is set without
exposing the full value.
"""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])

# ── Key registry ──────────────────────────────────────────────────────────────
# Maps display_key → env var name / DB settings key
_KEY_REGISTRY: list[dict[str, str]] = [
    {"key": "api_key_anthropic",  "label": "Anthropic (Claude)",             "env": "ANTHROPIC_API_KEY",    "capability": "text · vision"},
    {"key": "api_key_openai",     "label": "OpenAI (GPT Image / TTS / ASR)", "env": "OPENAI_API_KEY",       "capability": "image · tts · asr · embedding"},
    {"key": "api_key_replicate",  "label": "Replicate (Seedance Video)",     "env": "REPLICATE_API_TOKEN",  "capability": "video_gen"},
    {"key": "api_key_elevenlabs", "label": "ElevenLabs (TTS v3)",            "env": "ELEVENLABS_API_KEY",   "capability": "tts"},
    {"key": "api_key_together",   "label": "Together AI (Bulk LLM)",         "env": "TOGETHER_API_KEY",     "capability": "bulk_text"},
    {"key": "api_key_google",     "label": "Google (Veo 3)",                 "env": "GOOGLE_API_KEY",       "capability": "video_gen_premium"},
]

# ── In-memory cache (refreshed on write) ──────────────────────────────────────
_cache: dict[str, str] = {}
_cache_loaded = False
_cache_lock = asyncio.Lock()


async def _load_cache(db: AsyncSession) -> None:
    global _cache, _cache_loaded
    keys = [r["key"] for r in _KEY_REGISTRY]
    rows = await db.execute(
        text("SELECT key, value FROM settings WHERE key = ANY(:keys)"),
        {"keys": keys},
    )
    new_cache: dict[str, str] = {}
    for key, value in rows:
        if value:
            new_cache[key] = str(value).strip('"')
    _cache = new_cache
    _cache_loaded = True


async def get_api_key(key_name: str, db: AsyncSession) -> str:
    """Return the API key from DB cache, falling back to env var."""
    global _cache_loaded
    if not _cache_loaded:
        async with _cache_lock:
            if not _cache_loaded:
                await _load_cache(db)
    db_val = _cache.get(key_name, "")
    if db_val:
        return db_val
    # Env var fallback
    from app.core.config import settings as cfg
    env_map = {r["key"]: r["env"] for r in _KEY_REGISTRY}
    env_name = env_map.get(key_name, "")
    return getattr(cfg, env_name.lower(), "") or ""


def get_cached_key(db_key: str, env_fallback: str = "") -> str:
    """Sync access to the in-memory key cache — for use by AI adapters.
    Falls back to env var if DB cache not loaded or key absent.
    """
    cached = _cache.get(db_key, "")
    if cached:
        return cached
    from app.core.config import settings as cfg
    return getattr(cfg, env_fallback.lower(), "") or ""


def _mask(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "•" * len(value)
    return value[:4] + "•" * (len(value) - 8) + value[-4:]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_setting(db: AsyncSession, key: str) -> str | None:
    row = await db.execute(
        text("SELECT value FROM settings WHERE key = :key"),
        {"key": key},
    )
    result = row.scalar_one_or_none()
    return str(result).strip('"') if result is not None else None


async def _set_setting(db: AsyncSession, key: str, value: str) -> None:
    await db.execute(
        text("""
            INSERT INTO settings (key, value, description, updated_at)
            VALUES (:key, CAST(:value AS JSONB), :desc, NOW())
            ON CONFLICT (key) DO UPDATE
            SET value = CAST(:value AS JSONB), updated_at = NOW()
        """),
        {"key": key, "value": f'"{value}"', "desc": f"API key: {key}"},
    )


# ── Schemas ───────────────────────────────────────────────────────────────────

class KeyInfo(BaseModel):
    key: str
    label: str
    capability: str
    env: str
    configured: bool
    masked: str       # empty string if not configured


class KeysResponse(BaseModel):
    keys: list[KeyInfo]


class KeysUpdateRequest(BaseModel):
    updates: dict[str, str]   # key → value (empty string = delete)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/ai-keys", response_model=KeysResponse)
async def get_ai_keys(db: AsyncSession = Depends(get_db)) -> KeysResponse:
    """Return all AI API keys (masked). Shows whether each key is configured."""
    from app.core.config import settings as cfg
    result: list[KeyInfo] = []
    for entry in _KEY_REGISTRY:
        db_val = await _get_setting(db, entry["key"])
        env_val = getattr(cfg, entry["env"].lower(), "") or ""
        value = db_val or env_val or ""
        result.append(KeyInfo(
            key=entry["key"],
            label=entry["label"],
            capability=entry["capability"],
            env=entry["env"],
            configured=bool(value),
            masked=_mask(value) if value else "",
        ))
    return KeysResponse(keys=result)


@router.put("/ai-keys", response_model=KeysResponse)
async def update_ai_keys(
    req: KeysUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> KeysResponse:
    """Save or delete AI API keys. Empty string value removes the key."""
    global _cache_loaded
    valid_keys = {r["key"] for r in _KEY_REGISTRY}
    for key, value in req.updates.items():
        if key not in valid_keys:
            raise HTTPException(status_code=400, detail=f"Unknown key: {key}")
        if value:
            await _set_setting(db, key, value.strip())
        else:
            # Delete the key
            await db.execute(
                text("DELETE FROM settings WHERE key = :key"),
                {"key": key},
            )
    await db.commit()
    # Invalidate cache so next request re-reads from DB
    _cache_loaded = False
    return await get_ai_keys(db)


# ── Connectivity test ─────────────────────────────────────────────────────────

class TestResult(BaseModel):
    key: str
    label: str
    ok: bool
    latency_ms: int | None = None
    detail: str = ""


@router.post("/ai-keys/{key}/test", response_model=TestResult)
async def test_ai_key(key: str, db: AsyncSession = Depends(get_db)) -> TestResult:
    """Send a minimal real request to verify an API key actually works."""
    import time
    import httpx

    entry = next((r for r in _KEY_REGISTRY if r["key"] == key), None)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Unknown key: {key}")

    # Ensure cache is warm
    if not _cache_loaded:
        await _load_cache(db)
    api_key = get_cached_key(key, entry["env"])

    if not api_key:
        return TestResult(key=key, label=entry["label"], ok=False, detail="未配置 API Key")

    t0 = time.perf_counter()

    try:
        if key == "api_key_anthropic":
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=api_key)
            resp = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=8,
                messages=[{"role": "user", "content": "hi"}],
            )
            latency = round((time.perf_counter() - t0) * 1000)
            return TestResult(key=key, label=entry["label"], ok=True, latency_ms=latency,
                              detail=f"model={resp.model}")

        elif key == "api_key_openai":
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)
            models = await client.models.list()
            latency = round((time.perf_counter() - t0) * 1000)
            count = len(list(models))
            return TestResult(key=key, label=entry["label"], ok=True, latency_ms=latency,
                              detail=f"{count} models available")

        elif key == "api_key_replicate":
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    "https://api.replicate.com/v1/account",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
            latency = round((time.perf_counter() - t0) * 1000)
            if r.status_code == 200:
                username = r.json().get("username", "")
                return TestResult(key=key, label=entry["label"], ok=True, latency_ms=latency,
                                  detail=f"account={username}")
            return TestResult(key=key, label=entry["label"], ok=False, latency_ms=latency,
                              detail=f"HTTP {r.status_code}")

        elif key == "api_key_elevenlabs":
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    "https://api.elevenlabs.io/v1/user",
                    headers={"xi-api-key": api_key},
                )
            latency = round((time.perf_counter() - t0) * 1000)
            if r.status_code == 200:
                tier = r.json().get("subscription", {}).get("tier", "")
                return TestResult(key=key, label=entry["label"], ok=True, latency_ms=latency,
                                  detail=f"tier={tier}")
            return TestResult(key=key, label=entry["label"], ok=False, latency_ms=latency,
                              detail=f"HTTP {r.status_code}")

        elif key == "api_key_together":
            from together import AsyncTogether
            client = AsyncTogether(api_key=api_key)
            models = await client.models.list()
            latency = round((time.perf_counter() - t0) * 1000)
            return TestResult(key=key, label=entry["label"], ok=True, latency_ms=latency,
                              detail=f"{len(models)} models")

        elif key == "api_key_google":
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
                )
            latency = round((time.perf_counter() - t0) * 1000)
            if r.status_code == 200:
                count = len(r.json().get("models", []))
                return TestResult(key=key, label=entry["label"], ok=True, latency_ms=latency,
                                  detail=f"{count} models")
            return TestResult(key=key, label=entry["label"], ok=False, latency_ms=latency,
                              detail=f"HTTP {r.status_code}: {r.text[:80]}")

        return TestResult(key=key, label=entry["label"], ok=False, detail="暂不支持此服务商的测试")

    except Exception as exc:
        latency = round((time.perf_counter() - t0) * 1000)
        return TestResult(key=key, label=entry["label"], ok=False, latency_ms=latency,
                          detail=str(exc)[:120])
