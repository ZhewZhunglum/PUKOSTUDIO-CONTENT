"""Create video_project and video_clip tables

Revision ID: 006
Revises: 005
Create Date: 2026-05-07
"""
import sqlalchemy as sa
from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- video_project: a named video with a timeline ---
    op.create_table(
        "video_project",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text),

        # Source context
        sa.Column("sku_id", sa.BigInteger),
        sa.Column("brand_id", sa.BigInteger),
        sa.Column("project_id", sa.BigInteger),

        # Timeline: array of clip objects (JSON)
        sa.Column("timeline", sa.JSON, server_default=sa.text("'[]'")),

        # Video spec
        sa.Column("target_duration_ms", sa.Integer),
        sa.Column("resolution", sa.String(16), server_default=sa.text("'1080x1920'")),
        sa.Column("fps", sa.SmallInteger, server_default=sa.text("30")),
        sa.Column("platform", sa.String(32), server_default=sa.text("'tiktok'")),

        # Audio
        sa.Column("bgm_asset_id", sa.BigInteger),
        sa.Column("bgm_volume", sa.Numeric(3, 2), server_default=sa.text("0.3")),
        sa.Column("narration_asset_id", sa.BigInteger),
        sa.Column("narration_script", sa.Text),

        # Output
        sa.Column("output_asset_id", sa.BigInteger),
        sa.Column("render_status", sa.SmallInteger, server_default=sa.text("0")),
        sa.Column("render_error", sa.Text),
        sa.Column("render_progress", sa.SmallInteger, server_default=sa.text("0")),

        sa.Column("status", sa.SmallInteger, server_default=sa.text("1")),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false")),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_vp_project", "video_project", ["project_id"])
    op.create_index("idx_vp_render", "video_project", ["render_status"])

    # --- video_clip: individual clip within a timeline ---
    op.create_table(
        "video_clip",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("video_project_id", sa.BigInteger, nullable=False),

        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("clip_type", sa.String(32), nullable=False),
        # clip_type: footage | ai_video | image | text_overlay | transition

        sa.Column("asset_id", sa.BigInteger),

        # AI video generation spec
        sa.Column("ai_prompt", sa.Text),
        sa.Column("ai_model", sa.String(64)),
        sa.Column("ai_reference_asset_id", sa.BigInteger),
        sa.Column("ai_status", sa.SmallInteger, server_default=sa.text("0")),

        # Timing
        sa.Column("start_ms", sa.Integer, server_default=sa.text("0")),
        sa.Column("duration_ms", sa.Integer),
        sa.Column("trim_start_ms", sa.Integer, server_default=sa.text("0")),

        # Visual transforms
        sa.Column("volume", sa.Numeric(3, 2), server_default=sa.text("1.0")),
        sa.Column("speed", sa.Numeric(4, 2), server_default=sa.text("1.0")),
        sa.Column("filters", sa.JSON),
        sa.Column("text_content", sa.Text),
        sa.Column("text_style", sa.JSON),

        sa.Column("extra", sa.JSON),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_vc_project", "video_clip", ["video_project_id", "position"])


def downgrade() -> None:
    op.drop_table("video_clip")
    op.drop_table("video_project")
