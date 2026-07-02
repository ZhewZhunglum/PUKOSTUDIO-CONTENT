"""
Unified 5-dimensional RRF search.

Dimensions:
  1. pg_trgm trigram similarity  (name + ai_description)
  2. Full-text search tsvector   (name + description + ai_description + ocr + asr)
  3. Tag exact match             (user_tags && array[...])
  4. Text embedding cosine       (embedding_text <=> query_vec)
  5. Visual embedding cosine     (embedding_visual <=> visual_vec)

RRF score = Σ 1 / (k + rank_i),  k=60 (standard Elasticsearch default)
"""
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.asset.schemas import AssetListItem

_RRF_K = 60
_SELECT_COLS = """
    id, uuid, name, asset_type, mime_type, file_size, thumbnail_key, cdn_url,
    duration_ms, width, height, favorite, rating, use_count, user_tags,
    ai_processing_status, imported_at, source_url
"""


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

async def rrf_search(
    db: AsyncSession,
    query: str,
    *,
    mode: str = "hybrid",
    text_embedding: list[float] | None = None,
    visual_embedding: list[float] | None = None,
    asset_types: list[int] | None = None,
    limit: int = 50,
) -> list[AssetListItem]:
    """
    Unified RRF search across up to 5 dimensions.
    mode: keyword | semantic | visual | hybrid
    """
    n = min(limit * 5, 300)
    scores: dict[int, float] = {}

    if mode in ("keyword", "hybrid") and query.strip():
        # Dim 1: trigram
        trgm_ids = await _trgm_search(db, query, n, asset_types)
        _apply_rrf(scores, trgm_ids)

        # Dim 2: FTS
        fts_ids = await _fts_search(db, query, n, asset_types)
        _apply_rrf(scores, fts_ids)

        # Dim 3: tag match (treat query tokens as potential tags)
        tag_ids = await _tag_search(db, query, n, asset_types)
        _apply_rrf(scores, tag_ids)

    if mode in ("semantic", "hybrid") and text_embedding:
        sem_ids = await _text_vec_search(db, text_embedding, n, asset_types)
        _apply_rrf(scores, sem_ids)

    if mode == "visual" and visual_embedding:
        vis_ids = await _visual_vec_search(db, visual_embedding, n, asset_types)
        _apply_rrf(scores, vis_ids)

    if not scores:
        return []

    top_ids = sorted(scores, key=lambda x: -scores[x])[:limit]
    rows = await _fetch_by_ids(db, top_ids)
    id_to_row = {r["id"]: r for r in rows}
    return [_row_to_list_item(id_to_row[i]) for i in top_ids if i in id_to_row]


async def vector_search_by_text(
    db: AsyncSession,
    query_embedding: list[float],
    asset_types: list[int] | None = None,
    limit: int = 20,
    min_similarity: float = 0.3,
) -> list[dict[str, Any]]:
    """Legacy: cosine similarity on embedding_text, returns similarity score."""
    params: dict[str, Any] = {
        "embedding": str(query_embedding),
        "limit": limit,
        "asset_types": asset_types or [],
        "use_asset_types": bool(asset_types),
    }
    sql = text(f"""
        SELECT {_SELECT_COLS},
               1 - (embedding_text <=> :embedding::vector) AS similarity
        FROM asset
        WHERE is_deleted = false
          AND embedding_text IS NOT NULL
          AND (:use_asset_types = false OR asset_type = ANY(:asset_types))
        ORDER BY embedding_text <=> :embedding::vector
        LIMIT :limit
    """)
    result = await db.execute(sql, params)
    rows = result.mappings().all()
    return [
        {**_row_to_list_item(r).model_dump(), "similarity": float(r["similarity"])}
        for r in rows
        if float(r["similarity"]) >= min_similarity
    ]


