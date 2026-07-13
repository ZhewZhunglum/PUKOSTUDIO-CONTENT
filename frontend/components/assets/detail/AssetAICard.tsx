"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { SurfaceCard } from "../../ui/SurfaceCard";
import { StatusPill } from "../../ui/StatusPill";
import type { AssetDetail } from "./types";

interface AssetAICardProps {
  asset: AssetDetail;
  retagging: boolean;
  onRetag: () => void;
}

/** AI analysis card: status, description, and confidence-scored AI tags. */
export function AssetAICard({ asset, retagging, onRetag }: AssetAICardProps) {
  const aiStatus = asset.ai_processing_status;
  const hasAIResults = (asset.ai_tags && asset.ai_tags.length > 0) || asset.ai_description;

  return (
    <SurfaceCard className="bg-white/[0.035]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/30">AI 分析</span>
        </div>
        <div className="flex items-center gap-2">
          {aiStatus === 0 && <StatusPill label="待分析" variant="neutral" dot />}
          {aiStatus === 1 && <StatusPill label="分析中…" variant="blue" dot />}
          {aiStatus === 2 && <StatusPill label="已完成" variant="green" dot />}
          {aiStatus === 3 && <StatusPill label="失败" variant="red" dot />}
          <button
            onClick={onRetag}
            disabled={retagging || aiStatus === 1}
            title={aiStatus === 2 ? "重新分析" : "开始分析"}
            className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1 text-xs text-white/40 transition-colors hover:text-white/70 disabled:opacity-30"
          >
            <RefreshCw className={`h-3 w-3 ${retagging || aiStatus === 1 ? "animate-spin" : ""}`} />
            {aiStatus === 2 ? "重新分析" : "立即分析"}
          </button>
        </div>
      </div>

      {aiStatus === 1 && (
        <div className="flex items-center gap-2 rounded-xl bg-blue-500/5 px-4 py-3 text-sm text-blue-300/70">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          AI 正在分析素材，标签将自动更新…
        </div>
      )}

      {aiStatus === 3 && (
        <div className="rounded-xl bg-red-500/5 px-4 py-3 text-sm text-red-300/70">
          分析失败，可点击「立即分析」重试。
        </div>
      )}

      {!hasAIResults && aiStatus === 0 && (
        <p className="text-sm text-white/20">点击「立即分析」让 AI 自动识别内容并打标签。</p>
      )}

      {asset.ai_description && (
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-white/25">AI 描述</p>
          <p className="text-sm leading-relaxed text-white/60">{asset.ai_description}</p>
        </div>
      )}

      {asset.ai_tags && asset.ai_tags.length > 0 && (
        <div>
          <p className="mb-2.5 text-[11px] uppercase tracking-wider text-white/25">AI 标签</p>
          <div className="flex flex-wrap gap-1.5">
            {asset.ai_tags.map((t) => (
              <span
                key={t.name}
                className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300"
                title={`置信度 ${Math.round(t.confidence * 100)}%`}
              >
                {t.name}
                <span className="text-[10px] text-blue-400/40">{Math.round(t.confidence * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}
