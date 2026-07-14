"""012 Users table — replace single-user settings approach with multi-user table

Revision ID: 012_users_table
Revises: 011_ugc_tables
Create Date: 2026-06-05
"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "012_users_table"
down_revision = "011_ugc_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    # Migrate existing single-user credentials from the settings table
    op.execute("""
        INSERT INTO users (username, password_hash, created_at)
        SELECT
            TRIM('"' FROM s_user.value::text),
            TRIM('"' FROM s_pass.value::text),
            NOW()
        FROM settings s_user
        JOIN settings s_pass ON s_pass.key = 'auth_password_hash'
        WHERE s_user.key = 'auth_username'
        ON CONFLICT (username) DO NOTHING
    """)

    # Remove the now-redundant auth entries from settings
    op.execute("DELETE FROM settings WHERE key IN ('auth_username', 'auth_password_hash')")


def downgrade() -> None:
    # Restore settings entries from the first user in the users table
    op.execute("""
        INSERT INTO settings (key, value, description, updated_at)
        SELECT
            'auth_username',
            to_jsonb(username),
            'Auth setting: auth_username',
            NOW()
        FROM users
        ORDER BY id
        LIMIT 1
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    """)
    op.execute("""
        INSERT INTO settings (key, value, description, updated_at)
        SELECT
            'auth_password_hash',
            to_jsonb(password_hash),
            'Auth setting: auth_password_hash',
            NOW()
        FROM users
        ORDER BY id
        LIMIT 1
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    """)

    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
