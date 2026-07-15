"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { TrendingUp, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { api } from "../../../lib/api";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { cn } from "../../../lib/utils";
import { copyText } from "../../../lib/clipboard";
import { SOCIAL_PLATFORMS, platformLabel } from "../../../lib/platforms";

type InputType = "description" | "url" | "transcript";

interface AnalysisResult {
  title_guess: string;
  platform_guess: string;
  hook: {
    type: string;
    text: string;
    duration_seconds: number;
    analysis: string;
  };
  script_arc: {
    structure: string;
    segments: { name: string; duration_pct: number; purpose: string; technique: string }[];
  };
  visual_patterns: { pattern: string; frequency: string; effect: string }[];
  pacing: {
    avg_clip_duration_seconds: number;
    rhythm: string;
    transitions: string;
    analysis: string;
  };
  emotion_triggers: string[];
  cta: { type: string; placement: string; text_example: string };
  replication_tips: string[];
  viral_score: number;
  viral_factors: string[];
}

const INPUT_TYPE_OPTIONS: { value: InputType; label: string; placeholder: string }[] = [
  { value: "description", label: "描述", placeholder: "描述视频内容、风格、亮点…（至少10字）" },
  { value: "url", label: "链接", placeholder: "粘贴 TikTok/YouTube/Instagram/X 视频链接…" },
  { value: "transcript", label: "文稿", placeholder: "粘贴视频字幕或脚本文字…" },
];

const HOOK_TYPE_CN: Record<string, string> = {
  question: "提问式", shock: "震撼式", promise: "承诺式",
  story: "故事式", controversy: "争议式", curiosity: "好奇式",
};

const RHYTHM_CN: Record<string, string> = {
  fast: "快节奏", medium: "中等节奏", slow: "慢节奏", variable: "变化节奏",
};

