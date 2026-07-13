"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { ASSET_TYPE_META, type AssetDetail } from "./types";

/**
 * Media preview hero: image / video / audio with graceful fallback.
 * Video uses the generated first-frame thumbnail as poster so the player
 * shows a cover before playback starts.
 */
export function AssetPreview({ asset }: { asset: AssetDetail }) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const typeMeta = ASSET_TYPE_META[asset.asset_type] ?? ASSET_TYPE_META[1];
  const TypeIcon = typeMeta.icon;

  const showImage = !mediaFailed && asset.cdn_url && asset.asset_type === 1;
  const showVideo = !mediaFailed && asset.cdn_url && asset.asset_type === 2;
  const showAudio = !mediaFailed && asset.cdn_url && asset.asset_type === 3;

  return (
    <div className="group relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-black/24 p-3 shadow-[0_18px_70px_oklch(0%_0_0_/_0.25)]">
      {showImage && (
        <>
          <img
            src={asset.cdn_url!}
            alt={asset.name}
            onError={() => setMediaFailed(true)}
            className="max-h-[62vh] w-full rounded-xl object-contain"
          />
          <a
            href={asset.cdn_url!}
            target="_blank"
            rel="noopener noreferrer"
            title="查看原图"
            className="absolute right-4 top-4 rounded-lg border border-white/10 bg-black/50 p-2 text-white/60 opacity-0 backdrop-blur transition-opacity hover:text-white group-hover:opacity-100"
          >
            <Maximize2 className="h-4 w-4" />
          </a>
        </>
      )}
      {showVideo && (
        <video
          src={asset.cdn_url!}
          poster={asset.thumbnail_url ?? undefined}
          controls
          preload="metadata"
          onError={() => setMediaFailed(true)}
          className="max-h-[62vh] w-full rounded-xl"
        />
      )}
      {showAudio && (
        <div className="flex w-full flex-col items-center justify-center gap-4 py-12">
          <TypeIcon className={`h-12 w-12 opacity-30 ${typeMeta.color}`} />
          <audio src={asset.cdn_url!} controls className="w-full max-w-md" onError={() => setMediaFailed(true)} />
        </div>
      )}
      {!showImage && !showVideo && !showAudio && (
        <div className="flex h-64 w-full flex-col items-center justify-center gap-3">
          <TypeIcon className={`h-16 w-16 opacity-15 ${typeMeta.color}`} />
          <p className="text-xs text-white/25">
            {mediaFailed ? "媒体加载失败，可尝试下载原文件" : "此类型暂不支持预览"}
          </p>
        </div>
      )}
    </div>
  );
}
