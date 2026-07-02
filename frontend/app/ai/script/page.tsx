"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Copy, Check, ExternalLink } from "lucide-react";
import { generateScript, type ScriptGenResponse } from "../../../lib/api/ai";
import { cn } from "../../../lib/utils";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { SOCIAL_PLATFORMS } from "../../../lib/platforms";

const PLATFORMS = SOCIAL_PLATFORMS;
const STYLES = ["conversational", "dramatic", "educational", "humorous"];
const DURATIONS = [15, 30, 60, 90, 180];

export default function ScriptPage() {
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [duration, setDuration] = useState(30);
  const [style, setStyle] = useState("conversational");
  const [audience, setAudience] = useState("");
  const [keywords, setKeywords] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const { mutateAsync, data, isPending, error } = useMutation({
    mutationFn: () =>
      generateScript({
        product_name: productName,
        product_description: description || undefined,
        platform,
        duration_seconds: duration,
        style,
        target_audience: audience || undefined,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      }),
  });

  async function handleCopy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 h-full overflow-hidden">
      {/* Left: Config */}
      <SurfaceCard className="overflow-auto space-y-5">
        <SectionHeader
          icon={<Sparkles className="h-4 w-4" />}
          title="AI 脚本生成"
          subtitle="输入产品信息，AI 自动生成短视频脚本"
        />

        <Field label="产品名称 *">
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="例：神奇保温杯"
            className={inputCls}
          />
        </Field>

        <Field label="产品描述">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="可选：产品特点、卖点、使用场景…"
            className={cn(inputCls, "resize-none")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="平台">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className={inputCls}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>

          <Field label="时长（秒）">
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={inputCls}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d}s</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="风格">
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className={inputCls}
            >
              {STYLES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          <Field label="目标受众">
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="例：25-35岁女性"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="关键词（逗号分隔）">
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="例：保温,便携,高颜值"
            className={inputCls}
          />
        </Field>

        <button
          disabled={!productName.trim() || isPending}
          onClick={() => mutateAsync()}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Sparkles className={cn("h-4 w-4", isPending && "animate-pulse")} />
          {isPending ? "生成中…" : "生成脚本"}
        </button>

        {error && (
          <p className="text-sm text-red-400">{(error as Error).message}</p>
        )}
      </SurfaceCard>

      {/* Right: Output */}
      <div className="overflow-auto space-y-4">
        {data ? (
          <>
            <ResultCard
              title="开场钩子"
              onCopy={() => handleCopy(data.hooks.join("\n"), "hooks")}
              copied={copied === "hooks"}
            >
              <ol className="space-y-2">
                {data.hooks.map((h, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white/70">
                    <span className="text-violet-400 font-mono">{i + 1}.</span>
                    {h}
                  </li>
                ))}
              </ol>
            </ResultCard>

            <ResultCard
              title="完整脚本"
              onCopy={() => handleCopy(data.script, "script")}
              copied={copied === "script"}
            >
              <pre className="text-sm text-white/70 whitespace-pre-wrap font-sans leading-relaxed">
                {data.script}
              </pre>
            </ResultCard>

            <ResultCard
              title="建议标签"
              onCopy={() => handleCopy(data.tags_suggested.map((t) => `#${t}`).join(" "), "tags")}
              copied={copied === "tags"}
            >
              <div className="flex flex-wrap gap-2">
                {data.tags_suggested.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/60"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </ResultCard>

            <p className="text-xs text-white/20 text-right">
              {data.asset_id ? (
                <a
                  href={`/assets/${data.asset_id}`}
                  className="mr-3 inline-flex items-center gap-1 text-emerald-300/70 transition-colors hover:text-emerald-200"
                >
                  已入素材库 #{data.asset_id}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              模型：{data.model_used} · 费用：${data.cost_usd.toFixed(5)}
            </p>
          </>
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-white/[0.08] text-white/20">
            <div className="text-center">
              <Sparkles className="mx-auto h-8 w-8 opacity-30" />
              <p className="mt-2 text-sm">脚本将在这里显示</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/40">{label}</label>
      {children}
    </div>
  );
}

function ResultCard({
  title,
  children,
  onCopy,
  copied,
}: {
  title: string;
  children: React.ReactNode;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <SurfaceCard>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30">{title}</h3>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      {children}
    </SurfaceCard>
  );
}

const inputCls =
  "w-full rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:ring-1 focus:ring-violet-500/50";
