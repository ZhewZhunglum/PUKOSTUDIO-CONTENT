"""013 Add admin flag to users

Revision ID: 013_user_admin_flag
Revises: 012_users_table
Create Date: 2026-07-02
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "013_user_admin_flag"
down_revision = "012_users_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.execute("""
        UPDATE users
        SET is_admin = true
        WHERE id = (
            SELECT id
            FROM users
            WHERE is_active = true
            ORDER BY id
            LIMIT 1
        )
    """)


def downgrade() -> None:
    op.drop_column("users", "is_admin")
