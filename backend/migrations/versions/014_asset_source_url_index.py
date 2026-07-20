"""014 Add index on asset.source_url

Revision ID: 014_asset_source_url_index
Revises: 013_user_admin_flag
Create Date: 2026-07-14

URL import dedup (find_by_source_url) filters on this column on every
import; it had no index, forcing a sequential scan per lookup.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "014_asset_source_url_index"
down_revision = "013_user_admin_flag"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("idx_asset_source_url", "asset", ["source_url"])


def downgrade() -> None:
    op.drop_index("idx_asset_source_url", table_name="asset")
