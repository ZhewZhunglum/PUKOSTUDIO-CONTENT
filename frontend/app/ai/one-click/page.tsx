"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap, Loader2, Check, X, Clock as ClockIcon,
  FileText, FolderOpen, Sparkles, Film,
  ChevronRight, Play, Eye, Pause, MoreHorizontal,
  Mic,
} from "lucide-react";
import {
  createPipelineRun,
  listPipelineRuns,
  getPipelineRun,
  type PipelineRun,
  type ScriptClip,
  type OneClickPayload,
} from "../../../lib/api/pipeline";
import { SOCIAL_PLATFORMS, platformLabel } from "../../../lib/platforms";
import { cn } from "../../../lib/utils";

// ── Platform / style options ───────────────────────────────────

const PLATFORM_AR: Record<string, string> = {
  tiktok: "9:16", douyin: "9:16", kuaishou: "9:16",
  youtube: "16:9", bilibili: "16:9",
  instagram: "4:5", xiaohongshu: "3:4",
  weibo: "1:1", x: "1:1",
};

const PREFERRED_PLATFORMS = [
  "douyin", "xiaohongshu", "bilibili", "tiktok", "youtube", "instagram",
];
const PLATFORM_OPTIONS = PREFERRED_PLATFORMS
  .map((v) => SOCIAL_PLATFORMS.find((p) => p.value === v))
  .filter(Boolean) as { value: string; label: string }[];

const STYLES = [
  { value: "conversational", label: "对话式", desc: "口语化 · 像朋友推荐" },
  { value: "dramatic",       label: "戏剧型", desc: "情绪化 · 强冲突" },
  { value: "educational",    label: "教育型", desc: "讲解原理 · 知识感" },
  { value: "humorous",       label: "幽默型", desc: "段子梗 · 反差" },
] as const;

// ── Stage timeline ─────────────────────────────────────────────

const STAGE_ORDER = [
  { key: "queued",              label: "排队",     icon: ClockIcon },
  { key: "generating_script",   label: "脚本",     icon: FileText },
  { key: "creating_project",    label: "建项目",   icon: FolderOpen },
  { key: "queuing_generation",  label: "AI 生成",  icon: Sparkles },
  { key: "generating_videos",   label: "合成",     icon: Film },
  { key: "done",                label: "完成",     icon: Check },
];

function stageIndex(run: PipelineRun): number {
  if (run.status === 1) return STAGE_ORDER.length - 1;
  if (run.status === 2) return Math.max(1, STAGE_ORDER.findIndex((s) => s.key === run.stage));
  const idx = STAGE_ORDER.findIndex((s) => s.key === run.stage);
  return idx === -1 ? 0 : idx;
}

