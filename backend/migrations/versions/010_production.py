"""010_production — production & ad_performance tables

Revision ID: 010
Revises: 009
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── production ────────────────────────────────────────────────────────────
    op.create_table(
        "production",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("asset_id", sa.BigInteger(), nullable=False),  # FK to asset (video)
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("platform", sa.String(32), nullable=True),     # tiktok / youtube / instagram / ...
        sa.Column("platform_url", sa.Text(), nullable=True),
        sa.Column("published_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("status", sa.SmallInteger(), nullable=False, server_default="0"),
        # 0=draft, 1=published, 2=archived
        sa.Column("sku_id", sa.BigInteger(), nullable=True),
        sa.Column("brand_id", sa.BigInteger(), nullable=True),
        sa.Column("video_project_id", sa.BigInteger(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_production_asset_id", "production", ["asset_id"])
    op.create_index("ix_production_status", "production", ["status"])
    op.create_index("ix_production_platform", "production", ["platform"])

    # ── ad_performance ────────────────────────────────────────────────────────
    op.create_table(
        "ad_performance",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("production_id", sa.BigInteger(), nullable=False),
        sa.Column("platform", sa.String(32), nullable=True),
        sa.Column("campaign_name", sa.String(256), nullable=True),
        sa.Column("date_start", sa.Date(), nullable=True),
        sa.Column("date_end", sa.Date(), nullable=True),
        # Cost
        sa.Column("spend", sa.Numeric(14, 4), nullable=True),    # CNY
        sa.Column("currency", sa.String(8), nullable=False, server_default="CNY"),
        # Volume
        sa.Column("impressions", sa.BigInteger(), nullable=True),
        sa.Column("clicks", sa.BigInteger(), nullable=True),
        sa.Column("plays", sa.BigInteger(), nullable=True),
        # Rates (stored as 0–100 %)
        sa.Column("ctr", sa.Numeric(8, 4), nullable=True),
        sa.Column("completion_rate", sa.Numeric(8, 4), nullable=True),
        # Engagement
        sa.Column("likes", sa.BigInteger(), nullable=True),
        sa.Column("comments", sa.BigInteger(), nullable=True),
        sa.Column("shares", sa.BigInteger(), nullable=True),
        # Conversion
        sa.Column("conversions", sa.BigInteger(), nullable=True),
        sa.Column("revenue", sa.Numeric(14, 4), nullable=True),
        sa.Column("roas", sa.Numeric(10, 4), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_ad_performance_production_id", "ad_performance", ["production_id"])


def downgrade() -> None:
    op.drop_table("ad_performance")
    op.drop_table("production")
