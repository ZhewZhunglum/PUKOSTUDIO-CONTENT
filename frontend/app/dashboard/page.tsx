"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Library, Tag, Cpu, HardDrive,
  Film, Sparkles, Zap, ArrowRight,
  Mic, Image as ImageIcon, FileText,
  Clock as ClockIcon, Loader2,
} from "lucide-react";
import { getOverview, getActivity, getStorage } from "@/lib/api/stats";
import { listPipelineRuns, type PipelineRun } from "@/lib/api/pipeline";
import { listProductions, type Production } from "@/lib/api/productions";
import { listTags, type TagOut } from "@/lib/api/tags";
import { platformLabel } from "@/lib/platforms";
import { api } from "@/lib/api";

// ── Helpers ────────────────────────────────────────────────────

const PROJECT_START = new Date("2024-01-01");
const daysSinceStart = () =>
  Math.floor((Date.now() - PROJECT_START.getTime()) / 86_400_000);

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

// ── Sparkline ──────────────────────────────────────────────────

function Sparkline({
  values, color = "var(--accent)", width = 90, height = 22,
}: { values: number[]; color?: string; width?: number; height?: number }) {
  if (!values?.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const area = `0,${height} ${pts} ${width},${height}`;
  const lastY = height -
    ((values[values.length - 1] - min) / range) * (height - 4) - 2;
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <polygon points={area} fill={color} fillOpacity={0.12} />
      <polyline
        points={pts}
        fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx={width} cy={lastY} r={2.5} fill={color} />
    </svg>
  );
}

// ── Meter ──────────────────────────────────────────────────────