function StagePipe({ run }: { run: PipelineRun }) {
  const currentIdx = stageIndex(run);
  return (
    <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
      {STAGE_ORDER.map((s, i) => {
        const Ic = s.icon;
        const done = i < currentIdx;
        const active = i === currentIdx && run.status === 0;
        const failed = run.status === 2 && i === currentIdx;
        return (
          <div key={s.key} style={{ flex: i === STAGE_ORDER.length - 1 ? "0 0 auto" : "1 1 0", display: "flex", alignItems: "center", minWidth: 0 }}>
            <div
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 6,
                minWidth: 56,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: 28, height: 28, borderRadius: "50%",
                  background:
                    done ? "var(--accent)"
                    : failed ? "var(--bad)"
                    : active ? "var(--accent-soft)"
                    : "var(--surface-2)",
                  border: `1px solid ${active ? "var(--accent)" : "transparent"}`,
                  color:
                    done ? "oklch(15% 0 0)"
                    : failed ? "oklch(98% 0 0)"
                    : active ? "var(--accent)"
                    : "var(--ink-lo)",
                  display: "grid", placeItems: "center",
                  transition: "all 0.25s",
                }}
              >
                {active && (
                  <span
                    style={{
                      position: "absolute", inset: -3, borderRadius: "50%",
                      border: "1px solid var(--accent-line)",
                      animation: "pulse-glow 2s ease-in-out infinite",
                    }}
                  />
                )}
                <Ic size={12} />
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  color:
                    active ? "var(--accent)"
                    : done ? "var(--ink-mid)"
                    : "var(--ink-lo)",
                  fontWeight: active ? 500 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {s.label}
              </span>
            </div>
            {i < STAGE_ORDER.length - 1 && (
              <div
                style={{
                  flex: 1, height: 1, marginTop: -16,
                  background: done ? "var(--accent)" : "var(--line)",
                  transition: "background 0.3s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Pill ───────────────────────────────────────────────────────

function Pill({
  tone = "neutral", children,
}: { tone?: "accent" | "good" | "bad" | "neutral"; children: React.ReactNode }) {
  const tones = {
    accent:  { bg: "var(--accent-soft)", fg: "var(--accent)" },
    good:    { bg: "color-mix(in oklch, var(--good) 18%, transparent)", fg: "var(--good)" },
    bad:     { bg: "color-mix(in oklch, var(--bad) 18%, transparent)",  fg: "var(--bad)" },
    neutral: { bg: "oklch(100% 0 0 / 0.06)", fg: "var(--ink-mid)" },
  } as const;
  const t = tones[tone];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "3px 9px", borderRadius: 999,
        background: t.bg, color: t.fg,
        fontSize: 11, fontWeight: 500, lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// ── Run history rail ───────────────────────────────────────────

function RunDot({ status }: { status: number }) {
  if (status === 0)
    return (
      <span
        style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "var(--accent)",
          boxShadow: "0 0 0 3px var(--accent-soft)",
          animation: "pulse-glow 1.6s ease-in-out infinite",
        }}
      />
    );
  if (status === 1)
    return <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--good)" }} />;
  if (status === 2)
    return <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--bad)" }} />;
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ink-faint)" }} />;
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "刚刚";
  if (d < 3600) return `${Math.floor(d / 60)} 分钟前`;
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`;
  return new Date(iso).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function HistoryRail({
  runs, activeId, onSelect, loading,
}: {
  runs: PipelineRun[]; activeId: number | null; loading: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <aside
      style={{
        width: 280, flexShrink: 0,
        border: "1px solid var(--line)",
        borderRadius: 16,
        background: "oklch(100% 0 0 / 0.035)",
        display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 16px 14px",
          borderBottom: "1px solid var(--line)",
          display: "flex", flexDirection: "column", gap: 6,
        }}
      >
        <span className="eyebrow">PIPELINE · HISTORY</span>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 18, fontWeight: 500,
            color: "var(--ink-hi)",
          }}
        >
          生产记录
        </h2>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && (
          <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--ink-lo)" }} />
          </div>
        )}
        {!loading && runs.length === 0 && (
          <p style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: "var(--ink-lo)" }}>
            暂无生产记录
          </p>
        )}
        {runs.map((run) => {
          const isActive = run.id === activeId;
          return (
            <button
              key={run.id}
              onClick={() => onSelect(run.id)}
              style={{
                position: "relative",
                display: "flex", flexDirection: "column", gap: 4,
                width: "100%", padding: "12px 16px",
                background: isActive ? "oklch(100% 0 0 / 0.04)" : "transparent",
                border: "none", borderBottom: "1px solid var(--line-lo)",
                cursor: "pointer", textAlign: "left",
                transition: "background 0.12s",
                color: "inherit",
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLButtonElement).style.background = "oklch(100% 0 0 / 0.02)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: 2, background: "var(--accent)",
                  }}
                />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <RunDot status={run.status} />
                <span
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 9.5,
                    color: "var(--ink-lo)", letterSpacing: "0.1em",
                  }}
                >
                  #{run.id}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 9.5,
                    color: "var(--ink-lo)", marginLeft: "auto",
                  }}
                >
                  {timeAgo(run.created_at)}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: isActive ? "var(--ink-hi)" : "var(--ink)",
                  fontWeight: 500, lineHeight: 1.3,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {run.product_name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, color: "var(--ink-lo)", fontSize: 10.5 }}>
                <span>{platformLabel(run.platform)}</span>
                <span style={{ color: "var(--ink-faint)" }}>·</span>
                <span>{run.style}</span>
                <span style={{ color: "var(--ink-faint)" }}>·</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{run.clip_count}clip</span>
              </div>
              {run.status === 0 && run.clip_count > 0 && (
                <div
                  style={{
                    height: 3, background: "var(--surface-2)",
                    borderRadius: 999, marginTop: 6, overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.max(5, run.completed_clips * 100 / Math.max(1, run.clip_count))}%`,
                      background: "var(--accent)",
                      borderRadius: 999,
                    }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// ── Active run header ──────────────────────────────────────────

const STAGE_DISPLAY: Record<string, string> = {
  queued: "排队中",
  generating_script: "脚本生成中",
  creating_project: "创建项目中",
  queuing_generation: "排队 AI 生成",
  generating_videos: "AI 视频生成中",
};

function ActiveHeader({ run }: { run: PipelineRun }) {
  let tone: "accent" | "good" | "bad" = "accent";
  let icon: React.ReactNode = <Loader2 size={10} className="animate-spin" />;
  let label = STAGE_DISPLAY[run.stage ?? ""] ?? run.stage ?? "处理中";
  if (run.status === 1) {
    tone = "good"; icon = <Check size={11} />; label = "已完成";
  } else if (run.status === 2) {
    tone = "bad"; icon = <X size={11} />; label = run.error_message ? "失败" : "失败";
  }

  return (
    <div
      style={{
        padding: "20px 28px 18px",
        borderBottom: "1px solid var(--line)",
        flexShrink: 0,
        background: "linear-gradient(180deg, oklch(11% 0.022 295) 0%, var(--surface-0) 100%)",
        position: "relative", overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -120, top: -100, width: 280, height: 280,
          background: "radial-gradient(circle, var(--accent-soft), transparent 60%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 18, position: "relative" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span className="eyebrow">PIPELINE · ONE-CLICK · RUN #{run.id}</span>
            <Pill tone={tone}>{icon}{label}</Pill>
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: 28, fontWeight: 500,
              letterSpacing: "-0.025em",
              color: "var(--ink-hi)", lineHeight: 1.1,
            }}
          >
            {run.product_name}
          </h1>
          <div style={{ marginTop: 8, display: "flex", gap: 18, fontSize: 12, color: "var(--ink-mid)" }}>
            <span><span style={{ color: "var(--ink-lo)" }}>平台 </span>{platformLabel(run.platform)}</span>
            <span><span style={{ color: "var(--ink-lo)" }}>风格 </span>{run.style}</span>
            <span><span style={{ color: "var(--ink-lo)" }}>时长 </span><span style={{ fontFamily: "var(--font-mono)" }}>{run.duration_seconds}s</span></span>
            <span><span style={{ color: "var(--ink-lo)" }}>片段 </span><span style={{ fontFamily: "var(--font-mono)" }}>{run.completed_clips} / {run.clip_count}</span></span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {run.status === 0 && <Btn variant="ghost" icon={<Pause size={12} />}>暂停</Btn>}
          {run.status === 1 && run.video_project_id && (
            <a
              href={`/ai/video`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 34, padding: "0 14px",
                background: "var(--accent)",
                color: "oklch(15% 0 0)",
                fontSize: 13, fontWeight: 600,
                borderRadius: 10, textDecoration: "none",
              }}
            >
              <Film size={12} /> 打开项目
            </a>
          )}
        </div>
      </div>
      <StagePipe run={run} />
      {run.status === 2 && run.error_message && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "color-mix(in oklch, var(--bad) 10%, transparent)",
            border: "1px solid color-mix(in oklch, var(--bad) 30%, transparent)",
            borderRadius: 10,
            fontSize: 12, color: "var(--bad)",
          }}
        >
          <strong>错误：</strong>{run.error_message}
        </div>
      )}
    </div>
  );
}

