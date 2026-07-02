"""Create ai_call_log table

Revision ID: 003
Revises: 002
Create Date: 2026-05-07
"""
import sqlalchemy as sa
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_call_log",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("task_id", sa.BigInteger),
        sa.Column("capability", sa.String(32)),
        sa.Column("provider", sa.String(32)),
        sa.Column("model", sa.String(64)),
        sa.Column("input_tokens", sa.Integer),
        sa.Column("output_tokens", sa.Integer),
        sa.Column("total_units", sa.Numeric(12, 4)),
        sa.Column("cost_usd", sa.Numeric(10, 6)),
        sa.Column("latency_ms", sa.Integer),
        sa.Column("status", sa.SmallInteger),  # 1 success, 2 fail, 3 timeout
        sa.Column("error_code", sa.String(64)),
        sa.Column("request_payload", sa.JSON),
        sa.Column("response_payload", sa.JSON),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_ai_log_provider_time", "ai_call_log", ["provider", "created_at"])
    op.create_index("idx_ai_log_capability", "ai_call_log", ["capability", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_ai_log_capability")
    op.drop_index("idx_ai_log_provider_time")
    op.drop_table("ai_call_log")
