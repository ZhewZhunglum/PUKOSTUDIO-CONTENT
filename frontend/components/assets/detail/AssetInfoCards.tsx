"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar, Check, Clock, Copy, Eye, GitBranch, HardDrive, Image as ImageIcon,
} from "lucide-react";
import { SurfaceCard } from "../../ui/SurfaceCard";
import {
  formatDate, formatDuration, formatFileSize, SOURCE_LABEL,
  type AssetDetail, type AssetRelation,
} from "./types";

/** Metadata card: file facts, source info, prompt, and original link. */
export function AssetMetadataCard({ asset }: { asset: AssetDetail }) {
  return (
    <SurfaceCard>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">素材信息</p>
      <dl className="space-y-2.5 text-sm">
        {asset.file_size && (
          <MetaRow icon={<HardDrive className="h-3.5 w-3.5" />} label="文件大小" value={formatFileSize(asset.file_size)} />
        )}
        {asset.width && asset.height && (
          <MetaRow icon={<ImageIcon className="h-3.5 w-3.5" />} label="尺寸" value={`${asset.width} × ${asset.height}`} />
        )}
        {asset.duration_ms && (
          <MetaRow icon={<Clock className="h-3.5 w-3.5" />} label="时长" value={formatDuration(asset.duration_ms)} />
        )}
        {asset.mime_type && <MetaRow label="格式" value={asset.mime_type} mono />}
        <MetaRow label="来源" value={asset.source_platform ?? SOURCE_LABEL[asset.source] ?? "未知"} />
        {asset.source_extractor && <MetaRow label="下载器" value={asset.source_extractor} mono />}
        {asset.source_model && <MetaRow label="来源模型" value={asset.source_model} mono />}
        <MetaRow icon={<Eye className="h-3.5 w-3.5" />} label="使用次数" value={String(asset.use_count)} />
        <MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="导入时间" value={formatDate(asset.imported_at)} small />
      </dl>

      {asset.source_prompt && (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-white/25">Source Prompt</p>
          <p className="max-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-white/[0.04] p-2.5 text-xs leading-relaxed text-white/45">
            {asset.source_prompt}
          </p>
        </div>
      )}
      {asset.source_url && (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-white/25">原始链接</p>
          <a
            href={asset.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate rounded-lg bg-white/[0.04] p-2.5 text-xs text-violet-300/80 hover:text-violet-200"
          >
            {asset.source_url}
          </a>
        </div>
      )}
    </SurfaceCard>
  );
}

function MetaRow({
  icon, label, value, mono = false, small = false,
}: {
  icon?: React.ReactNode; label: string; value: string; mono?: boolean; small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex shrink-0 items-center gap-1.5 text-white/40">{icon}{label}</dt>
      <dd
        className={
          mono
            ? "truncate font-mono text-xs text-white/55"
            : small
              ? "text-xs text-white/50"
              : "text-white/60"
        }
      >
        {value}
      </dd>
    </div>
  );
}

/** Relations card: outgoing/incoming asset graph edges. */
export function AssetRelationsCard({ assetId, relations }: { assetId: number; relations: AssetRelation[] }) {
  return (
    <SurfaceCard>
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/30">
        <GitBranch className="h-3 w-3" />
        关系图
      </p>
      {relations.length > 0 ? (
        <div className="space-y-2">
          {relations.slice(0, 4).map((rel) => {
            const otherId = rel.source_asset_id === assetId ? rel.target_asset_id : rel.source_asset_id;
            return (
              <Link
                key={rel.id}
                href={`/assets/${otherId}`}
                className="flex items-center justify-between rounded-lg bg-white/[0.04] px-2.5 py-2 text-xs text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white/70"
              >
                <span>{rel.relation_type}</span>
                <span className="font-mono">Asset #{otherId}</span>
              </Link>
            );
          })}
          {relations.length > 4 && <p className="text-xs text-white/25">还有 {relations.length - 4} 条关系</p>}
        </div>
      ) : (
        <p className="text-xs text-white/20">暂无派生、组成或使用关系。</p>
      )}
    </SurfaceCard>
  );
}

/** Storage key card with copy-to-clipboard. */
export function AssetStorageCard({ storageKey }: { storageKey: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(storageKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <SurfaceCard>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">存储路径</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] text-white/35">
          {storageKey}
        </code>
        <button
          onClick={copy}
          className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/[0.06]"
          title="复制"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-white/30" />}
        </button>
      </div>
    </SurfaceCard>
  );
}
