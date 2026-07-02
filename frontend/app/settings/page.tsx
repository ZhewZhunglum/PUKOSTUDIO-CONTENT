"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings, RefreshCw, Eye, EyeOff, Check, Loader2, Key,
  Zap, X as XIcon, CheckCircle2, AlertCircle,
} from "lucide-react";
import { api } from "../../lib/api";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusPill } from "../../components/ui/StatusPill";

// ── Types ────────────────────────────────────────────────────────

interface HealthStatus { status: string; db: string; redis: string; storage: string }

interface KeyInfo {
  key: string; label: string; capability: string; env: string;
  configured: boolean; masked: string;
}
interface KeysResponse { keys: KeyInfo[] }

interface TestResult {
  key: string; label: string; ok: boolean;
  latency_ms: number | null; detail: string;
}

// ── API helpers ──────────────────────────────────────────────────

async function getHealth(): Promise<HealthStatus> {
  const { data } = await api.get<HealthStatus>("/healthz");
  return data;
}
async function getAiKeys(): Promise<KeysResponse> {
  const { data } = await api.get<KeysResponse>("/api/settings/ai-keys");
  return data;
}
async function saveAiKeys(updates: Record<string, string>): Promise<KeysResponse> {
  const { data } = await api.put<KeysResponse>("/api/settings/ai-keys", { updates });
  return data;
}
async function testAiKey(key: string): Promise<TestResult> {
  const { data } = await api.post<TestResult>(`/api/settings/ai-keys/${key}/test`);
  return data;
}

const TECH_STACK = [
  { label: "Backend",    value: "Python 3.11 + FastAPI" },
  { label: "Database",   value: "PostgreSQL 16 + pgvector + pg_trgm" },
  { label: "Cache",      value: "Redis 7" },
  { label: "Storage",    value: "MinIO (local) / Cloudflare R2 (prod)" },
  { label: "Task Queue", value: "PostgreSQL task + asyncio workers" },
  { label: "Frontend",   value: "Next.js 14 App Router" },
];
const SERVICE_CHECKS = [
  { key: "db" as const, label: "PostgreSQL" },
  { key: "redis" as const, label: "Redis" },
  { key: "storage" as const, label: "MinIO / R2" },
];

// ── TestBadge ────────────────────────────────────────────────────

function TestBadge({ result }: { result: TestResult | null | "loading" }) {
  if (result === "loading") {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--ink-lo)" }}>
        <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
        测试中…
      </span>
    );
  }
  if (!result) return null;
  if (result.ok) {
    return (
      <span style={{
        display: "flex", alignItems: "center", gap: 4,
        fontSize: 11, color: "oklch(72% 0.18 142)",
        background: "oklch(72% 0.18 142 / 0.12)",
        border: "1px solid oklch(72% 0.18 142 / 0.25)",
        borderRadius: 6, padding: "2px 8px",
      }}>
        <CheckCircle2 size={11} />
        {result.latency_ms != null ? `${result.latency_ms}ms` : "OK"}
        {result.detail ? ` · ${result.detail}` : ""}
      </span>
    );
  }
  return (
    <span style={{
      display: "flex", alignItems: "center", gap: 4,
      fontSize: 11, color: "#f87171",
      background: "rgba(248,113,113,0.10)",
      border: "1px solid rgba(248,113,113,0.25)",
      borderRadius: 6, padding: "2px 8px",
      maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    }}
    title={result.detail}
    >
      <AlertCircle size={11} />
      失败 {result.detail ? `· ${result.detail.slice(0, 50)}` : ""}
    </span>
  );
}

// ── KeyRow ───────────────────────────────────────────────────────

