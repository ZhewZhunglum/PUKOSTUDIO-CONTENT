"""Create tag, asset_tag, collection, collection_asset, asset_relation tables

Revision ID: 005
Revises: 004
Create Date: 2026-05-07
"""
import sqlalchemy as sa
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- tag ---
    op.create_table(
        "tag",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(64), nullable=False, unique=True),
        sa.Column("category", sa.String(32)),
        sa.Column("parent_id", sa.BigInteger),
        sa.Column("aliases", sa.ARRAY(sa.Text)),
        sa.Column("color", sa.String(7)),
        sa.Column("description", sa.Text),
        sa.Column("use_count", sa.Integer, server_default="0"),
        sa.Column("is_system", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_tag_name", "tag", ["name"])
    op.create_index("idx_tag_category", "tag", ["category"])

    # --- asset_tag ---
    op.create_table(
        "asset_tag",
        sa.Column("asset_id", sa.BigInteger, nullable=False),
        sa.Column("tag_id", sa.BigInteger, nullable=False),
        sa.Column("source", sa.SmallInteger, nullable=False),   # 1 user, 2 AI, 3 system
        sa.Column("confidence", sa.Numeric(3, 2)),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("asset_id", "tag_id"),
    )
    op.create_index("idx_asset_tag_tag", "asset_tag", ["tag_id"])
    op.create_index("idx_asset_tag_source", "asset_tag", ["asset_id", "source"])

    # --- collection ---
    op.create_table(
        "collection",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("cover_asset_id", sa.BigInteger),
        sa.Column("asset_count", sa.Integer, server_default="0"),
        sa.Column("is_smart", sa.Boolean, server_default="false"),
        sa.Column("smart_rules", sa.JSON),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
    )

    # --- collection_asset ---
    op.create_table(
        "collection_asset",
        sa.Column("collection_id", sa.BigInteger, nullable=False),
        sa.Column("asset_id", sa.BigInteger, nullable=False),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        sa.Column("added_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("collection_id", "asset_id"),
    )
    op.create_index("idx_ca_asset", "collection_asset", ["asset_id"])

    # --- asset_relation ---
    op.create_table(
        "asset_relation",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("source_asset_id", sa.BigInteger, nullable=False),
        sa.Column("target_asset_id", sa.BigInteger, nullable=False),
        sa.Column("relation_type", sa.String(32), nullable=False),
        sa.Column("metadata", sa.JSON),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("source_asset_id", "target_asset_id", "relation_type"),
    )
    op.create_index("idx_relation_source", "asset_relation", ["source_asset_id", "relation_type"])
    op.create_index("idx_relation_target", "asset_relation", ["target_asset_id", "relation_type"])


def downgrade() -> None:
    op.drop_table("asset_relation")
    op.drop_table("collection_asset")
    op.drop_table("collection")
    op.drop_table("asset_tag")
    op.drop_table("tag")