// ── Storyboard ─────────────────────────────────────────────────

const PALETTE_HUES = [12, 35, 75, 130, 175, 210, 245, 280, 320];
function gradientFor(seed: number): string {
  const h1 = PALETTE_HUES[seed % PALETTE_HUES.length];
  const h2 = PALETTE_HUES[(seed * 7 + 3) % PALETTE_HUES.length];
  const ang = (seed * 47) % 360;
  return `linear-gradient(${ang}deg, oklch(38% 0.16 ${h1}) 0%, oklch(22% 0.09 ${h2}) 100%)`;
}
function patternFor(seed: number): string {
  const t = seed % 4;
  if (t === 0) return "radial-gradient(circle at 20% 80%, oklch(100% 0 0 / 0.14), transparent 50%)";
  if (t === 1) return "linear-gradient(135deg, oklch(100% 0 0 / 0.10) 0%, transparent 60%)";
  if (t === 2) return "radial-gradient(ellipse at top, oklch(100% 0 0 / 0.10), transparent 70%)";
  return `conic-gradient(from ${seed * 30}deg at 70% 30%, oklch(100% 0 0 / 0.12), transparent 50%)`;
}

const TYPE_LABEL: Record<string, string> = {
  hook: "钩子",
  show: "产品展示",
  compare: "对比",
  evidence: "证据",
  cta: "号召",
  intro: "开场",
  product: "产品",
  scene: "场景",
  outro: "结尾",
};

