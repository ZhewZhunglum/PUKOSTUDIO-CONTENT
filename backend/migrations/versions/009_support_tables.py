"""Add support tables: settings, render_job, template, search_history

Revision ID: 009
Revises: 008
Create Date: 2026-05-08
"""
import sqlalchemy as sa
from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── settings (global KV store) ──────────────────────────────────────────
    op.create_table(
        "settings",
        sa.Column("key", sa.String(128), primary_key=True),
        sa.Column("value", sa.JSON, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("updated_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
    )

    # ── render_job (video render tracking) ─────────────────────────────────
    op.create_table(
        "render_job",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("video_project_id", sa.BigInteger, nullable=False),
        sa.Column("status", sa.SmallInteger, server_default="0"),
        # 0=pending 1=running 2=done 3=failed
        sa.Column("progress", sa.SmallInteger, server_default="0"),  # 0-100
        sa.Column("eta_seconds", sa.Integer),
        sa.Column("output_asset_id", sa.BigInteger),
        sa.Column("output_key", sa.Text),
        sa.Column("ffmpeg_cmd", sa.Text),
        sa.Column("error_message", sa.Text),
        sa.Column("started_at", sa.TIMESTAMP),
        sa.Column("finished_at", sa.TIMESTAMP),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_render_job_project", "render_job", ["video_project_id"])
    op.create_index("idx_render_job_status", "render_job", ["status"])

    # ── template (script & video templates) ────────────────────────────────
    op.create_table(
        "template",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(64)),
        sa.Column("template_type", sa.SmallInteger, server_default="1"),
        # 1=script 2=video
        sa.Column("platform", sa.String(32)),
        sa.Column("style", sa.String(64)),
        sa.Column("duration", sa.Integer),  # seconds
        sa.Column("description", sa.Text),
        sa.Column("hooks", sa.JSON),          # list[str]
        sa.Column("outline", sa.JSON),         # list[str]
        sa.Column("cta", sa.Text),
        sa.Column("body", sa.Text),            # full template body / markdown
        sa.Column("variables", sa.JSON),       # list of variable names
        sa.Column("is_builtin", sa.Boolean, server_default="false"),
        sa.Column("use_count", sa.Integer, server_default="0"),
        sa.Column("status", sa.SmallInteger, server_default="1"),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_template_category", "template", ["category", "status"])
    op.create_index("idx_template_platform", "template", ["platform"])

    # ── search_history ──────────────────────────────────────────────────────
    op.create_table(
        "search_history",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("query", sa.Text, nullable=False),
        sa.Column("search_mode", sa.String(32), server_default="keyword"),
        # keyword | semantic | visual
        sa.Column("result_count", sa.Integer),
        sa.Column("filters", sa.JSON),
        sa.Column("searched_at", sa.TIMESTAMP, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_search_history_time", "search_history", ["searched_at"])


    # ── Seed builtin templates ──────────────────────────────────────────────
    import json
    from datetime import UTC, datetime
    _now = datetime.now(UTC)
    tmpl_table = sa.table(
        "template",
        sa.column("name"), sa.column("category"), sa.column("template_type"),
        sa.column("platform"), sa.column("style"), sa.column("duration"),
        sa.column("description"), sa.column("hooks"), sa.column("outline"),
        sa.column("cta"), sa.column("is_builtin"), sa.column("status"),
        sa.column("created_at"), sa.column("updated_at"),
    )
    _builtins = [
        {
            "name": "产品测评 30秒",
            "category": "测评",
            "template_type": 1,
            "platform": "tiktok",
            "style": "conversational",
            "duration": 30,
            "description": "快节奏产品开箱与测评，适合美妆护肤、数码产品",
            "hooks": json.dumps(["这个产品让我惊呆了！", "我已经用了30天，真实效果来了", "千元平替来了，效果真的不输大牌"], ensure_ascii=False),
            "outline": json.dumps(["钩子 (0-3s): 开场惊喜/问题引出", "产品展示 (3-8s): 外观+包装快速展示", "使用演示 (8-20s): 核心功效/使用效果", "对比说明 (20-25s): 与竞品/之前状态对比", "总结+CTA (25-30s): 推荐理由+号召购买/关注"], ensure_ascii=False),
            "cta": "点击主页链接购买，评论区留言有惊喜",
            "is_builtin": True,
            "status": 1,
        },
        {
            "name": "生活方式 60秒",
            "category": "种草",
            "template_type": 1,
            "platform": "instagram",
            "style": "conversational",
            "duration": 60,
            "description": "场景化种草，强调生活质感和情感共鸣",
            "hooks": json.dumps(["发现了一个让生活变好的小物", "入手它之后我的早晨彻底变了", "这就是我每天最期待的时刻"], ensure_ascii=False),
            "outline": json.dumps(["场景引入 (0-5s): 生活场景/痛点共鸣", "产品登场 (5-15s): 自然融入场景展示", "体验分享 (15-40s): 使用感受+细节展示", "情感升华 (40-50s): 产品带来的生活改变", "种草收尾 (50-60s): 推荐+话题引导"], ensure_ascii=False),
            "cta": "点击收藏，关注我看更多好物分享",
            "is_builtin": True,
            "status": 1,
        },
        {
            "name": "教程类 90秒",
            "category": "教程",
            "template_type": 1,
            "platform": "youtube",
            "style": "educational",
            "duration": 90,
            "description": "步骤清晰的使用教程，适合需要详细说明的产品",
            "hooks": json.dumps(["3步搞定，新手也能轻松上手", "99%的人都不知道这个用法", "用了这个方法效果翻倍"], ensure_ascii=False),
            "outline": json.dumps(["痛点引入 (0-5s): 用户常见错误/需求", "方法预告 (5-10s): 今天要教的方法", "材料准备 (10-20s): 所需产品/工具", "步骤演示 (20-70s): 分步骤详细操作", "效果展示 (70-80s): 完成效果对比", "总结+延伸 (80-90s): 要点回顾+关注预告"], ensure_ascii=False),
            "cta": "三连支持，评论区提问我都会回复",
            "is_builtin": True,
            "status": 1,
        },
        {
            "name": "剧情钩子 15秒",
            "category": "剧情",
            "template_type": 1,
            "platform": "tiktok",
            "style": "dramatic",
            "duration": 15,
            "description": "强冲突开场，制造悬念吸引完播率",
            "hooks": json.dumps(["没想到它居然……", "千万别在这种情况下用它", "用完之后我当场沉默了"], ensure_ascii=False),
            "outline": json.dumps(["强冲突/意外 (0-5s): 出乎意料的场景", "情绪放大 (5-10s): 反应+情绪渲染", "产品揭晓 (10-15s): 原来是因为它！"], ensure_ascii=False),
            "cta": "关注我，明天继续",
            "is_builtin": True,
            "status": 1,
        },
        {
            "name": "横向对比 45秒",
            "category": "对比",
            "template_type": 1,
            "platform": "youtube",
            "style": "educational",
            "duration": 45,
            "description": "多产品对比，帮助用户做购买决策",
            "hooks": json.dumps(["同价位三款产品实测，差距竟然这么大", "买之前一定要看这个对比", "我替你踩雷了，结果出乎意料"], ensure_ascii=False),
            "outline": json.dumps(["选题引入 (0-5s): 对比缘由/测试标准", "产品A展示 (5-15s): 核心指标演示", "产品B展示 (15-25s): 同一指标对比", "产品C展示 (25-35s): 三方综合对比", "结论给出 (35-45s): 推荐场景+总排名"], ensure_ascii=False),
            "cta": "收藏这条视频，买前再来看看",
            "is_builtin": True,
            "status": 1,
        },
        {
            "name": "用户证言 20秒",
            "category": "种草",
            "template_type": 1,
            "platform": "instagram",
            "style": "conversational",
            "duration": 20,
            "description": "真实感极强的用户体验分享，高信任度",
            "hooks": json.dumps(["我用了3个月，说一下真实感受", "买之前我也犹豫很久，用完我后悔的是没早买", "素人测评，不是广告"], ensure_ascii=False),
            "outline": json.dumps(["身份说明 (0-3s): 我是谁/为什么可信", "使用背景 (3-8s): 什么情况下开始用的", "真实反馈 (8-15s): 优缺点都说", "推荐结论 (15-20s): 适合谁买/不适合谁"], ensure_ascii=False),
            "cta": "有问题欢迎私信",
            "is_builtin": True,
            "status": 1,
        },
    ]
    op.bulk_insert(tmpl_table, [
        {**t, "created_at": _now, "updated_at": _now}
        for t in _builtins
    ])


def downgrade() -> None:
    op.drop_table("search_history")
    op.drop_table("template")
    op.drop_table("render_job")
    op.drop_table("settings")
