"""Business entity tables: brand, sku, project."""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "brand",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("logo_asset_id", sa.BigInteger),
        sa.Column("website", sa.String(512)),
        sa.Column("color_primary", sa.String(16)),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )
    op.create_index("idx_brand_name", "brand", ["name"])

    op.create_table(
        "sku",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("brand_id", sa.Integer, sa.ForeignKey("brand.id", ondelete="SET NULL")),
        sa.Column("description", sa.Text),
        sa.Column("category", sa.String(128)),
        sa.Column("price_cny", sa.Numeric(12, 2)),
        sa.Column("cover_asset_id", sa.BigInteger),
        sa.Column("tags", sa.ARRAY(sa.Text), server_default="{}"),
        sa.Column("status", sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )
    op.create_index("idx_sku_brand", "sku", ["brand_id"])
    op.create_index("idx_sku_name", "sku", ["name"])

    op.create_table(
        "project",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("status", sa.SmallInteger, nullable=False, server_default="0"),
        sa.Column("cover_asset_id", sa.BigInteger),
        sa.Column("sku_id", sa.Integer, sa.ForeignKey("sku.id", ondelete="SET NULL")),
        sa.Column("brand_id", sa.Integer, sa.ForeignKey("brand.id", ondelete="SET NULL")),
        sa.Column("deadline", sa.TIMESTAMP(timezone=True)),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )
    op.create_index("idx_project_status", "project", ["status"])


def downgrade() -> None:
    op.drop_table("project")
    op.drop_table("sku")
    op.drop_table("brand")