function clipStatus(
  i: number,
  run: PipelineRun
): { tone: "good" | "accent" | "neutral"; label: string; icon: React.ReactNode } {
  if (run.status === 1)
    return { tone: "good", label: "已生成", icon: <Check size={11} /> };
  if (i < run.completed_clips)
    return { tone: "good", label: "已生成", icon: <Check size={11} /> };
  if (i === run.completed_clips && run.status === 0)
    return { tone: "accent", label: "生成中", icon: <Loader2 size={11} className="animate-spin" /> };
  return { tone: "neutral", label: "等待中", icon: <ClockIcon size={11} /> };
}

function ClipCard({
  clip, index, run,
}: { clip: ScriptClip; index: number; run: PipelineRun }) {
  const s = clipStatus(index, run);
  const seed = run.id * 13 + index * 7 + 3;
  const isRunning = s.tone === "accent";

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: `1px solid ${isRunning ? "var(--accent-line)" : "var(--line)"}`,
        borderRadius: 14,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "44px 110px 1fr auto",
        transition: "border-color 0.2s",
      }}
    >
      <div
        style={{
          background: "oklch(100% 0 0 / 0.02)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 4, borderRight: "1px solid var(--line)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22, fontWeight: 600,
            color: "var(--ink-hi)",
            fontStyle: "italic", lineHeight: 1,
            letterSpacing: "-0.04em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-lo)" }}>
          {(clip.duration_ms / 1000).toFixed(1)}s
        </span>
      </div>

      <div
        style={{
          aspectRatio: "9/16",
          background: gradientFor(seed),
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: patternFor(seed) }} />
        <div
          style={{
            position: "absolute", inset: 0,
            display: "grid", placeItems: "center",
            color: s.tone === "good" ? "oklch(100% 0 0 / 0.7)" : "oklch(100% 0 0 / 0.3)",
          }}
        >
          {s.tone === "good" && <Play size={16} />}
          {isRunning && <Loader2 size={18} className="animate-spin" />}
          {s.tone === "neutral" && <ClockIcon size={14} />}
        </div>
        {isRunning && (
          <div className="shimmer" style={{ position: "absolute", inset: 0 }} />
        )}
      </div>

      <div
        style={{
          padding: "12px 16px",
          display: "flex", flexDirection: "column", gap: 6,
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              padding: "1px 7px",
              borderRadius: 4,
              background: "var(--surface-2)",
              fontSize: 10, color: "var(--ink-mid)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.05em",
            }}
          >
            {clip.type}
          </span>
          <span style={{ fontSize: 11.5, color: "var(--ink-lo)" }}>
            {TYPE_LABEL[clip.type] ?? ""}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-hi)", lineHeight: 1.45 }}>
          {clip.prompt}
        </div>
        {clip.narration && (
          <div
            style={{
              marginTop: 2,
              padding: "6px 10px",
              background: "oklch(100% 0 0 / 0.02)",
              borderLeft: "2px solid var(--accent-line)",
              fontSize: 12, color: "var(--ink-mid)",
              fontStyle: "italic",
              fontFamily: "var(--font-display)",
            }}
          >
            <Mic
              size={10}
              style={{
                display: "inline", marginRight: 6,
                verticalAlign: "middle", color: "var(--ink-lo)",
              }}
            />
            {clip.narration}
          </div>
        )}
      </div>

      <div
        style={{
          padding: "12px 16px",
          display: "flex", flexDirection: "column",
          alignItems: "flex-end", justifyContent: "space-between", gap: 6,
        }}
      >
        <Pill tone={s.tone}>{s.icon}{s.label}</Pill>
        <button
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--ink-lo)", padding: 4,
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    </div>
  );
}