function KeyRow({
  info, inputVal, showVal, testState,
  onInput, onToggleShow, onTest,
}: {
  info: KeyInfo;
  inputVal: string;
  showVal: boolean;
  testState: TestResult | null | "loading";
  onInput: (v: string) => void;
  onToggleShow: () => void;
  onTest: () => void;
}) {
  const isDirty = inputVal !== "";
  const isConfigured = info.configured;
  const canTest = isConfigured && testState !== "loading";

  return (
    <div style={{
      padding: "14px 0",
      borderBottom: "1px solid var(--line)",
    }}>
      {/* Top row: label + status + test badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          background: isConfigured ? "oklch(72% 0.18 142)" : "oklch(50% 0 0)",
        }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-hi)", flex: 1 }}>
          {info.label}
        </span>
        <TestBadge result={testState} />
        {isConfigured && (
          <button
            type="button"
            onClick={onTest}
            disabled={!canTest}
            title="测试 API 连通性"
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "3px 10px", borderRadius: 7,
              background: "var(--surface-0)",
              border: "1px solid var(--line-hi)",
              color: canTest ? "var(--accent)" : "var(--ink-lo)",
              fontSize: 11, fontWeight: 500,
              cursor: canTest ? "pointer" : "not-allowed",
              transition: "all 0.12s",
            }}
          >
            <Zap size={11} />
            测试
          </button>
        )}
      </div>

      {/* Sub row: capability + input */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 15 }}>
        <p style={{ margin: 0, fontSize: 11, color: "var(--ink-lo)", flexShrink: 0 }}>
          {info.capability} · <code style={{ fontSize: 10 }}>{info.env}</code>
        </p>
        <div style={{ flex: 1 }} />
        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            display: "flex", alignItems: "center",
            background: "var(--surface-0)",
            border: `1px solid ${isDirty ? "var(--accent)" : "var(--line)"}`,
            borderRadius: 9, overflow: "hidden",
            transition: "border-color 0.12s",
          }}>
            <input
              type={showVal ? "text" : "password"}
              value={inputVal || (isConfigured && !isDirty ? info.masked : "")}
              onChange={(e) => onInput(e.target.value)}
              onFocus={() => { if (!isDirty && isConfigured) onInput(""); }}
              placeholder={isConfigured ? "已配置 — 输入新值覆盖" : "粘贴 API Key…"}
              style={{
                width: 240, padding: "6px 12px",
                background: "transparent", border: "none", outline: "none",
                fontSize: 12, color: "var(--ink)",
                fontFamily: isDirty ? "var(--font-mono)" : "inherit",
              }}
            />
            <button type="button" onClick={onToggleShow} style={{
              padding: "0 10px", background: "transparent", border: "none",
              cursor: "pointer", color: "var(--ink-lo)",
              display: "flex", alignItems: "center",
            }}>
              {showVal ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {isDirty && (
            <button type="button" onClick={() => onInput("")} style={{
              fontSize: 11, color: "var(--ink-lo)", cursor: "pointer",
              background: "transparent", border: "none",
            }}>撤销</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data: health, isLoading: healthLoading, refetch: refetchHealth, isRefetching } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: keysData, isLoading: keysLoading } = useQuery({
    queryKey: ["ai-keys"],
    queryFn: getAiKeys,
    staleTime: 30_000,
  });

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [testStates, setTestStates] = useState<Record<string, TestResult | "loading">>({});

  const saveMut = useMutation({
    mutationFn: saveAiKeys,
    onSuccess: (data) => {
      qc.setQueryData(["ai-keys"], data);
      setInputs({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const dirtyKeys = Object.entries(inputs).filter(([, v]) => v !== "");
  const hasDirty = dirtyKeys.length > 0;

  function handleSave() {
    const updates: Record<string, string> = {};
    for (const [k, v] of dirtyKeys) updates[k] = v;
    saveMut.mutate(updates);
  }

  async function handleTest(key: string) {
    setTestStates((p) => ({ ...p, [key]: "loading" }));
    try {
      const result = await testAiKey(key);
      setTestStates((p) => ({ ...p, [key]: result }));
    } catch (err) {
      setTestStates((p) => ({
        ...p,
        [key]: { key, label: "", ok: false, latency_ms: null, detail: String(err) },
      }));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionHeader
        icon={<Settings size={18} />}
        title="系统设置"
        subtitle="AI API Keys 与服务状态"
      />

      {/* ── AI API Keys ── */}
      <SurfaceCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Key size={14} style={{ color: "var(--accent)" }} />
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-lo)" }}>
              AI API Keys
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {saved && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "oklch(72% 0.18 142)" }}>
                <Check size={13} /> 已保存
              </span>
            )}
            {hasDirty && (
              <button
                onClick={handleSave}
                disabled={saveMut.isPending}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 8,
                  background: "var(--accent)", color: "oklch(15% 0 0)",
                  border: "none", fontSize: 12, fontWeight: 600,
                  cursor: saveMut.isPending ? "not-allowed" : "pointer",
                  opacity: saveMut.isPending ? 0.6 : 1,
                }}
              >
                {saveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                保存 {dirtyKeys.length} 项
              </button>
            )}
          </div>
        </div>
        <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--ink-lo)" }}>
          Keys 存储于数据库，优先级高于 .env；点击「测试」验证连通性。
        </p>

        {keysLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 0", color: "var(--ink-lo)" }}>
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : (
          <div>
            {(keysData?.keys ?? []).map((info) => (
              <KeyRow
                key={info.key}
                info={info}
                inputVal={inputs[info.key] ?? ""}
                showVal={shown[info.key] ?? false}
                testState={testStates[info.key] ?? null}
                onInput={(v) => setInputs((p) => ({ ...p, [info.key]: v }))}
                onToggleShow={() => setShown((p) => ({ ...p, [info.key]: !p[info.key] }))}
                onTest={() => handleTest(info.key)}
              />
            ))}
          </div>
        )}
        {saveMut.isError && (
          <p style={{ marginTop: 8, fontSize: 12, color: "#f87171" }}>
            保存失败：{(saveMut.error as Error).message}
          </p>
        )}
      </SurfaceCard>

      {/* ── System health ── */}
      <SurfaceCard>
        <div className="mb-5 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30">系统健康</p>
          <button
            onClick={() => refetchHealth()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-white/40 hover:text-white/70 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${isRefetching ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
        {healthLoading ? (
          <div className="flex justify-center py-6 text-white/20">检查中…</div>
        ) : (
          <div className="space-y-3">
            {SERVICE_CHECKS.map(({ key, label }) => {
              const val = health?.[key] ?? "unknown";
              const variant = val === "ok" ? "green" : val === "error" ? "red" : "amber";
              const text = val === "ok" ? "正常" : val === "error" ? "异常" : String(val);
              return (
                <div key={key} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-white/60">{label}</span>
                  <StatusPill label={text} variant={variant} dot />
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-sm">
              <span className="text-white/60">整体状态</span>
              <StatusPill
                label={!health ? "未知" : health.status === "ok" ? "全部正常" : health.status === "degraded" ? "部分降级" : health.status}
                variant={!health ? "neutral" : health.status === "ok" ? "green" : health.status === "degraded" ? "amber" : "red"}
                dot
              />
            </div>
          </div>
        )}
      </SurfaceCard>

      {/* ── Tech stack ── */}
      <SurfaceCard>
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">技术栈</p>
        <dl className="space-y-3">
          {TECH_STACK.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <dt className="text-white/40">{label}</dt>
              <dd className="font-medium text-white/70">{value}</dd>
            </div>
          ))}
        </dl>
      </SurfaceCard>

      <SurfaceCard>
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">版本信息</p>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-white/40">应用版本</dt>
            <dd className="font-mono text-white/60">0.1.0</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-white/40">环境</dt>
            <dd><StatusPill label="development" variant="amber" /></dd>
          </div>
        </dl>
      </SurfaceCard>
    </div>
  );
}
