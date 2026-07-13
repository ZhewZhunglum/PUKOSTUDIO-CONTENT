"use client";

import { useState } from "react";
import { Check, Download, Heart, Loader2, Pencil, Star, Trash2, X } from "lucide-react";
import { SurfaceCard } from "../../ui/SurfaceCard";
import { ASSET_TYPE_META, compactName, type AssetDetail } from "./types";

interface AssetActionsCardProps {
  asset: AssetDetail;
  deleting: boolean;
  onToggleFavorite: (fav: boolean) => void;
  onRate: (rating: number) => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => void;
}

/** Sidebar header card: name (inline-renamable), rating, favorite/download/delete. */
export function AssetActionsCard({
  asset, deleting, onToggleFavorite, onRate, onRename, onDelete,
}: AssetActionsCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(asset.name);
  const [saving, setSaving] = useState(false);

  const typeMeta = ASSET_TYPE_META[asset.asset_type] ?? ASSET_TYPE_META[1];
  const TypeIcon = typeMeta.icon;

  function startEditing() {
    setDraftName(asset.name);
    setEditing(true);
  }

  async function saveName() {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === asset.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(trimmed);
      setEditing(false);
    } catch {
      alert("重命名失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SurfaceCard className="bg-white/[0.045]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
          <TypeIcon className={`h-5 w-5 ${typeMeta.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  // Enter during IME composition confirms the candidate, not the rename.
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-violet-500/40 bg-white/[0.05] px-2 py-1 text-sm text-white/90 outline-none focus:ring-1 focus:ring-violet-500/50"
              />
              <button
                onClick={saveName}
                disabled={saving}
                title="保存"
                className="shrink-0 rounded-lg p-1.5 text-emerald-400 transition-colors hover:bg-white/[0.06] disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setEditing(false)}
                title="取消"
                className="shrink-0 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="group flex items-start gap-1.5">
              <h1 className="break-words text-base font-semibold leading-tight text-white/90" title={asset.name}>
                {compactName(asset.name)}
              </h1>
              <button
                onClick={startEditing}
                title="重命名"
                className="mt-0.5 shrink-0 rounded p-1 text-white/25 opacity-0 transition-all hover:text-white/60 group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
          <p className="mt-1 text-xs text-white/35">Asset #{asset.id} · {typeMeta.label}</p>
        </div>
      </div>

      {/* Rating */}
      <div className="mb-4 flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} onClick={() => onRate(star === asset.rating ? 0 : star)} className="p-0.5">
            <Star
              className={`h-5 w-5 transition-colors ${
                star <= asset.rating ? "fill-amber-400 text-amber-400" : "text-white/15 hover:text-amber-400/50"
              }`}
            />
          </button>
        ))}
        <span className="ml-1.5 text-xs text-white/25">{asset.rating}/5</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onToggleFavorite(!asset.favorite)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-sm transition-colors ${
            asset.favorite
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-white/[0.08] text-white/40 hover:border-white/[0.14] hover:text-white/70"
          }`}
        >
          <Heart className={`h-4 w-4 ${asset.favorite ? "fill-current" : ""}`} />
          {asset.favorite ? "已收藏" : "收藏"}
        </button>
        {asset.cdn_url && (
          <a
            href={asset.cdn_url}
            download={asset.name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] py-2 text-sm text-white/40 transition-colors hover:border-white/[0.14] hover:text-white/70"
          >
            <Download className="h-4 w-4" />
            下载
          </a>
        )}
        <button
          onClick={onDelete}
          disabled={deleting}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-2 text-sm text-white/40 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
          title="删除此素材"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </SurfaceCard>
  );
}