function Storyboard({ run }: { run: PipelineRun }) {
  const script = run.script_json;
  if (!script) {
    return (
      <div style={{ flex: 1, overflow: "auto", padding: "20px 28px", display: "grid", placeItems: "center" }}>
        <div
          style={{
            textAlign: "center", color: "var(--ink-lo)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          }}
        >
          <Loader2 size={20} className="animate-spin" />
          <span style={{ fontSize: 12 }}>等待脚本生成…</span>
        </div>
      </div>
    );
  }
  const totalMs = script.clips.reduce((s, c) => s + c.duration_ms, 0);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "20px 28px 28px" }}>
      <div style={{ marginBottom: 18, display: "flex", gap: 12 }}>
        {script.title && (
          <div
            style={{
              flex: 1,
              background: "var(--surface-1)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "14px 16px",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 4 }}>SCRIPT · TITLE</div>
            <div style={{ fontSize: 14, color: "var(--ink-hi)", fontWeight: 500 }}>{script.title}</div>
          </div>
        )}
        {script.hook && (
          <div
            style={{
              flex: 1.3,
              background: "var(--surface-1)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "14px 16px",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 4 }}>HOOK · 开场钩子</div>
            <div
              style={{
                fontSize: 14, color: "var(--ink-hi)",
                fontStyle: "italic",
                fontFamily: "var(--font-display)",
              }}
            >
              "{script.hook}"
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex", alignItems: "baseline",
          justifyContent: "space-between", marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: 16, fontWeight: 500,
              color: "var(--ink-hi)",
            }}
          >
            分镜
          </h2>
          <span className="eyebrow">
            STORYBOARD · {script.clips.length} CLIPS · {(totalMs / 1000).toFixed(1)}S
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {script.clips.map((clip, i) => (
          <ClipCard key={i} clip={clip} index={i} run={run} />
        ))}
      </div>

      {script.tags && script.tags.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>SUGGESTED TAGS / 建议标签</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {script.tags.map((t) => (
              <span
                key={t}
                style={{
                  padding: "4px 10px", borderRadius: 999,
                  background: "var(--surface-1)",
                  border: "1px solid var(--line)",
                  fontSize: 11.5, color: "var(--ink-mid)",
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Right brief panel ──────────────────────────────────────────

function Btn({
  variant = "ghost", icon, children, ...rest
}: {
  variant?: "primary" | "ghost";
  icon?: React.ReactNode;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: { background: "var(--accent)", color: "oklch(15% 0 0)", fontWeight: 600, border: "none" },
    ghost: { background: "transparent", color: "var(--ink-mid)", border: "1px solid var(--line)" },
  } as const;
  return (
    <button
      {...rest}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: 6,
        height: 34, padding: "0 14px",
        fontFamily: "var(--font-ui)",
        fontSize: 13, fontWeight: 500,
        borderRadius: 10, cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.15s",
        ...variants[variant],
        ...rest.style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 12px",
  background: "var(--surface-1)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  color: "var(--ink-hi)", fontSize: 12.5,
  fontFamily: "var(--font-cn)",
  outline: "none",
};

function Field({
  label, required, right, children,
}: {
  label: string; required?: boolean; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 11, color: "var(--ink-mid)", fontWeight: 500 }}>
          {label}
          {required && <span style={{ color: "var(--bad)", marginLeft: 4 }}>*</span>}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}

function BriefForm({
  productName, setProductName,
  description, setDescription,
  platform, setPlatform,
  style, setStyle,
  duration, setDuration,
  clipCount, setClipCount,
  onSubmit, submitting, errorMsg,
}: {
  productName: string; setProductName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  platform: string; setPlatform: (v: string) => void;
  style: OneClickPayload["style"]; setStyle: (v: OneClickPayload["style"]) => void;
  duration: number; setDuration: (v: number) => void;
  clipCount: number; setClipCount: (v: number) => void;
  onSubmit: () => void; submitting: boolean; errorMsg?: string;
}) {
  const seedanceUnit = 0.064;
  const tts = 0.024;
  const script = 0.018;
  const estTotal = script + clipCount * seedanceUnit + tts;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px" }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>BRIEF · 创建新任务</div>

      <Field label="产品名称" required>
        <input
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="如：兰蔻小黑瓶精华液"
          style={inputStyle}
        />
      </Field>

      <Field label="产品描述 / 卖点">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="产品卖点、目标人群、核心功效…"
          rows={3}
          style={{ ...inputStyle, height: "auto", resize: "none", lineHeight: 1.5, padding: "10px 12px" }}
        />
      </Field>

      <Field label="发布平台">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
          {PLATFORM_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPlatform(p.value)}
              style={{
                padding: "8px 6px",
                background: platform === p.value ? "var(--accent-soft)" : "var(--surface-1)",
                border: `1px solid ${platform === p.value ? "var(--accent-line)" : "var(--line)"}`,
                borderRadius: 8, cursor: "pointer",
                color: platform === p.value ? "var(--accent)" : "var(--ink-mid)",
                fontSize: 11.5,
                fontFamily: "var(--font-cn)",
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 2,
                transition: "all 0.12s",
              }}
            >
              <span>{p.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.6 }}>
                {PLATFORM_AR[p.value] ?? "—"}
              </span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="风格">
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStyle(s.value)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px",
                background: style === s.value ? "var(--accent-soft)" : "var(--surface-1)",
                border: `1px solid ${style === s.value ? "var(--accent-line)" : "var(--line)"}`,
                borderRadius: 8, cursor: "pointer",
                color: style === s.value ? "var(--accent)" : "var(--ink-mid)",
                fontSize: 12,
                fontFamily: "var(--font-cn)",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: `1.5px solid ${style === s.value ? "var(--accent)" : "var(--line-hi)"}`,
                  background: style === s.value ? "var(--accent)" : "transparent",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 10.5, opacity: 0.7 }}>{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field
          label="时长"
          right={<span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontSize: 12 }}>{duration}s</span>}
        >
          <input
            type="range" min={10} max={120} step={5} value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: "100%", marginTop: 4 }}
          />
        </Field>
        <Field
          label="片段数"
          right={<span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontSize: 12 }}>{clipCount}</span>}
        >
          <input
            type="range" min={2} max={10} step={1} value={clipCount}
            onChange={(e) => setClipCount(Number(e.target.value))}
            style={{ width: "100%", marginTop: 4 }}
          />
        </Field>
      </div>

      <div
        style={{
          marginTop: 18, padding: "12px 14px",
          background: "var(--surface-1)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          fontSize: 11.5,
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 8, fontSize: 9 }}>ESTIMATED · 预估</div>
        {[
          ["Claude · 脚本", `$${script.toFixed(3)}`],
          [`Seedance · ${clipCount} 段视频`, `$${(clipCount * seedanceUnit).toFixed(3)}`],
          ["ElevenLabs · TTS", `$${tts.toFixed(3)}`],
        ].map(([k, v], i) => (
          <div
            key={i}
            style={{
              display: "flex", justifyContent: "space-between",
              padding: "3px 0", color: "var(--ink-mid)",
            }}
          >
            <span>{k}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{v}</span>
          </div>
        ))}
        <div style={{ height: 1, background: "var(--line)", margin: "6px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
          <span style={{ color: "var(--ink-hi)", fontWeight: 500 }}>合计</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--accent)", fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${estTotal.toFixed(3)}
          </span>
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--ink-lo)" }}>
          预计耗时 ~<span style={{ fontFamily: "var(--font-mono)" }}>{Math.round(clipCount * 22 + 8)}</span>秒
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            marginTop: 12, padding: "10px 12px",
            background: "color-mix(in oklch, var(--bad) 10%, transparent)",
            border: "1px solid color-mix(in oklch, var(--bad) 30%, transparent)",
            borderRadius: 10,
            fontSize: 12, color: "var(--bad)",
          }}
        >
          {errorMsg}
        </div>
      )}

      <button
        disabled={!productName.trim() || submitting}
        onClick={onSubmit}
        style={{
          marginTop: 14,
          width: "100%", height: 44,
          background: "var(--accent)",
          color: "oklch(15% 0 0)",
          border: "none", borderRadius: 11,
          fontSize: 13.5, fontWeight: 600,
          fontFamily: "var(--font-cn)",
          cursor: submitting || !productName.trim() ? "not-allowed" : "pointer",
          opacity: submitting || !productName.trim() ? 0.4 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: "0 8px 24px var(--accent-soft)",
          transition: "opacity 0.15s",
        }}
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {submitting ? "提交中…" : "开始一键成片"}
      </button>
    </div>
  );
}

