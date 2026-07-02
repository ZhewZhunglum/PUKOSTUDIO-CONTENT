"""
AI asset collection handler.
Task type: ai_collect
Payload:
  description: str        — natural language description of desired assets
  collection_name: str    — name for the new collection (optional, AI-generated if absent)
  max_results: int = 30   — max assets in collection (cap 100)

Flow:
1. Call Claude text_gen to parse description → structured search params (keywords, tags, type filters)
2. Search asset library with extracted params (up to 3× max_results candidates)
3. If candidates > max_results, call Claude again to rank / filter to best-fit assets
4. Create a new collection and add selected asset IDs
5. Return {collection_id, asset_count, collection_name}
"""
import json
from typing import Any

from loguru import logger

from app.core.ai_gateway.gateway import ai_gateway
from app.core.ai_gateway.schemas import AIRequest
from app.core.database import async_session_factory
from app.modules.asset.schemas import AssetSearchFilters, AssetSearchRequest
from app.modules.asset.service import search_assets
from app.modules.collection.schemas import CollectionCreate
from app.modules.collection.service import add_assets, create_collection
from app.workers.registry import register_handler


@register_handler("ai_collect")
async def handle_ai_collect(payload: dict[str, Any]) -> dict[str, Any]:
    description: str = payload["description"]
    collection_name: str | None = payload.get("collection_name")
    max_results: int = min(int(payload.get("max_results", 30)), 100)

    # Step 1: parse description into structured search params
    parse_result = await _parse_description(description)
    keyword = parse_result.get("keyword", "")
    tags_any = parse_result.get("tags_any") or []
    asset_types = parse_result.get("asset_types") or []
    generated_name = parse_result.get("collection_name") or description[:40]

    logger.info(f"ai_collect: keyword={keyword!r} tags={tags_any} types={asset_types}")

    # Step 2: search candidates (fetch 3× to give filter step room to choose)
    candidates = await _search_candidates(keyword, tags_any, asset_types, limit=max_results * 3)
    logger.info(f"ai_collect: {len(candidates)} candidates found")

    # Step 3: filter/rank with Claude if we have more than needed
    if len(candidates) > max_results:
        selected_ids = await _filter_candidates(description, candidates, max_results)
    else:
        selected_ids = [c["id"] for c in candidates]

    # Step 4: create collection and add assets
    final_name = collection_name or generated_name
    async with async_session_factory() as session:
        col = await create_collection(
            session,
            CollectionCreate(name=final_name, description=f"AI 自动收集：{description[:100]}"),
        )
        added = await add_assets(session, col.id, selected_ids)
        await session.commit()
        collection_id = col.id

    logger.info(f"ai_collect: created collection {collection_id} '{final_name}' with {added} assets")
    return {"collection_id": collection_id, "asset_count": added, "collection_name": final_name}


# ── Step 1: parse description ──────────────────────────────────────────────────

async def _parse_description(description: str) -> dict[str, Any]:
    req = AIRequest(
        capability="text_gen",
        inputs={
            "system": "You are an asset library search assistant. Respond only with valid JSON.",
            "prompt": _PARSE_PROMPT.format(description=description),
            "max_tokens": 512,
        },
        constraints={"quality_level": "bulk_local"},
    )
    resp = await ai_gateway.call(req)
    if not resp.success:
        logger.warning(f"ai_collect parse failed: {resp.error}")
        return {"keyword": description, "tags_any": [], "asset_types": [], "collection_name": None}
    return _safe_parse(resp.outputs.get("text", ""), {"keyword": description})


# ── Step 2: search candidates ──────────────────────────────────────────────────

async def _search_candidates(
    keyword: str,
    tags_any: list[str],
    asset_types: list[int],
    limit: int,
) -> list[dict[str, Any]]:
    search_req = AssetSearchRequest(
        query=keyword or None,
        filters=AssetSearchFilters(
            asset_type=asset_types or None,
            tags_any=tags_any or None,
        ),
        sort="relevance",
        limit=min(limit, 200),
    )
    async with async_session_factory() as session:
        result = await search_assets(session, search_req)

    return [
        {
            "id": item.id,
            "name": item.name,
            "ai_description": getattr(item, "ai_description", "") or "",
            "user_tags": getattr(item, "user_tags", []) or [],
        }
        for item in result.items
    ]


# ── Step 3: filter / rank candidates ──────────────────────────────────────────

async def _filter_candidates(
    description: str,
    candidates: list[dict[str, Any]],
    max_results: int,
) -> list[int]:
    # Build a compact list for Claude to rank
    lines = "\n".join(
        f'{c["id"]}: {c["name"]} | {c["ai_description"][:80]} | tags: {",".join(c["user_tags"][:5])}'
        for c in candidates[:120]  # safety cap for prompt size
    )
    req = AIRequest(
        capability="text_gen",
        inputs={
            "system": "You are an asset relevance ranker. Respond only with valid JSON.",
            "prompt": _FILTER_PROMPT.format(
                description=description,
                max_results=max_results,
                asset_lines=lines,
            ),
            "max_tokens": 512,
        },
        constraints={"quality_level": "bulk_local"},
    )
    resp = await ai_gateway.call(req)
    if not resp.success:
        logger.warning(f"ai_collect filter failed: {resp.error}")
        return [c["id"] for c in candidates[:max_results]]

    parsed = _safe_parse(resp.outputs.get("text", ""), {})
    ids = parsed.get("ids", [])
    if not ids:
        return [c["id"] for c in candidates[:max_results]]
    return [int(i) for i in ids[:max_results]]


# ── helpers ────────────────────────────────────────────────────────────────────

def _safe_parse(raw: str, fallback: dict[str, Any]) -> dict[str, Any]:
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1])
        return json.loads(cleaned)
    except Exception:
        logger.warning("ai_collect: failed to parse AI response JSON")
        return fallback


# ── prompts ────────────────────────────────────────────────────────────────────

_PARSE_PROMPT = """The user wants to collect assets from a library based on this description:
"{description}"

Return a JSON object with search parameters:
{{
  "keyword": "main search term or phrase in Chinese",
  "tags_any": ["tag1", "tag2"],
  "asset_types": [1],
  "collection_name": "short collection name in Chinese"
}}

asset_types: 1=image, 2=video, 3=audio (omit or empty list if not specified)
tags_any: relevant Chinese tags to match
Respond with JSON only."""

_FILTER_PROMPT = """User wants: "{description}"
Select the {max_results} most relevant assets from the list below.

Assets (id: name | description | tags):
{asset_lines}

Return JSON with the best matching asset IDs:
{{"ids": [1, 2, 3, ...]}}

Respond with JSON only."""
