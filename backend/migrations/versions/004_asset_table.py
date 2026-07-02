"""Create asset table with all fields and indexes

Revision ID: 004
Revises: 003
Create Date: 2026-05-07
"""
import sqlalchemy as sa
from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "asset",
        # --- Primary key ---
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("uuid", sa.UUID(as_uuid=True), nullable=False, unique=True,
                  server_default=sa.text("gen_random_uuid()")),
        # --- Basic info ---
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("original_filename", sa.Text),
        sa.Column("description", sa.Text),
        # --- Type & format ---
        sa.Column("asset_type", sa.SmallInteger, nullable=False),  # 1-11
        sa.Column("asset_subtype", sa.String(64)),
        sa.Column("mime_type", sa.String(128)),
        sa.Column("file_format", sa.String(16)),
        # --- File properties ---
        sa.Column("file_size", sa.BigInteger),
        sa.Column("file_md5", sa.String(32)),
        sa.Column("file_phash", sa.String(64)),
        sa.Column("storage_key", sa.Text, nullable=False),
        sa.Column("storage_bucket", sa.String(64), server_default="assets"),
        sa.Column("thumbnail_key", sa.Text),
        sa.Column("preview_key", sa.Text),
        sa.Column("cdn_url", sa.Text),
        sa.Column("backup_status", sa.SmallInteger, server_default="0"),
        # --- Media properties ---
        sa.Column("duration_ms", sa.Integer),
        sa.Column("width", sa.Integer),
        sa.Column("height", sa.Integer),
        sa.Column("fps", sa.Numeric(5, 2)),
        sa.Column("bitrate", sa.Integer),
        sa.Column("codec", sa.String(32)),
        sa.Column("has_audio", sa.Boolean),
        sa.Column("audio_codec", sa.String(32)),
        sa.Column("color_palette", sa.JSON),
        # --- Business relations ---
        sa.Column("collection_ids", sa.ARRAY(sa.BigInteger)),
        sa.Column("sku_id", sa.BigInteger),
        sa.Column("brand_id", sa.BigInteger),
        sa.Column("project_id", sa.BigInteger),
        # --- Tags ---
        sa.Column("user_tags", sa.ARRAY(sa.Text)),
        sa.Column("ai_tags", sa.JSON),
        sa.Column("smart_tags", sa.ARRAY(sa.Text)),
        # --- Content understanding ---
        sa.Column("ai_description", sa.Text),
        sa.Column("ocr_text", sa.Text),
        sa.Column("asr_text", sa.Text),
        sa.Column("asr_segments", sa.JSON),
        sa.Column("detected_objects", sa.JSON),
        sa.Column("has_face", sa.Boolean, server_default="false"),
        sa.Column("face_count", sa.SmallInteger),
        sa.Column("scene_segments", sa.JSON),
        sa.Column("highlights", sa.JSON),
        # --- Source & version ---
        sa.Column("source", sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("source_task_id", sa.BigInteger),
        sa.Column("source_url", sa.Text),
        sa.Column("source_model", sa.String(64)),
        sa.Column("source_prompt", sa.Text),
        sa.Column("parent_id", sa.BigInteger),
        sa.Column("version", sa.Integer, server_default="1"),
        sa.Column("is_latest", sa.Boolean, server_default="true"),
        # --- Copyright ---
        sa.Column("copyright_status", sa.SmallInteger, server_default="1"),
        sa.Column("copyright_notes", sa.Text),
        sa.Column("license_expiry", sa.Date),
        # --- Usage stats ---
        sa.Column("use_count", sa.Integer, server_default="0"),
        sa.Column("view_count", sa.Integer, server_default="0"),
        sa.Column("favorite", sa.Boolean, server_default="false"),
        sa.Column("rating", sa.SmallInteger, server_default="0"),
        sa.Column("last_used_at", sa.TIMESTAMP),
        # --- Status ---
        sa.Column("status", sa.SmallInteger, server_default="1"),
        sa.Column("is_deleted", sa.Boolean, server_default="false"),
        sa.Column("deleted_at", sa.TIMESTAMP),
        sa.Column("ai_processing_status", sa.SmallInteger, server_default="0"),
        # --- Timestamps ---
        sa.Column("captured_at", sa.TIMESTAMP),
        sa.Column("imported_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
    )

    # Add pgvector embedding columns
    op.execute("ALTER TABLE asset ADD COLUMN embedding_text vector(3072)")
    op.execute("ALTER TABLE asset ADD COLUMN embedding_visual vector(1024)")

    # Standard indexes
    op.create_index("idx_asset_type", "asset", ["asset_type", "status", "imported_at"])
    op.create_index("idx_asset_md5", "asset", ["file_md5"])
    op.create_index("idx_asset_phash", "asset", ["file_phash"])
    op.create_index("idx_asset_sku", "asset", ["sku_id"])
    op.create_index("idx_asset_favorite", "asset", ["favorite", "rating"])
    op.create_index("idx_asset_use_count", "asset", ["use_count"])
    op.create_index("idx_asset_status", "asset", ["status", "is_deleted"])

    # GIN indexes for arrays / JSONB
    op.execute("CREATE INDEX idx_asset_collections ON asset USING GIN(collection_ids)")
    op.execute("CREATE INDEX idx_asset_user_tags ON asset USING GIN(user_tags)")
    op.execute("CREATE INDEX idx_asset_smart_tags ON asset USING GIN(smart_tags)")

    # Full-text search index
    op.execute("""
        CREATE INDEX idx_asset_fts ON asset USING GIN(
            to_tsvector('simple',
                coalesce(name,'') || ' ' ||
                coalesce(description,'') || ' ' ||
                coalesce(ai_description,'') || ' ' ||
                coalesce(ocr_text,'') || ' ' ||
                coalesce(asr_text,'')
            )
        )
    """)

    # Trigram index for fuzzy name search
    op.execute("CREATE INDEX idx_asset_name_trgm ON asset USING GIN(name gin_trgm_ops)")

    # Vector indexes:
    # embedding_text is 3072-dim (text-embedding-3-large). pgvector 0.8.x limits
    # both HNSW and IVFFlat indexes to 2000 dims, so we skip indexing this column
    # for now — exact cosine search is fine on small datasets during development.
    # embedding_visual (1024-dim) is within limit and uses HNSW.
    op.execute("""
        CREATE INDEX idx_asset_emb_visual ON asset
        USING hnsw(embedding_visual vector_cosine_ops)
        WITH (m=16, ef_construction=64)
    """)


def downgrade() -> None:
    op.drop_table("asset")