// ── Right panel with tabs ──────────────────────────────────────

const TABS = [
  { key: "brief", label: "新建任务" },
  { key: "log",   label: "实时日志" },
  { key: "diag",  label: "诊断" },
] as const;

function RightPanel(props: React.ComponentProps<typeof BriefForm> & { activeRun: PipelineRun | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("brief");
  return (
    <aside
      style={{
        display: "flex", flexDirection: "column",
        height: "100%", overflow: "hidden",
        width: 380, flexShrink: 0,
        border: "1px solid var(--line)",
        borderRadius: 16,
        background: "oklch(100% 0 0 / 0.035)",
      }}
    >
      <div
        style={{
          height: 44, display: "flex", alignItems: "center",
          padding: "0 8px",
          borderBottom: "1px solid var(--line)",
          flexShrink: 0,
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                position: "relative",
                flex: 1,
                padding: "12px 12px",
                background: "transparent", border: "none", cursor: "pointer",
                color: active ? "var(--ink-hi)" : "var(--ink-mid)",
                fontSize: 12, fontWeight: active ? 600 : 400,
                fontFamily: "var(--font-cn)",
                letterSpacing: "0.02em", textAlign: "center",
              }}
            >
              {t.label}
              {active && (
                <span
                  style={{
                    position: "absolute", left: 12, right: 12, bottom: 0,
                    height: 1.5,
                    background: "var(--accent)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {tab === "brief" && <BriefForm {...props} />}
      {tab === "log" && <LogPanel run={props.activeRun} />}
      {tab === "diag" && <DiagPanel />}
    </aside>
  );
}

function LogPanel({ run }: { run: PipelineRun | null }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!run || run.status !== 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 1100);
    return () => clearInterval(id);
  }, [run]);

  if (!run) {
    return (
      <div style={{ flex: 1, padding: 20, fontSize: 12, color: "var(--ink-lo)" }}>
        选择一条记录以查看日志
      </div>
    );
  }

  // Synthesize a simple log stream from run state
  const lines: { t: string; lvl: "info" | "ok" | "warn"; msg: string }[] = [];
  const t0 = new Date(run.created_at).getTime();
  function ts(offsetS: number) {
    const s = Math.max(0, offsetS);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  lines.push({ t: ts(0), lvl: "info", msg: `pipeline.run id=${run.id} start` });
  if (run.stage !== "queued") {
    lines.push({ t: ts(1), lvl: "info", msg: "claude.script.gen request" });
    lines.push({ t: ts(14), lvl: "ok", msg: `script.gen ok · ${run.script_json?.clips.length ?? 0} clips` });
  }
  if (run.video_project_id) {
    lines.push({ t: ts(16), lvl: "info", msg: `video.project.create id=${run.video_project_id}` });
  }
  for (let i = 0; i < run.completed_clips; i++) {
    lines.push({ t: ts(20 + i * 30), lvl: "ok", msg: `clip=${i + 1} ready · 1080×1920` });
  }
  if (run.status === 2 && run.error_message) {
    lines.push({ t: ts(99), lvl: "warn", msg: `error: ${run.error_message}` });
  }
  if (run.status === 1) {
    lines.push({ t: ts(99), lvl: "ok", msg: "pipeline.done" });
  }

  const lvlColor = { info: "var(--ink-mid)", ok: "var(--good)", warn: "var(--warn)" } as const;

  return (
    <div
      style={{
        flex: 1, overflow: "auto",
        padding: "14px 16px",
        fontFamily: "var(--font-mono)",
        fontSize: 11.5, lineHeight: 1.6,
        background: "var(--surface-0)",
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 10 }}>LIVE LOG · run #{run.id}</div>
      {lines.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "2px 0", color: "var(--ink)" }}>
          <span style={{ color: "var(--ink-faint)" }}>{l.t}</span>
          <span style={{ color: lvlColor[l.lvl], width: 38, flexShrink: 0 }}>[{l.lvl.toUpperCase()}]</span>
          <span style={{ color: "var(--ink-mid)" }}>{l.msg}</span>
        </div>
      ))}
      {run.status === 0 && (
        <div style={{ display: "flex", gap: 10, padding: "2px 0", color: "var(--accent)" }}>
          <span style={{ color: "var(--ink-faint)" }}>—:—</span>
          <span style={{ color: "var(--accent)", width: 38, flexShrink: 0 }}>[…]</span>
          <span>
            polling… {STAGE_DISPLAY[run.stage ?? ""] ?? run.stage}{" "}
            <span
              style={{
                display: "inline-block", marginLeft: 4,
                width: 6, height: 12,
                background: "var(--accent)",
                verticalAlign: "middle",
                opacity: tick % 2 ? 0 : 1,
              }}
            />
          </span>
        </div>
      )}
    </div>
  );
}