function Meter({
  label, used, total, unit = "", tone = "accent", precision = 0,
}: {
  label: string; used: number; total: number; unit?: string;
  tone?: "accent" | "info"; precision?: number;
}) {
  const pct = Math.min(1, used / total);
  const color = tone === "accent" ? "var(--accent)" : "var(--info)";
  return (
    <div style={{ width: 170, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="eyebrow" style={{ fontSize: 9 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28, fontWeight: 500,
            color: "var(--ink-hi)",
            letterSpacing: "-0.02em", lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {unit === "$" ? "$" : ""}
          {used.toFixed(precision)}
          {unit !== "$" ? unit : ""}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--ink-lo)",
          }}
        >
          / {total}{unit === "$" ? "" : unit}
        </span>
      </div>
      <div
        style={{
          height: 4, background: "var(--surface-2)",
          borderRadius: 999, overflow: "hidden", position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            background: color,
            borderRadius: 999,
            transition: "width 0.4s ease",
          }}
        />
        {[0.25, 0.5, 0.75].map((t) => (
          <div
            key={t}
            style={{
              position: "absolute",
              left: `${t * 100}%`,
              top: 0, bottom: 0, width: 1,
              background: "var(--surface-0)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────

function KpiCard({
  label, value, delta, spark, hue,
}: {
  label: string;
  value: string | number;
  delta?: string;
  spark?: number[];
  hue: number;
}) {
  const color = `oklch(70% 0.20 ${hue})`;
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 18px 14px",
        display: "flex", flexDirection: "column", gap: 10,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="eyebrow">{label}</span>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 32, fontWeight: 500,
          letterSpacing: "-0.025em",
          color: "var(--ink-hi)", lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-lo)" }}>
          {delta ?? ""}
        </span>
        {spark && spark.length > 1 && (
          <Sparkline values={spark} color={color} width={90} height={22} />
        )}
      </div>
    </div>
  );
}

// ── Section heading ────────────────────────────────────────────

function SectionHead({
  title, en, action,
}: { title: string; en: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 12, gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 18, fontWeight: 500,
            color: "var(--ink-hi)",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
        <span className="eyebrow">{en}</span>
      </div>
      {action}
    </div>
  );
}

// ── Now Forging strip ──────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  queued: "排队中",
  generating_script: "脚本生成",
  creating_project: "建立项目",
  queuing_generation: "排队 AI 生成",
  generating_videos: "AI 视频生成中",
};

function NowForging({ run }: { run: PipelineRun }) {
  const stage = STAGE_LABEL[run.stage ?? ""] ?? run.stage ?? "处理中";
  const progress = Math.max(0.05, run.completed_clips / Math.max(1, run.clip_count));

  return (
    <Link
      href="/ai/one-click"
      style={{
        background: "linear-gradient(135deg, var(--surface-1) 0%, oklch(13% 0.025 295) 100%)",
        border: "1px solid var(--accent-line)",
        borderRadius: 14,
        padding: "18px 22px",
        marginBottom: 28,
        textDecoration: "none",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 28,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -120, top: -100, width: 320, height: 320, borderRadius: "50%",
          background: "radial-gradient(circle, var(--accent-soft) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 1 }}>
        <div
          style={{
            width: 42, height: 42, borderRadius: 12,
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-line)",
            color: "var(--accent)",
            display: "grid", placeItems: "center",
            animation: "pulse-glow 2.4s ease-in-out infinite",
          }}
        >
          <Zap size={18} />
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="eyebrow" style={{ color: "var(--accent)" }}>● NOW FORGING</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-lo)" }}>
              RUN #{run.id}
            </span>
          </div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 500, color: "var(--ink-hi)" }}>
            {run.product_name}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex", flexDirection: "column", gap: 10,
          minWidth: 0, position: "relative", zIndex: 1,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>
            {stage} · 片段 {run.completed_clips} / {run.clip_count}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: "var(--accent)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {Math.round(progress * 100)}%
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, height: 6 }}>
          {Array.from({ length: run.clip_count }).map((_, i) => {
            const status =
              i < run.completed_clips ? "done"
              : i === run.completed_clips ? "running"
              : "queued";
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  background:
                    status === "done" ? "var(--accent)"
                    : status === "running" ? "var(--accent-soft)"
                    : "var(--surface-2)",
                  borderRadius: 2,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {status === "running" && (
                  <div className="shimmer" style={{ position: "absolute", inset: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px", height: 34,
          background: "var(--accent-soft)",
          border: "1px solid var(--accent-line)",
          borderRadius: 10,
          color: "var(--accent)",
          fontSize: 12, fontWeight: 500,
          position: "relative", zIndex: 1,
        }}
      >
        查看进度 <ArrowRight size={13} />
      </div>
    </Link>
  );
}

// ── Production card ────────────────────────────────────────────

const PROD_STATUS: Record<number, { label: string; tone: string }> = {
  0: { label: "草稿", tone: "neutral" },
  1: { label: "已发布", tone: "good" },
  2: { label: "归档", tone: "neutral" },
};

function StatusTag({ label, tone }: { label: string; tone: string }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    good: {
      bg: "color-mix(in oklch, var(--good) 18%, transparent)",
      fg: "var(--good)",
    },
    neutral: { bg: "oklch(100% 0 0 / 0.06)", fg: "var(--ink-mid)" },
    accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
    bad: {
      bg: "color-mix(in oklch, var(--bad) 18%, transparent)",
      fg: "var(--bad)",
    },
  };
  const t = tones[tone] ?? tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center",
        padding: "3px 9px", borderRadius: 999,
        background: t.bg, color: t.fg,
        fontSize: 10.5, fontWeight: 500, lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  );
}

function ProductionCard({ prod, seed }: { prod: Production; seed: number }) {
  const status = PROD_STATUS[prod.status] ?? PROD_STATUS[0];
  const thumb = prod.asset_thumbnail_url ?? prod.asset_preview_url;
  const durS = prod.asset_duration_ms ? Math.round(prod.asset_duration_ms / 1000) : null;

  return (
    <Link
      href={`/productions`}
      style={{
        display: "block",
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        overflow: "hidden",
        textDecoration: "none",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--line-hi)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--line)";
      }}
    >
      <div
        style={{
          aspectRatio: "9/14",
          background: thumb ? "var(--surface-2)" : gradientFor(seed),
          position: "relative", overflow: "hidden",
        }}
      >
        {thumb ? (
          <img
            src={thumb}
            alt={prod.title}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: patternFor(seed) }} />
        )}
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "oklch(0% 0 0 / 0.45)",
              backdropFilter: "blur(8px)",
              display: "grid", placeItems: "center",
              color: "oklch(98% 0 0)",
            }}
          >
            <Film size={15} />
          </div>
        </div>
        {durS != null && (
          <div
            style={{
              position: "absolute", bottom: 8, right: 8,
              padding: "2px 6px",
              background: "oklch(0% 0 0 / 0.65)",
              borderRadius: 4,
              fontSize: 10,
              color: "oklch(98% 0 0)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {durS}s
          </div>
        )}
        {prod.platform && (
          <div
            style={{
              position: "absolute", top: 8, left: 8,
              padding: "2px 7px",
              background: "oklch(0% 0 0 / 0.55)",
              backdropFilter: "blur(6px)",
              borderRadius: 4, fontSize: 9.5,
              color: "oklch(98% 0 0)",
              letterSpacing: "0.04em",
            }}
          >
            {platformLabel(prod.platform)}
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div
          style={{
            fontSize: 12.5, color: "var(--ink)",
            fontWeight: 500, lineHeight: 1.35,
            whiteSpace: "nowrap", overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {prod.title}
        </div>
        <div
          style={{
            marginTop: 6,
            display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 8,
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-lo)" }}>
            {prod.published_at
              ? new Date(prod.published_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })
              : new Date(prod.created_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
          </span>
          <StatusTag label={status.label} tone={status.tone} />
        </div>
      </div>
    </Link>
  );
}

// ── Activity item icon ─────────────────────────────────────────

const ACTIVITY_ICON: Record<number, React.ReactNode> = {
  1: <ImageIcon size={11} />,
  2: <Film size={11} />,
  3: <Mic size={11} />,
  4: <FileText size={11} />,
};

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return new Date(iso).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

// ── Tag cloud ──────────────────────────────────────────────────

function TagCloud({ tags }: { tags: TagOut[] }) {
  if (tags.length === 0) {
    return (
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "30px 20px",
          textAlign: "center",
          fontSize: 12,
          color: "var(--ink-lo)",
        }}
      >
        暂无标签数据
      </div>
    );
  }
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "20px 22px",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
        {tags.map((t, i) => {
          const sz = Math.max(13, 28 - i * 1.8);
          const hue = PALETTE_HUES[(t.id ?? i) % PALETTE_HUES.length];
          return (
            <Link
              key={t.id}
              href={`/assets?tag=${encodeURIComponent(t.name)}`}
              style={{
                fontFamily: "var(--font-cn)",
                fontSize: sz, fontWeight: 500,
                color: `oklch(78% 0.16 ${hue})`,
                letterSpacing: "-0.01em",
                textDecoration: "none",
                padding: "2px 4px",
                lineHeight: 1.15,
              }}
            >
              {t.name}
              <sub
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9, marginLeft: 3,
                  color: "var(--ink-lo)",
                  verticalAlign: "super",
                  fontWeight: 400,
                }}
              >
                {t.use_count}
              </sub>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Health check rows ──────────────────────────────────────────

const HEALTH_LABELS: Record<string, string> = {
  status: "整体",
  db: "Postgres + pgvector",
  redis: "Redis",
  storage: "Cloudflare R2",
};

function HealthRows({ health }: { health: Record<string, string> | undefined }) {
  const rows = ["status", "db", "redis", "storage"];
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {rows.map((k, i) => {
        const v = health?.[k];
        const ok = v === "ok";
        const loading = !health;
        return (
          <div
            key={k}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 14px",
              borderTop: i ? "1px solid var(--line)" : "none",
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: loading
                  ? "var(--ink-faint)"
                  : ok ? "var(--good)" : "var(--warn)",
                boxShadow:
                  !loading && ok ? "0 0 6px var(--good)"
                  : !loading ? "0 0 6px var(--warn)" : "none",
              }}
            />
            <span style={{ flex: 1, color: "var(--ink)" }}>
              {HEALTH_LABELS[k] ?? k}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)", fontSize: 10.5,
                color: loading
                  ? "var(--ink-lo)"
                  : ok ? "var(--good)" : "var(--warn)",
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}
            >
              {loading ? "…" : v ?? "?"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────

const TYPE_LABEL: Record<number, string> = {
  1: "图片", 2: "视频", 3: "音频", 4: "字幕", 9: "AI 资产", 10: "成片",
};

export default function Dashboard() {
  const { data: overview } = useQuery({
    queryKey: ["stats-overview"], queryFn: getOverview, retry: 1,
  });
  const { data: activity } = useQuery({
    queryKey: ["stats-activity"], queryFn: getActivity, retry: 1,
  });
  const { data: storage } = useQuery({
    queryKey: ["stats-storage"], queryFn: getStorage, retry: 1,
  });
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<Record<string, string>>("/healthz").then((r) => r.data),
    refetchInterval: 30_000,
    retry: false,
  });
  const { data: pipelineRuns } = useQuery({
    queryKey: ["pipeline-runs"],
    queryFn: listPipelineRuns,
    refetchInterval: (q) => {
      const data = q.state.data;
      return (data ?? []).some((r) => r.status === 0) ? 5000 : 30000;
    },
  });
  const { data: productionsRes } = useQuery({
    queryKey: ["productions-recent"],
    queryFn: () => listProductions({ limit: 6 }),
  });
  const { data: tagsRes } = useQuery({
    queryKey: ["tags-top"],
    queryFn: () => listTags({ limit: 12 }),
  });

  const totalAssets = overview?.assets.total ?? 0;
  const totalTags = overview?.tags.total ?? 0;
  const totalCalls = overview?.ai_calls.total ?? 0;
  const aiCost = overview?.ai_calls.total_cost_usd ?? 0;
  const storageGb = storage?.total_gb ?? 0;
  const storageBudgetGb = 2048;
  const aiBudget = 50;

  const [day, setDay] = useState(0);
  const [todayStr, setTodayStr] = useState("");
  const [headerDateStr, setHeaderDateStr] = useState("");
  useEffect(() => {
    const now = new Date();
    setDay(Math.floor((Date.now() - PROJECT_START.getTime()) / 86_400_000));
    setTodayStr(now.toDateString());
    setHeaderDateStr(
      now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" }).toUpperCase()
    );
  }, []);

  const activeRun = pipelineRuns?.find((r) => r.status === 0);
  const productions = productionsRes?.items ?? [];
  const tags = (tagsRes ?? [])
    .slice()
    .sort((a, b) => b.use_count - a.use_count)
    .slice(0, 12);

  const todayProductions = todayStr
    ? productions.filter((p) => new Date(p.created_at).toDateString() === todayStr).length
    : 0;
  const todayUploads = todayStr
    ? (activity?.assets ?? []).filter(
        (a) => new Date((a as { created_at: string }).created_at).toDateString() === todayStr
      ).length
    : 0;

  const events = [
    ...((activity?.assets ?? []) as { id: number; name: string; asset_type: number; created_at: string }[]).map(
      (a) => ({
        id: `a-${a.id}`,
        time: a.created_at,
        text: `上传 ${TYPE_LABEL[a.asset_type] ?? ""} · ${a.name}`,
        icon: ACTIVITY_ICON[a.asset_type] ?? <ImageIcon size={11} />,
        tone: "neutral",
      })
    ),
    ...((activity?.ai_calls ?? []) as { id: number; capability: string; cost_usd: number; created_at: string }[]).map(
      (c) => ({
        id: `c-${c.id}`,
        time: c.created_at,
        text: `AI 调用 · ${c.capability} · $${c.cost_usd.toFixed(3)}`,
        icon: <Sparkles size={11} />,
        tone: "accent",
      })
    ),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 8);

  return (
    <div style={{ maxWidth: 1480, margin: "0 auto", padding: "28px 0 48px" }}>
      {/* ═══ Hero ═══ */}
      <div
        style={{
          marginBottom: 28,
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 40,
          alignItems: "end",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span className="eyebrow">
              STUDIO LOG —{" "}
              {headerDateStr}
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--line)", maxWidth: 200 }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-lo)" }}>
              DAY {day} / ∞
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px, 5vw, 52px)",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1.0,
              color: "var(--ink-hi)",
            }}
          >
            每一帧都将在
            <br />
            <span
              style={{
                background:
                  "linear-gradient(105deg, var(--accent) 0%, var(--accent-2) 60%, oklch(85% 0.10 240) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                fontStyle: "italic", fontWeight: 400,
              }}
            >
              十年后
            </span>
            仍然可以被找到。
          </h1>
          <p
            style={{
              margin: "16px 0 0",
              fontSize: 14, color: "var(--ink-mid)",
              maxWidth: 560, lineHeight: 1.6,
            }}
          >
            今日已生产 <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-hi)" }}>{todayProductions}</span> 条成片
            · 上传 <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-hi)" }}>{todayUploads}</span> 个素材
            · AI 累计 <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>${aiCost.toFixed(2)}</span>
          </p>
        </div>

        <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
          <Meter
            label="R2 STORAGE"
            used={storageGb}
            total={storageBudgetGb}
            unit="GB"
            tone="info"
            precision={1}
          />
          <Meter
            label="AI BUDGET / MAY"
            used={aiCost}
            total={aiBudget}
            unit="$"
            tone="accent"
            precision={2}
          />
        </div>
      </div>

      {/* ═══ NOW FORGING ═══ */}
      {activeRun && <NowForging run={activeRun} />}

      {/* ═══ KPI band ═══ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14, marginBottom: 28,
        }}
      >
        <KpiCard label="ASSETS" value={totalAssets.toLocaleString()} delta={`${activity?.assets?.length ?? 0} 近期`} hue={295} />
        <KpiCard label="TAGS" value={totalTags.toLocaleString()} delta={`字典`} hue={235} />
        <KpiCard label="AI CALLS" value={totalCalls.toLocaleString()} delta={`$${aiCost.toFixed(2)}`} hue={75} />
        <KpiCard label="R2 STORAGE" value={`${storageGb.toFixed(1)} GB`} delta="—" hue={155} />
      </div>

      {/* ═══ Recent productions + Activity feed ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, marginBottom: 28 }}>
        <div>
          <SectionHead
            title="最近成片"
            en="RECENT PRODUCTIONS"
            action={
              <Link href="/productions" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-mid)", textDecoration: "none" }}>
                全部 <ArrowRight size={12} />
              </Link>
            }
          />
          {productions.length === 0 ? (
            <div style={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 14, padding: "40px 24px", textAlign: "center", fontSize: 13, color: "var(--ink-lo)" }}>
              暂无成片 · <Link href="/ai/one-click" style={{ color: "var(--accent)", textDecoration: "none" }}>开始第一个 →</Link>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {productions.map((p, i) => (
                <ProductionCard key={p.id} prod={p} seed={p.id + i * 3} />
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHead title="今日动态" en="TODAY" />
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
            {events.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", fontSize: 12, color: "var(--ink-lo)" }}>暂无动态</div>
            ) : (
              events.map((e, i) => (
                <div key={e.id} style={{ display: "flex", gap: 10, padding: "10px 14px", borderTop: i ? "1px solid var(--line)" : "none", fontSize: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-lo)", fontSize: 10.5, width: 50, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {timeAgo(e.time)}
                  </span>
                  <span style={{ color: e.tone === "accent" ? "var(--accent)" : "var(--ink-lo)", flexShrink: 0, marginTop: 2 }}>
                    {e.icon}
                  </span>
                  <span style={{ color: "var(--ink)", lineHeight: 1.45, flex: 1, minWidth: 0, wordBreak: "break-word" }}>
                    {e.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══ Tag cloud + Health ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        <div>
          <SectionHead title="高频标签" en="TOP TAGS / VOLUME" />
          <TagCloud tags={tags} />
        </div>
        <div>
          <SectionHead title="系统状态" en="HEALTHCHECK" />
          <HealthRows health={health} />
        </div>
      </div>
    </div>
  );
}
