"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Plus, X, Check, Loader2 } from "lucide-react";
import {
  listCollections,
  createCollection,
  addAssetsToCollection,
} from "../../lib/api/collections";

interface AddToCollectionDialogProps {
  assetIds: number[];
  onClose: () => void;
  onDone?: () => void;
}

export function AddToCollectionDialog({ assetIds, onClose, onDone }: AddToCollectionDialogProps) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [done, setDone] = useState<Set<number>>(new Set());

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: () => listCollections(100),
  });

  async function handleAdd(colId: number) {
    setAdding(colId);
    try {
      await addAssetsToCollection(colId, assetIds);
      setDone((prev) => new Set([...prev, colId]));
      qc.invalidateQueries({ queryKey: ["collections"] });
    } finally {
      setAdding(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const col = await createCollection({ name });
      await addAssetsToCollection(col.id, assetIds);
      setDone((prev) => new Set([...prev, col.id]));
      qc.invalidateQueries({ queryKey: ["collections"] });
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/[0.10] bg-[#1a1a2e] shadow-popup"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-medium text-white/80">加入集合</span>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-white/30 hover:text-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Collection list */}
        <div className="max-h-60 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-white/30">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : collections.length === 0 ? (
            <p className="py-6 text-center text-xs text-white/30">暂无集合</p>
          ) : (
            collections.map((col) => (
              <button
                key={col.id}
                onClick={() => handleAdd(col.id)}
                disabled={adding === col.id || done.has(col.id)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.06] disabled:opacity-60"
              >
                <span className="truncate text-white/70">{col.name}</span>
                <span className="ml-2 shrink-0">
                  {adding === col.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                  ) : done.has(col.id) ? (
                    <Check className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-white/30" />
                  )}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Create new */}
        <div className="border-t border-white/[0.06] p-3">
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新建集合名称…"
              className="flex-1 rounded-lg bg-white/[0.06] px-3 py-2 text-xs text-white/70 placeholder:text-white/25 outline-none focus:ring-1 focus:ring-violet-500/50"
            />
            <button
              type="submit"
              disabled={!newName.trim() || creating}
              className="flex items-center gap-1 rounded-lg bg-violet-500/20 px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/30 disabled:opacity-40"
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              创建
            </button>
          </form>
        </div>

        {/* Footer */}
        {done.size > 0 && (
          <div className="border-t border-white/[0.06] px-5 py-3">
            <button
              onClick={onDone ?? onClose}
              className="w-full rounded-xl bg-violet-500/20 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/30"
            >
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