async def vector_search_by_image(
    db: AsyncSession,
    query_embedding: list[float],
    asset_types: list[int] | None = None,
    limit: int = 20,
    min_similarity: float = 0.3,
) -> list[dict[str, Any]]:
    """Cosine similarity on embedding_visual column."""
    params: dict[str, Any] = {
        "embedding": str(query_embedding),
        "limit": limit,
        "asset_types": asset_types or [],
        "use_asset_types": bool(asset_types),
    }
    sql = text(f"""
        SELECT {_SELECT_COLS},
               1 - (embedding_visual <=> :embedding::vector) AS similarity
        FROM asset
        WHERE is_deleted = false
          AND embedding_visual IS NOT NULL
          AND (:use_asset_types = false OR asset_type = ANY(:asset_types))
        ORDER BY embedding_visual <=> :embedding::vector
        LIMIT :limit
    """)
    result = await db.execute(sql, params)
    rows = result.mappings().all()
    return [
        {**_row_to_list_item(r).model_dump(), "similarity": float(r["similarity"])}
        for r in rows
        if float(r["similarity"]) >= min_similarity
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Dimension queries — each returns an ordered list[int] of asset IDs
# ─────────────────────────────────────────────────────────────────────────────

async def _trgm_search(
    db: AsyncSession, query: str, n: int, asset_types: list[int] | None
) -> list[int]:
    sql = text("""
        SELECT id
        FROM asset
        WHERE is_deleted = false
          AND (:use_types = false OR asset_type = ANY(:types))
          AND (
            similarity(name, :q) > 0.08
            OR similarity(coalesce(ai_description,''), :q) > 0.08
            OR name ILIKE '%' || :q || '%'
            OR coalesce(ai_description,'') ILIKE '%' || :q || '%'
            OR ocr_text ILIKE '%' || :q || '%'
            OR asr_text ILIKE '%' || :q || '%'
          )
        ORDER BY
          GREATEST(
            similarity(name, :q),
            similarity(coalesce(ai_description,''), :q)
          ) DESC,
          imported_at DESC
        LIMIT :n
    """)
    result = await db.execute(sql, {
        "q": query, "n": n,
        "types": asset_types or [], "use_types": bool(asset_types),
    })
    return [row[0] for row in result.fetchall()]


async def _fts_search(
    db: AsyncSession, query: str, n: int, asset_types: list[int] | None
) -> list[int]:
    sql = text("""
        SELECT id
        FROM asset
        WHERE is_deleted = false
          AND (:use_types = false OR asset_type = ANY(:types))
          AND to_tsvector('simple',
                coalesce(name,'') || ' ' ||
                coalesce(description,'') || ' ' ||
                coalesce(ai_description,'') || ' ' ||
                coalesce(ocr_text,'') || ' ' ||
                coalesce(asr_text,'')
              ) @@ plainto_tsquery('simple', :q)
        ORDER BY
          ts_rank_cd(
            to_tsvector('simple',
              coalesce(name,'') || ' ' ||
              coalesce(description,'') || ' ' ||
              coalesce(ai_description,'') || ' ' ||
              coalesce(ocr_text,'') || ' ' ||
              coalesce(asr_text,'')
            ),
            plainto_tsquery('simple', :q)
          ) DESC
        LIMIT :n
    """)
    result = await db.execute(sql, {
        "q": query, "n": n,
        "types": asset_types or [], "use_types": bool(asset_types),
    })
    return [row[0] for row in result.fetchall()]


async def _tag_search(
    db: AsyncSession, query: str, n: int, asset_types: list[int] | None
) -> list[int]:
    tokens = [t.strip().lower() for t in query.replace(",", " ").split() if t.strip()]
    if not tokens:
        return []
    sql = text("""
        SELECT id
        FROM asset
        WHERE is_deleted = false
          AND (:use_types = false OR asset_type = ANY(:types))
          AND (
            user_tags && :tokens::text[]
            OR smart_tags && :tokens::text[]
          )
        ORDER BY
          cardinality(
            ARRAY(SELECT UNNEST(user_tags) INTERSECT SELECT UNNEST(:tokens::text[]))
          ) DESC,
          use_count DESC
        LIMIT :n
    """)
    result = await db.execute(sql, {
        "tokens": tokens, "n": n,
        "types": asset_types or [], "use_types": bool(asset_types),
    })
    return [row[0] for row in result.fetchall()]


async def _text_vec_search(
    db: AsyncSession, embedding: list[float], n: int, asset_types: list[int] | None
) -> list[int]:
    sql = text("""
        SELECT id
        FROM asset
        WHERE is_deleted = false
          AND embedding_text IS NOT NULL
          AND (:use_types = false OR asset_type = ANY(:types))
        ORDER BY embedding_text <=> :embedding::vector
        LIMIT :n
    """)
    result = await db.execute(sql, {
        "embedding": str(embedding), "n": n,
        "types": asset_types or [], "use_types": bool(asset_types),
    })
    return [row[0] for row in result.fetchall()]


async def _visual_vec_search(
    db: AsyncSession, embedding: list[float], n: int, asset_types: list[int] | None
) -> list[int]:
    sql = text("""
        SELECT id
        FROM asset
        WHERE is_deleted = false
          AND embedding_visual IS NOT NULL
          AND (:use_types = false OR asset_type = ANY(:types))
        ORDER BY embedding_visual <=> :embedding::vector
        LIMIT :n
    """)
    result = await db.execute(sql, {
        "embedding": str(embedding), "n": n,
        "types": asset_types or [], "use_types": bool(asset_types),
    })
    return [row[0] for row in result.fetchall()]


async def _fetch_by_ids(db: AsyncSession, ids: list[int]) -> list[Any]:
    if not ids:
        return []
    sql = text(f"SELECT {_SELECT_COLS} FROM asset WHERE id = ANY(:ids) AND is_deleted = false")
    result = await db.execute(sql, {"ids": ids})
    return list(result.mappings().all())


# ─────────────────────────────────────────────────────────────────────────────
# RRF helpers
# ─────────────────────────────────────────────────────────────────────────────

def _apply_rrf(scores: dict[int, float], ranked_ids: list[int]) -> None:
    for rank, asset_id in enumerate(ranked_ids, 1):
        scores[asset_id] = scores.get(asset_id, 0.0) + 1.0 / (_RRF_K + rank)


# ─────────────────────────────────────────────────────────────────────────────
# Row → schema
# ─────────────────────────────────────────────────────────────────────────────

def _row_to_list_item(row: Any) -> AssetListItem:
    return AssetListItem(
        id=row["id"],
        uuid=row["uuid"],
        name=row["name"],
        asset_type=row["asset_type"],
        mime_type=row.get("mime_type"),
        file_size=row.get("file_size"),
        thumbnail_key=row.get("thumbnail_key"),
        cdn_url=row.get("cdn_url"),
        duration_ms=row.get("duration_ms"),
        width=row.get("width"),
        height=row.get("height"),
        favorite=row.get("favorite", False),
        rating=row.get("rating", 0),
        use_count=row.get("use_count", 0),
        user_tags=row.get("user_tags") or [],
        ai_processing_status=row.get("ai_processing_status", 0),
        imported_at=row["imported_at"],
        source_url=row.get("source_url"),
        source_platform=_tag_value(row.get("user_tags"), "来源:"),
        source_extractor=_tag_value(row.get("user_tags"), "extractor:"),
    )


def _tag_value(tags: list[str] | None, prefix: str) -> str | None:
    for tag in tags or []:
        if tag.startswith(prefix):
            return tag.removeprefix(prefix)
    return None
