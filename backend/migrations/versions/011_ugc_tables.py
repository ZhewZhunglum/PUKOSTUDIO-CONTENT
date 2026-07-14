"""011 UGC Outreach tables

Revision ID: 011_ugc_tables
Revises: 010_production
Create Date: 2026-06-02
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "011_ugc_tables"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Influencers ───────────────────────────────────────────────────────────
    op.create_table(
        "ugc_influencers",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("niche", sa.String(100), nullable=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ugc_influencers_team_id", "ugc_influencers", ["team_id"])
    op.create_index("ix_ugc_influencers_email", "ugc_influencers", ["email"])
    op.create_index("ix_ugc_influencers_status", "ugc_influencers", ["status"])
    op.create_index("ix_ugc_influencers_niche", "ugc_influencers", ["niche"])

    op.create_table(
        "ugc_influencer_platforms",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("influencer_id", sa.UUID(), nullable=False),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("data_provider", sa.String(50), nullable=True),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("username", sa.String(200), nullable=False),
        sa.Column("profile_url", sa.String(500), nullable=True),
        sa.Column("followers", sa.Integer(), nullable=True),
        sa.Column("engagement_rate", sa.Float(), nullable=True),
        sa.Column("avg_views", sa.Integer(), nullable=True),
        sa.Column("content_topics", postgresql.JSONB(), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["influencer_id"], ["ugc_influencers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("team_id", "data_provider", "platform", "external_id",
                            name="uq_ugc_inf_platform_team_provider"),
    )
    op.create_index("ix_ugc_inf_platform_team_id", "ugc_influencer_platforms", ["team_id"])

    op.create_table(
        "ugc_tags",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "ugc_influencer_tags",
        sa.Column("influencer_id", sa.UUID(), nullable=False),
        sa.Column("tag_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["influencer_id"], ["ugc_influencers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["ugc_tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("influencer_id", "tag_id"),
    )

    # ── Email accounts ────────────────────────────────────────────────────────
    op.create_table(
        "ugc_email_accounts",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("email_address", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=True),
        sa.Column("provider_type", sa.String(20), nullable=False),
        sa.Column("provider_config", postgresql.JSONB(), nullable=True),
        sa.Column("signature", sa.Text(), nullable=True),
        sa.Column("daily_limit", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("sent_today", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warmup_stage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("health_status", sa.String(20), nullable=False, server_default="healthy"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ugc_email_accounts_team_id", "ugc_email_accounts", ["team_id"])

    # ── Email templates ───────────────────────────────────────────────────────
    op.create_table(
        "ugc_email_templates",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("body_html", sa.Text(), nullable=False),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("is_library", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("variables", postgresql.JSONB(), nullable=True),
        sa.Column("open_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reply_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("send_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ugc_email_templates_team_id", "ugc_email_templates", ["team_id"])

    # ── Campaigns ─────────────────────────────────────────────────────────────
    op.create_table(
        "ugc_campaigns",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("campaign_type", sa.String(20), nullable=False),
        sa.Column("target_criteria", postgresql.JSONB(), nullable=True),
        sa.Column("schedule_config", postgresql.JSONB(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ugc_campaigns_team_id", "ugc_campaigns", ["team_id"])

    op.create_table(
        "ugc_campaign_steps",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", sa.UUID(), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("step_type", sa.String(20), nullable=False, server_default="initial"),
        sa.Column("template_id", sa.UUID(), nullable=False),
        sa.Column("delay_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("condition", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["ugc_campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["ugc_email_templates.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "ugc_campaign_influencers",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", sa.UUID(), nullable=False),
        sa.Column("influencer_id", sa.UUID(), nullable=False),
        sa.Column("current_step", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("enrolled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["ugc_campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["influencer_id"], ["ugc_influencers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Email messages ────────────────────────────────────────────────────────
    op.create_table(
        "ugc_email_messages",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("campaign_id", sa.UUID(), nullable=True),
        sa.Column("influencer_id", sa.UUID(), nullable=False),
        sa.Column("email_account_id", sa.UUID(), nullable=True),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("from_address", sa.String(255), nullable=False),
        sa.Column("to_address", sa.String(255), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("body_html", sa.Text(), nullable=True),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("message_id", sa.String(500), nullable=True),
        sa.Column("in_reply_to", sa.String(500), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["ugc_campaigns.id"]),
        sa.ForeignKeyConstraint(["influencer_id"], ["ugc_influencers.id"]),
        sa.ForeignKeyConstraint(["email_account_id"], ["ugc_email_accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ugc_email_messages_team_id", "ugc_email_messages", ["team_id"])
    op.create_index("ix_ugc_email_messages_influencer_id", "ugc_email_messages", ["influencer_id"])

    # ── Conversations ─────────────────────────────────────────────────────────
    op.create_table(
        "ugc_conversations",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("influencer_id", sa.UUID(), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unread_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ai_intent", sa.String(30), nullable=True),
        sa.Column("ai_confidence", sa.Float(), nullable=True),
        sa.Column("needs_review", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("latest_subject", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["influencer_id"], ["ugc_influencers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("influencer_id", name="uq_ugc_conv_influencer"),
    )
    op.create_index("ix_ugc_conversations_team_id", "ugc_conversations", ["team_id"])
    op.create_index("ix_ugc_conversations_needs_review", "ugc_conversations", ["needs_review"])

    op.create_table(
        "ugc_ai_drafts",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("conversation_id", sa.UUID(), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("body_html", sa.Text(), nullable=False),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("ai_model", sa.String(100), nullable=True),
        sa.Column("risk_level", sa.String(20), nullable=True),
        sa.Column("risk_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["ugc_conversations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ugc_ai_drafts_team_id", "ugc_ai_drafts", ["team_id"])


def downgrade() -> None:
    for tbl in [
        "ugc_ai_drafts", "ugc_conversations", "ugc_email_messages",
        "ugc_campaign_influencers", "ugc_campaign_steps", "ugc_campaigns",
        "ugc_email_templates", "ugc_email_accounts",
        "ugc_influencer_tags", "ugc_tags", "ugc_influencer_platforms", "ugc_influencers",
    ]:
        op.drop_table(tbl)
