"""UGC Outreach — SQLAlchemy models.

All tables use ugc_ prefix to avoid collision with ContentForge tables.
team_id here is always the single owner UUID from deps.get_team_id.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# ── Junction table ────────────────────────────────────────────────────────────

ugc_influencer_tags = Table(
    "ugc_influencer_tags",
    Base.metadata,
    Column("influencer_id", UUID(as_uuid=True), ForeignKey("ugc_influencers.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("ugc_tags.id", ondelete="CASCADE"), primary_key=True),
)


# ── Enums ─────────────────────────────────────────────────────────────────────

class InfluencerStatus(enum.StrEnum):
    new = "new"
    contacted = "contacted"
    replied = "replied"
    negotiating = "negotiating"
    signed = "signed"
    rejected = "rejected"
    blacklisted = "blacklisted"


class PlatformType(enum.StrEnum):
    tiktok = "tiktok"
    instagram = "instagram"
    youtube = "youtube"


class CampaignStatus(enum.StrEnum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"
    archived = "archived"


class CampaignType(enum.StrEnum):
    ugc = "ugc"
    brand_promo = "brand_promo"
    tiktok_shop = "tiktok_shop"


class CampaignInfluencerStatus(enum.StrEnum):
    queued = "queued"
    in_progress = "in_progress"
    replied = "replied"
    completed = "completed"
    unsubscribed = "unsubscribed"
    bounced = "bounced"


class TemplateCategory(enum.StrEnum):
    initial_outreach = "initial_outreach"
    followup_1 = "followup_1"
    followup_2 = "followup_2"
    reply = "reply"
    custom = "custom"


class EmailProviderType(enum.StrEnum):
    ses = "ses"
    sendgrid = "sendgrid"
    smtp = "smtp"


class EmailDirection(enum.StrEnum):
    outbound = "outbound"
    inbound = "inbound"


class EmailStatus(enum.StrEnum):
    queued = "queued"
    sent = "sent"
    delivered = "delivered"
    opened = "opened"
    clicked = "clicked"
    bounced = "bounced"
    failed = "failed"
    received = "received"


class AIIntent(enum.StrEnum):
    interested = "interested"
    not_interested = "not_interested"
    question = "question"
    negotiation = "negotiation"
    spam = "spam"
    unknown = "unknown"


class AIDraftStatus(enum.StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    sent = "sent"


# ── Base mixin ────────────────────────────────────────────────────────────────

class UGCBase(Base):
    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", onupdate=datetime.utcnow, nullable=False
    )


# ── Influencer ────────────────────────────────────────────────────────────────

class UGCInfluencer(UGCBase):
    __tablename__ = "ugc_influencers"

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    niche: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    status: Mapped[InfluencerStatus] = mapped_column(
        Enum(InfluencerStatus, name="ugc_influencer_status"), default=InfluencerStatus.new, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)

    platforms: Mapped[list[UGCInfluencerPlatform]] = relationship(
        "UGCInfluencerPlatform", back_populates="influencer", cascade="all, delete-orphan"
    )
    tags: Mapped[list[UGCTag]] = relationship(
        "UGCTag", secondary=ugc_influencer_tags, back_populates="influencers"
    )


class UGCInfluencerPlatform(UGCBase):
    __tablename__ = "ugc_influencer_platforms"
    __table_args__ = (
        UniqueConstraint("team_id", "data_provider", "platform", "external_id",
                         name="uq_ugc_inf_platform_team_provider"),
        Index("ix_ugc_inf_platform_provider", "data_provider", "platform", "external_id"),
    )

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    influencer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ugc_influencers.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[PlatformType] = mapped_column(
        Enum(PlatformType, name="ugc_platform_type"), nullable=False
    )
    data_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    username: Mapped[str] = mapped_column(String(200), nullable=False)
    profile_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    followers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    engagement_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_views: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_topics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    influencer: Mapped[UGCInfluencer] = relationship("UGCInfluencer", back_populates="platforms")


class UGCTag(UGCBase):
    __tablename__ = "ugc_tags"

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)

    influencers: Mapped[list[UGCInfluencer]] = relationship(
        "UGCInfluencer", secondary=ugc_influencer_tags, back_populates="tags"
    )


# ── Email template ────────────────────────────────────────────────────────────

class UGCEmailTemplate(UGCBase):
    __tablename__ = "ugc_email_templates"

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    body_html: Mapped[str] = mapped_column(Text, nullable=False)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[TemplateCategory] = mapped_column(
        Enum(TemplateCategory, name="ugc_template_category"), nullable=False
    )
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    is_library: Mapped[bool] = mapped_column(Boolean, default=False)
    variables: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    open_count: Mapped[int] = mapped_column(Integer, default=0)
    reply_count: Mapped[int] = mapped_column(Integer, default=0)
    send_count: Mapped[int] = mapped_column(Integer, default=0)


# ── Email account ─────────────────────────────────────────────────────────────

class UGCEmailAccount(UGCBase):
    __tablename__ = "ugc_email_accounts"

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    email_address: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    provider_type: Mapped[EmailProviderType] = mapped_column(
        Enum(EmailProviderType, name="ugc_email_provider_type"), nullable=False
    )
    provider_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    daily_limit: Mapped[int] = mapped_column(Integer, default=50)
    sent_today: Mapped[int] = mapped_column(Integer, default=0)
    warmup_stage: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    health_status: Mapped[str] = mapped_column(String(20), default="healthy")


# ── Campaign ──────────────────────────────────────────────────────────────────

class UGCCampaign(UGCBase):
    __tablename__ = "ugc_campaigns"

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CampaignStatus] = mapped_column(
        Enum(CampaignStatus, name="ugc_campaign_status"), default=CampaignStatus.draft
    )
    campaign_type: Mapped[CampaignType] = mapped_column(
        Enum(CampaignType, name="ugc_campaign_type"), nullable=False
    )
    target_criteria: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    schedule_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    steps: Mapped[list[UGCCampaignStep]] = relationship(
        "UGCCampaignStep", back_populates="campaign", cascade="all, delete-orphan",
        order_by="UGCCampaignStep.step_order",
    )
    influencers: Mapped[list[UGCCampaignInfluencer]] = relationship(
        "UGCCampaignInfluencer", back_populates="campaign", cascade="all, delete-orphan"
    )


class UGCCampaignStep(UGCBase):
    __tablename__ = "ugc_campaign_steps"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ugc_campaigns.id", ondelete="CASCADE"), nullable=False
    )
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    step_type: Mapped[str] = mapped_column(String(20), default="initial")
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ugc_email_templates.id"), nullable=False
    )
    delay_days: Mapped[int] = mapped_column(Integer, default=0)
    condition: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    campaign: Mapped[UGCCampaign] = relationship("UGCCampaign", back_populates="steps")


class UGCCampaignInfluencer(UGCBase):
    __tablename__ = "ugc_campaign_influencers"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ugc_campaigns.id", ondelete="CASCADE"), nullable=False
    )
    influencer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ugc_influencers.id"), nullable=False
    )
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[CampaignInfluencerStatus] = mapped_column(
        Enum(CampaignInfluencerStatus, name="ugc_campaign_inf_status"),
        default=CampaignInfluencerStatus.queued
    )
    enrolled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    campaign: Mapped[UGCCampaign] = relationship("UGCCampaign", back_populates="influencers")


# ── Email message ─────────────────────────────────────────────────────────────

class UGCEmailMessage(UGCBase):
    __tablename__ = "ugc_email_messages"

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ugc_campaigns.id"), nullable=True, index=True
    )
    influencer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ugc_influencers.id"), nullable=False, index=True
    )
    email_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ugc_email_accounts.id"), nullable=True
    )
    direction: Mapped[EmailDirection] = mapped_column(
        Enum(EmailDirection, name="ugc_email_direction"), nullable=False
    )
    from_address: Mapped[str] = mapped_column(String(255), nullable=False)
    to_address: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    body_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[EmailStatus] = mapped_column(
        Enum(EmailStatus, name="ugc_email_status"), default=EmailStatus.queued
    )
    message_id: Mapped[str | None] = mapped_column(String(500), nullable=True)
    in_reply_to: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# ── Conversation ──────────────────────────────────────────────────────────────

class UGCConversation(UGCBase):
    __tablename__ = "ugc_conversations"

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    influencer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ugc_influencers.id"), nullable=False, unique=True
    )
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unread_count: Mapped[int] = mapped_column(Integer, default=0)
    ai_intent: Mapped[AIIntent | None] = mapped_column(
        Enum(AIIntent, name="ugc_ai_intent"), nullable=True
    )
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    latest_subject: Mapped[str | None] = mapped_column(Text, nullable=True)

    influencer: Mapped[UGCInfluencer] = relationship("UGCInfluencer")


class UGCAIDraft(UGCBase):
    __tablename__ = "ugc_ai_drafts"

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ugc_conversations.id", ondelete="CASCADE"), nullable=False
    )
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    body_html: Mapped[str] = mapped_column(Text, nullable=False)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AIDraftStatus] = mapped_column(
        Enum(AIDraftStatus, name="ugc_ai_draft_status"), default=AIDraftStatus.pending
    )
    ai_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    risk_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
