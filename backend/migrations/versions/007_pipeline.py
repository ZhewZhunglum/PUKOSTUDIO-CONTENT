"""007 pipeline_run table"""
import sqlalchemy as sa
from alembic import op

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "pipeline_run",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("uuid", sa.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("video_project_id", sa.Integer, sa.ForeignKey("video_project.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.SmallInteger, nullable=False, server_default="0"),  # 0=running 1=done 2=failed
        sa.Column("stage", sa.String(80), nullable=True),
        sa.Column("product_name", sa.Text, nullable=False),
        sa.Column("product_description", sa.Text, nullable=True),
        sa.Column("platform", sa.String(50), nullable=False, server_default="tiktok"),
        sa.Column("style", sa.String(50), nullable=False, server_default="conversational"),
        sa.Column("duration_seconds", sa.Integer, nullable=False, server_default="30"),
        sa.Column("clip_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("completed_clips", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("script_json", sa.JSON, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_pipeline_run_status", "pipeline_run", ["status"])


def downgrade() -> None:
    op.drop_table("pipeline_run")
