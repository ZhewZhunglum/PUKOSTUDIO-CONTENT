"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Wand2, ExternalLink } from "lucide-react";
import Image from "next/image";
import { generateImage } from "../../../lib/api/ai";
import { cn } from "../../../lib/utils";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";

const SIZES = ["1024x1024", "1792x1024", "1024x1792"];
const PRESETS = [
  "商业摄影风格, 高质量, 专业打光",
  "极简风格, 白色背景, 产品展示",
  "生活场景, 自然光, 温暖色调",
  "电商主图, 纯色背景, 居中构图",
];

export default function ImageGenPage() {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [preset, setPreset] = useState("");
  const [n, setN] = useState(1);

  const { mutateAsync, data, isPending, error } = useMutation({
    mutationFn: () =>
      generateImage({
        prompt,
        size,
        style_preset: preset || undefined,
        n,
        save_to_library: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  function applyPreset(p: string) {
    setPreset(p);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 xl:grid xl:grid-cols-[420px_minmax(0,1fr)]">
      {/* Left: Config */}
      <SurfaceCard className="space-y-5 xl:sticky xl:top-0 xl:max-h-[calc(100vh-112px)] xl:overflow-auto">
        <SectionHeader
          icon={<Wand2 className="h-4 w-4" />}
          title="AI 图片生成"
          subtitle="用 GPT Image 1 生成产品图、场景图"
        />

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/40">描述 *</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="描述你想要的图片，越详细越好…"
            className="w-full rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-white/40">快速风格预设</p>
          <div className="space-y-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p === preset ? "" : p)}
                className={cn(
                  "w-full text-left rounded-lg px-3 py-2 text-xs transition-colors",
                  preset === p
                    ? "bg-violet-500/20 text-violet-300"
                    : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/40">尺寸</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-white/60 outline-none"
            >
              {SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/40">数量</label>
            <select
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="w-full rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-white/60 outline-none"
            >
              {[1, 2, 3, 4].map((v) => (
                <option key={v} value={v}>{v} 张</option>
              ))}
            </select>
          </div>
        </div>

        <button
          disabled={!prompt.trim() || isPending}
          onClick={() => mutateAsync()}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Wand2 className={cn("h-4 w-4", isPending && "animate-spin")} />
          {isPending ? "生成中…" : "生成图片"}
        </button>

        {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}
      </SurfaceCard>

      {/* Right: Results */}
      <div className="min-w-0">
        {data?.asset_ids.length ? (
          <SurfaceCard noPad className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/40">
                生成 {data.asset_ids.length} 张 · 已保存到素材库 · 费用 ${data.cost_usd.toFixed(4)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {data.asset_ids.map((assetId, i) => (
                <div
                  key={assetId}
                  className="group relative aspect-square overflow-hidden rounded-2xl bg-white/[0.04] border border-white/[0.06]"
                >
                  {data.cdn_urls[i] ? (
                    <Image
                      src={data.cdn_urls[i]}
                      alt={`Generated image ${i + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-white/20">
                      <ImageIcon className="h-8 w-8" />
                      <p className="text-xs">Asset #{assetId}</p>
                    </div>
                  )}
                  <a
                    href={`/assets/${assetId}`}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink className="h-5 w-5 text-white" />
                  </a>
                </div>
              ))}
            </div>
          </SurfaceCard>
        ) : (
          <SurfaceCard className="flex min-h-[420px] items-center justify-center">
            <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-white/[0.08] text-white/20">
              <div className="text-center">
                <ImageIcon className="mx-auto h-10 w-10 opacity-30" />
                <p className="mt-2 text-sm">生成的图片将在这里显示</p>
              </div>
            </div>
          </SurfaceCard>
        )}
      </div>
    </div>
  );
}
