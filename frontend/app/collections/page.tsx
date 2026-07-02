"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderOpen, Plus, Trash2, Image, Film, Loader2, X, Check, Sparkles,
} from "lucide-react";
import {
  listCollections,
  createCollection,
  deleteCollection,
  getCollectionAssets,
  removeAssetFromCollection,
  type Collection,
  type CollectionAsset,
} from "../../lib/api/collections";
import { AICollectDialog } from "../../components/collections/AICollectDialog";

const ASSET_TYPE_LABEL: Record<number, string> = {
  1: "图片", 2: "视频", 3: "音频", 4: "字幕", 10: "输出",
};

function AssetThumb({ asset }: { asset: CollectionAsset }) {
  const url = asset.cdn_url ?? null;
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-white/[0.04]">
      {url && asset.asset_type === 1 ? (
        <img src={url} alt={asset.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/20">
          {asset.asset_type === 2 ? <Film className="h-6 w-6" /> : <Image className="h-6 w-6" />}
        </div>
      )}
      <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-1.5 opacity-0 transition group-hover:bg-black/50 group-hover:opacity-100">
        <span className="self-end rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          {ASSET_TYPE_LABEL[asset.asset_type] ?? "?"}
        </span>
        <p className="truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          {asset.name}
        </p>
      </div>
    </div>
  );
}

export default function CollectionsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showAICollect, setShowAICollect] = useState(false);

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: () => listCollections(),
  });

  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ["collection-assets", selectedId],
    queryFn: () => getCollectionAssets(selectedId!),
    enabled: selectedId !== null,
  });

  const selectedCollection = collections.find((c) => c.id === selectedId) ?? null;

  const createMut = useMutation({
    mutationFn: () => createCollection({ name: newName.trim() }),
    onSuccess: (col) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      setCreating(false);
      setNewName("");
      setSelectedId(col.id);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCollection(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      if (selectedId === id) setSelectedId(null);
      setDeleteConfirmId(null);
    },
  });

  const removeAssetMut = useMutation({
    mutationFn: ({ colId, assetId }: { colId: number; assetId: number }) =>
      removeAssetFromCollection(colId, assetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-assets", selectedId] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  return (
    <div className="flex h-full gap-0 overflow-hidden -m-6">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[oklch(10%_0.018_278)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/30">集合</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowAICollect(true)}
              className="rounded-lg p-1.5 text-violet-400/60 hover:bg-violet-500/10 hover:text-violet-400 transition-colors"
              title="AI 智能收集"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setCreating(true)}
              className="rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
              title="新建集合"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {creating && (
          <div className="border-b border-white/[0.06] px-3 py-2.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) createMut.mutate();
                if (e.key === "Escape") { setCreating(false); setNewName(""); }
              }}
              placeholder="集合名称…"
              className="mb-2 w-full rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
            />
            <div className="flex gap-1.5">
              <button
                disabled={!newName.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-violet-500/20 py-1.5 text-xs font-medium text-violet-300 disabled:opacity-40 hover:bg-violet-500/30 transition-colors"
              >
                {createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                确认
              </button>
              <button
                onClick={() => { setCreating(false); setNewName(""); }}
                className="rounded-lg px-2 py-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center py-6 text-white/20">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {collections.map((col) => (
            <div
              key={col.id}
              className={`group flex cursor-pointer items-center gap-2 border-b border-white/[0.04] px-3 py-2.5 transition-colors hover:bg-white/[0.04] ${
                col.id === selectedId ? "bg-white/[0.06]" : ""
              }`}
              onClick={() => setSelectedId(col.id)}
            >
              <FolderOpen className={`h-4 w-4 shrink-0 ${col.id === selectedId ? "text-violet-400" : "text-white/25"}`} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${col.id === selectedId ? "font-medium text-white/80" : "text-white/50"}`}>
                  {col.name}
                </p>
                <p className="text-[10px] text-white/20">{col.asset_count} 个素材</p>
              </div>
              {deleteConfirmId === col.id ? (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMut.mutate(col.id); }}
                  className="shrink-0 rounded-lg bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300 hover:bg-red-500/20 transition-colors"
                >
                  确认
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(col.id); }}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-50 hover:!opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </button>
              )}
            </div>
          ))}
          {!isLoading && collections.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-white/20">
              还没有集合，点击 + 新建
            </p>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {!selectedCollection ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-white/15">
            <FolderOpen className="h-14 w-14 opacity-30" />
            <p className="text-sm">从左侧选择或新建一个集合</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div>
                <h1 className="text-lg font-semibold text-white/80">{selectedCollection.name}</h1>
                {selectedCollection.description && (
                  <p className="text-sm text-white/30">{selectedCollection.description}</p>
                )}
              </div>
              <span className="text-sm text-white/25">
                {selectedCollection.asset_count} 个素材
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingAssets ? (
                <div className="flex justify-center py-12 text-white/20">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/20">
                  <Image className="h-10 w-10 opacity-30" />
                  <p className="text-sm">此集合为空</p>
                  <p className="text-xs opacity-60">在素材库中选择素材后可添加到集合</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {assets.map((asset) => (
                    <div key={asset.id} className="group relative">
                      <AssetThumb asset={asset} />
                      <button
                        onClick={() => removeAssetMut.mutate({ colId: selectedId!, assetId: asset.id })}
                        className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-0.5 text-white group-hover:flex hover:bg-red-500/80 transition-colors"
                        title="从集合移除"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {showAICollect && (
        <AICollectDialog onClose={() => setShowAICollect(false)} />
      )}
    </div>
  );
}
