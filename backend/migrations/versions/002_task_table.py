"""Create task table

Revision ID: 002
Revises: 001
Create Date: 2026-05-07
"""
import sqlalchemy as sa
from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("uuid", sa.UUID(as_uuid=True), nullable=False, unique=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("priority", sa.SmallInteger, server_default="5"),
        sa.Column("payload", sa.JSON, nullable=False),
        sa.Column("result", sa.JSON),
        sa.Column("error", sa.Text),
        sa.Column("retry_count", sa.SmallInteger, server_default="0"),
        sa.Column("max_retries", sa.SmallInteger, server_default="3"),
        sa.Column("progress", sa.SmallInteger, server_default="0"),
        sa.Column("parent_task_id", sa.BigInteger),
        sa.Column("worker_id", sa.String(64)),
        sa.Column("scheduled_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
        sa.Column("started_at", sa.TIMESTAMP),
        sa.Column("finished_at", sa.TIMESTAMP),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
    )
    # Partial index for fast pending task polling
    op.execute("""
        CREATE INDEX idx_task_pending
        ON task (priority DESC, scheduled_at ASC)
        WHERE status = 'pending'
    """)
    op.execute("""
        CREATE INDEX idx_task_running
        ON task (worker_id, started_at)
        WHERE status = 'running'
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_task_running")
    op.execute("DROP INDEX IF EXISTS idx_task_pending")
    op.drop_table("task")
