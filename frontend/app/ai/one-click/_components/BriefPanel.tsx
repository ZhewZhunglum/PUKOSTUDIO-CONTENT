"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { OneClickPayload } from "../../../../lib/api/pipeline";

export interface BriefFormState {
  productName: string;
  description: string;
  platform: string;
  style: OneClickPayload["style"];
  duration: number;
  clipCount: number;
}

interface BriefPanelProps {
  state: BriefFormState;
  onChange: (patch: Partial<BriefFormState>) => void;
  onSubmit: () => void;
  isPending: boolean;
  error: string | null;
}

const PLATFORM_OPTIONS: Array<{
  value: string;
  label: string;
  ratio: string;
}> = [
  { value: "douyin", label: "抖音", ratio: "9:16" },
  { value: "xiaohongshu", label: "小红书", ratio: "3:4" },
  { value: "bilibili", label: "B站", ratio: "16:9" },
  { value: "tiktok", label: "TikTok", ratio: "9:16" },
  { value: "weibo", label: "微博", ratio: "1:1" },
  { value: "youtube", label: "YouTube", ratio: "16:9" },
];

const STYLE_OPTIONS: Array<{
  value: OneClickPayload["style"];
  label: string;
  desc: string;
}> = [
  { value: "conversational", label: "对话式", desc: "亲切自然，像朋友推荐" },
  { value: "dramatic", label: "戏剧型", desc: "反转、悬念、情绪张力" },
  { value: "educational", label: "教育型", desc: "拆解原理与使用方法" },
  { value: "humorous", label: "幽默型", desc: "段子节奏与梗感" },
];

function estimateCost(duration: number, clipCount: number): number {
  // Heuristic: AI script ~0.04, each clip ~0.18 video + 0.01 narration, compose negligible
  const script = 0.04;
  const perClip = 0.19;
  const durationFactor = duration / 30;
  return script + clipCount * perClip * Math.max(0.6, durationFactor);
}

const labelCls = "font-mono uppercase";
const labelStyle = {
  fontSize: 10,
  letterSpacing: "0.16em",
  color: "var(--ink-lo)",
  fontWeight: 500,
} as const;

const inputStyle = {
  background: "var(--surface-1)",
  border: "1px solid var(--line)",
  color: "var(--ink-hi)",
  fontSize: 13,
  borderRadius: 10,
} as const;

export function BriefPanel({
  state,
  onChange,
  onSubmit,
  isPending,
  error,
}: BriefPanelProps) {
  const cost = estimateCost(state.duration, state.clipCount);
  const canSubmit = state.productName.trim().length > 0 && !isPending;

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      <div className="flex flex-col gap-1">
        <span className="eyebrow">BRIEF · 创建新任务</span>
        <p style={{ fontSize: 12, color: "var(--ink-mid)" }}>
          填写产品信息，AI 全程生产视频。
        </p>
      </div>

      <Field label="产品名称" required>
        <input
          value={state.productName}
          onChange={(e) => onChange({ productName: e.target.value })}
          placeholder="如：兰蔻小黑瓶精华液"
          className="w-full outline-none px-3 py-2.5"
          style={inputStyle}
        />
      </Field>

      <Field label="产品描述">
        <textarea
          value={state.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="卖点、目标人群、核心功效…"
          rows={3}
          className="w-full resize-none outline-none px-3 py-2.5"
          style={inputStyle}
        />
      </Field>

      <Field label="发布平台">
        <div className="grid grid-cols-3 gap-2">
          {PLATFORM_OPTIONS.map((p) => {
            const isActive = state.platform === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange({ platform: p.value })}
                className="flex flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors"
                style={{
                  borderRadius: 10,
                  background: isActive ? "var(--accent-soft)" : "var(--surface-1)",
                  border: isActive
                    ? "1px solid var(--accent-line)"
                    : "1px solid var(--line)",
                  color: isActive ? "var(--accent-2)" : "var(--ink)",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9.5,
                    color: isActive ? "var(--accent)" : "var(--ink-lo)",
                  }}
                >
                  {p.ratio}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="叙事风格">
        <div className="flex flex-col gap-1.5">
          {STYLE_OPTIONS.map((s) => {
            const isActive = state.style === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onChange({ style: s.value })}
                className="flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
                style={{
                  borderRadius: 10,
                  background: isActive ? "var(--accent-soft)" : "var(--surface-1)",
                  border: isActive
                    ? "1px solid var(--accent-line)"
                    : "1px solid var(--line)",
                }}
              >
                <span
                  className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                  style={{
                    border: isActive
                      ? "1px solid var(--accent)"
                      : "1px solid var(--line-hi)",
                    background: "var(--surface-0)",
                  }}
                >
                  {isActive && (
                    <span
                      className="block h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--accent)" }}
                    />
                  )}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: isActive ? "var(--accent-2)" : "var(--ink-hi)",
                    }}
                  >
                    {s.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>
                    {s.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <RangeField
          label="时长"
          value={state.duration}
          min={10}
          max={120}
          step={5}
          unit="s"
          onChange={(v) => onChange({ duration: v })}
        />
        <RangeField
          label="片段数"
          value={state.clipCount}
          min={2}
          max={10}
          step={1}
          unit="段"
          onChange={(v) => onChange({ clipCount: v })}
        />
      </div>

      <div
        className="flex items-center justify-between rounded-xl px-3.5 py-3"
        style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
      >
        <span className={labelCls} style={labelStyle}>
          预估 AI 成本
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 14, color: "var(--ink-hi)", fontWeight: 600 }}
        >
          ≈ ${cost.toFixed(2)}
        </span>
      </div>

      {error && (
        <p
          className="rounded-xl px-3 py-2"
          style={{
            background: "oklch(20% 0.08 22 / 0.18)",
            border: "1px solid var(--bad)",
            color: "var(--bad)",
            fontSize: 12,
          }}
        >
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
        style={{
          background: "var(--accent)",
          color: "oklch(15% 0.02 295)",
          fontWeight: 600,
          fontSize: 13,
          padding: "11px 16px",
          borderRadius: 12,
          letterSpacing: "-0.005em",
        }}
      >
        {isPending ? (
          <>
            <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
            提交中…
          </>
        ) : (
          <>
            <Sparkles style={{ width: 14, height: 14 }} />
            开始一键成片
          </>
        )}
      </button>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className={labelCls} style={labelStyle}>
        {label}
        {required && (
          <span style={{ color: "var(--accent)", marginLeft: 4 }}>*</span>
        )}
      </span>
      {children}
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className={labelCls} style={labelStyle}>
          {label}
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}
        >
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