export default function AnalyzerPage() {
  const [inputType, setInputType] = useState<InputType>("description");
  const [content, setContent] = useState("");
  const [platformHint, setPlatformHint] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const analyzeMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<AnalysisResult>("/api/analyzer/analyze", {
        input_type: inputType,
        content: content.trim(),
        platform_hint: platformHint || undefined,
      });
      return data;
    },
  });

  async function copyTip(tip: string, key: string) {
    await copyText(tip);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const result = analyzeMut.data;
  const currentOpt = INPUT_TYPE_OPTIONS.find((o) => o.value === inputType)!;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        icon={<TrendingUp className="h-4 w-4" />}
        title="爆款解析"
        subtitle="AI 解析爆款视频结构，提炼可复用的创作模式"
      />

      {/* Input */}
      <SurfaceCard className="space-y-4">
        {/* Type tabs */}
        <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1">
          {INPUT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setInputType(opt.value)}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
                inputType === opt.value
                  ? "bg-white/[0.08] text-white/90 shadow-sm"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={currentOpt.placeholder}
          rows={5}
          className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
        />

        <div className="flex items-center gap-3">
          <select
            value={platformHint}
            onChange={(e) => setPlatformHint(e.target.value)}
            className="w-44 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white/70 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
          >
            <option value="">平台提示（可选）</option>
            {SOCIAL_PLATFORMS.map((platform) => (
              <option key={platform.value} value={platform.value}>{platform.label}</option>
            ))}
          </select>
          <button
            disabled={content.trim().length < 10 || analyzeMut.isPending}
            onClick={() => analyzeMut.mutate()}
            className="flex items-center gap-2 rounded-xl bg-violet-500 px-6 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40 hover:opacity-90"
          >
            {analyzeMut.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />解析中…</>
            ) : (
              <><Sparkles className="h-4 w-4" />开始解析</>
            )}
          </button>
        </div>

        {analyzeMut.isError && (
          <p className="text-sm text-red-400">
            {(analyzeMut.error as Error)?.message || "解析失败，请重试"}
          </p>
        )}
      </SurfaceCard>

      {/* Results */}
      {result && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Viral score + overview */}
          <SurfaceCard raised>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/80">综合评估</h2>
              <div className="text-right">
                <div className={cn(
                  "text-3xl font-bold",
                  result.viral_score >= 80 ? "text-emerald-400"
                    : result.viral_score >= 60 ? "text-amber-400"
                    : "text-red-400"
                )}>
                  {result.viral_score}
                </div>
                <div className="text-xs text-white/30">爆款指数</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="推测标题" value={result.title_guess} />
              <Row label="平台" value={platformLabel(result.platform_guess)} />
              <Row label="脚本结构" value={result.script_arc.structure} />
            </div>
            {result.viral_factors.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-white/30">爆款因子</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.viral_factors.map((f) => (
                    <span key={f} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </SurfaceCard>

          {/* Hook analysis */}
          <SurfaceCard raised>
            <h2 className="mb-4 text-sm font-semibold text-white/80">开场钩子</h2>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-300">
                {HOOK_TYPE_CN[result.hook.type] ?? result.hook.type}
              </span>
              <span className="text-xs text-white/30">前 {result.hook.duration_seconds}s</span>
            </div>
            {result.hook.text && (
              <blockquote className="mb-3 border-l-2 border-violet-500/40 pl-3 text-sm italic text-white/60">
                "{result.hook.text}"
              </blockquote>
            )}
            <p className="text-sm text-white/50">{result.hook.analysis}</p>
          </SurfaceCard>

          {/* Emotion triggers */}
          <SurfaceCard raised>
            <h2 className="mb-4 text-sm font-semibold text-white/80">情绪触发点</h2>
            <div className="flex flex-wrap gap-2">
              {result.emotion_triggers.map((e) => (
                <span key={e} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white/60">
                  {e}
                </span>
              ))}
            </div>
          </SurfaceCard>

          {/* Pacing */}
          <SurfaceCard raised>
            <h2 className="mb-4 text-sm font-semibold text-white/80">节奏分析</h2>
            <div className="space-y-2 text-sm">
              <Row label="平均片段时长" value={`${result.pacing.avg_clip_duration_seconds}s`} />
              <Row label="节奏风格" value={RHYTHM_CN[result.pacing.rhythm] ?? result.pacing.rhythm} />
              <Row label="转场方式" value={result.pacing.transitions} />
            </div>
            <p className="mt-3 text-xs text-white/35">{result.pacing.analysis}</p>
          </SurfaceCard>

          {/* CTA */}
          <SurfaceCard raised>
            <h2 className="mb-4 text-sm font-semibold text-white/80">行动号召 (CTA)</h2>
            <div className="space-y-2 text-sm">
              <Row label="类型" value={result.cta.type} />
              <Row label="位置" value={result.cta.placement} />
            </div>
            {result.cta.text_example && (
              <p className="mt-3 text-xs italic text-white/35">示例："{result.cta.text_example}"</p>
            )}
          </SurfaceCard>

          {/* Visual patterns */}
          {result.visual_patterns.length > 0 && (
            <SurfaceCard raised>
              <h2 className="mb-4 text-sm font-semibold text-white/80">视觉模式</h2>
              <div className="space-y-3">
                {result.visual_patterns.map((vp, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white/70">{vp.pattern}</span>
                      <span className="text-xs text-white/30">{vp.frequency}</span>
                    </div>
                    <p className="text-xs text-white/40">{vp.effect}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          )}

          {/* Script arc */}
          {result.script_arc.segments.length > 0 && (
            <SurfaceCard raised className="col-span-full">
              <h2 className="mb-4 text-sm font-semibold text-white/80">
                脚本结构（{result.script_arc.structure}）
              </h2>
              <div className="flex gap-1">
                {result.script_arc.segments.map((seg, i) => (
                  <div key={i} style={{ width: `${seg.duration_pct}%` }} className="group relative">
                    <div className="h-8 rounded bg-violet-500/20 transition-colors group-hover:bg-violet-500/35" />
                    <p className="mt-1 truncate text-[10px] font-medium text-white/50">{seg.name}</p>
                    <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden w-48 rounded-xl border border-white/[0.1] bg-[oklch(14%_0.02_278)] p-3 shadow-lg group-hover:block">
                      <p className="text-xs font-medium text-white/80">{seg.name} ({seg.duration_pct}%)</p>
                      <p className="text-[10px] text-white/40">{seg.purpose}</p>
                      <p className="text-[10px] text-violet-400">{seg.technique}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          )}

          {/* Replication tips */}
          {result.replication_tips.length > 0 && (
            <SurfaceCard raised className="col-span-full">
              <h2 className="mb-4 text-sm font-semibold text-white/80">复制策略</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.replication_tips.map((tip, i) => (
                  <div key={i} className="group flex items-start gap-3 rounded-lg bg-white/[0.04] p-3 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-400">
                      {i + 1}
                    </span>
                    <p className="flex-1 text-white/70">{tip}</p>
                    <button
                      onClick={() => copyTip(tip, `tip-${i}`)}
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {copied === `tip-${i}` ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-white/30" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/40">{label}</span>
      <span className="font-medium text-white/70">{value}</span>
    </div>
  );
}