function DiagPanel() {
  const items = [
    { k: "Provider · Replicate",  v: "ok", detail: "queue depth · p95 latency" },
    { k: "Provider · Anthropic",  v: "ok", detail: "claude-sonnet-4-7" },
    { k: "Provider · OpenAI",     v: "ok", detail: "gpt-image-1" },
    { k: "Storage · R2",          v: "ok", detail: "Cloudflare R2" },
    { k: "Worker · video",        v: "ok", detail: "background queue" },
    { k: "Worker · script",       v: "ok", detail: "idle" },
  ];
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "18px 18px" }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>DIAGNOSTICS</div>
      {items.map((row, i) => (
        <div
          key={i}
          style={{
            display: "flex", flexDirection: "column", gap: 4,
            padding: "10px 0",
            borderBottom: i < items.length - 1 ? "1px solid var(--line-lo)" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--good)",
                boxShadow: "0 0 6px var(--good)",
              }}
            />
            <span style={{ flex: 1, fontSize: 12, color: "var(--ink)" }}>{row.k}</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10, color: "var(--good)",
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}
            >
              {row.v}
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5, color: "var(--ink-lo)",
              paddingLeft: 14,
            }}
          >
            {row.detail}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────

function EmptyMain() {
  return (
    <div
      style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 16, padding: 40, color: "var(--ink-lo)",
      }}
    >
      <div
        style={{
          width: 56, height: 56, borderRadius: 16,
          background: "var(--accent-soft)",
          border: "1px solid var(--accent-line)",
          color: "var(--accent)",
          display: "grid", placeItems: "center",
        }}
      >
        <Zap size={22} />
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: 24, fontWeight: 500,
          color: "var(--ink-hi)",
          letterSpacing: "-0.025em",
        }}
      >
        一键成片
      </h2>
      <p style={{ fontSize: 13, textAlign: "center", maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
        填写右侧任务表单 · Claude 生成脚本 · Seedance AI 并行生成片段 · FFmpeg 合成最终视频。
      </p>
      <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
        {[
          { i: "①", t: "脚本结构" },
          { i: "②", t: "建立项目" },
          { i: "③", t: "AI 生成" },
          { i: "④", t: "合成成片" },
        ].map((s) => (
          <div key={s.i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-faint)", fontStyle: "italic" }}>
              {s.i}
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-lo)" }}>{s.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function OneClickPage() {
  const qc = useQueryClient();
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState<string>("douyin");
  const [style, setStyle] = useState<OneClickPayload["style"]>("conversational");
  const [duration, setDuration] = useState(30);
  const [clipCount, setClipCount] = useState(5);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);

  const { data: runs = [], isLoading: loadingRuns } = useQuery({
    queryKey: ["pipeline-runs"],
    queryFn: listPipelineRuns,
    refetchInterval: (q) => {
      const data = q.state.data;
      return (data ?? []).some((r: { status: number }) => r.status === 0) ? 5000 : false;
    },
  });

  const activeRun = runs.find((r) => r.id === activeRunId) ?? null;
  const isPolling = activeRun?.status === 0;

  const { data: runDetail } = useQuery({
    queryKey: ["pipeline-run", activeRunId],
    queryFn: () => getPipelineRun(activeRunId!),
    enabled: !!activeRunId,
    refetchInterval: isPolling ? 3000 : false,
  });

  const displayRun = runDetail ?? activeRun;

  const createMut = useMutation({
    mutationFn: () =>
      createPipelineRun({
        product_name: productName.trim(),
        product_description: description.trim() || undefined,
        platform,
        style,
        duration_seconds: duration,
        clip_count: clipCount,
      }),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ["pipeline-runs"] });
      setActiveRunId(run.id);
    },
  });

  // Auto-select latest running if none active
  useEffect(() => {
    if (activeRunId == null && runs.length > 0) {
      const running = runs.find((r) => r.status === 0);
      if (running) setActiveRunId(running.id);
    }
  }, [runs, activeRunId]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px minmax(0, 1fr) 380px",
        gap: 16,
        height: "100%", overflow: "hidden",
        maxWidth: 1680,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <HistoryRail
        runs={runs}
        activeId={activeRunId}
        onSelect={setActiveRunId}
        loading={loadingRuns}
      />

      <main
        style={{
          display: "flex", flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
          border: "1px solid var(--line)",
          borderRadius: 16,
          background: "oklch(100% 0 0 / 0.025)",
        }}
      >
        {displayRun ? (
          <>
            <ActiveHeader run={displayRun} />
            <Storyboard run={displayRun} />
          </>
        ) : (
          <EmptyMain />
        )}
      </main>

      <RightPanel
        activeRun={displayRun}
        productName={productName} setProductName={setProductName}
        description={description} setDescription={setDescription}
        platform={platform} setPlatform={setPlatform}
        style={style} setStyle={setStyle}
        duration={duration} setDuration={setDuration}
        clipCount={clipCount} setClipCount={setClipCount}
        onSubmit={() => createMut.mutate()}
        submitting={createMut.isPending}
        errorMsg={createMut.isError ? (createMut.error as Error)?.message ?? "提交失败" : undefined}
      />
    </div>
  );
}
