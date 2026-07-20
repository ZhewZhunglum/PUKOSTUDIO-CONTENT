"use client";

import { useState } from "react";
import { X, Tag, FolderPlus, Heart, Trash2, Sparkles } from "lucide-react";
import { api } from "../../lib/api";
import { AddToCollectionDialog } from "./AddToCollectionDialog";

interface BulkActionBarProps {
  selected: Set<number>;
  onClear: () => void;
  onDone?: () => void;
}

export function BulkActionBar({ selected, onClear, onDone }: BulkActionBarProps) {
  const [showCollection, setShowCollection] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAITagConfirm, setShowAITagConfirm] = useState(false);
  const [aiTagging, setAITagging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const count = selected.size;
  const ids = Array.from(selected);

  async function bulkFavorite() {
    setLoading(true);
    try {
      await api.post("/api/assets/bulk-favorite", { asset_ids: ids, favorite: true });
    } catch {
      showToast("收藏失败，请重试");
    } finally {
      setLoading(false);
    }
    onClear();
    onDone?.();
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function bulkAITag() {
    setAITagging(true);
    setShowAITagConfirm(false);
    try {
      await api.post("/api/assets/bulk-ai-tag", { asset_ids: ids, quality: "bulk_local" });
      showToast(`${count} 个素材已加入后台 AI 打标签队列`);
    } catch {
      showToast("提交失败，请重试");
    } finally {
      setAITagging(false);
    }
  }

  async function bulkDelete() {
    if (!confirm(`确认删除选中的 ${count} 个素材？`)) return;
    setLoading(true);
    try {
      await api.post("/api/assets/bulk-delete", { asset_ids: ids });
    } catch {
      alert("删除失败，请重试");
    }
    setLoading(false);
    onClear();
    onDone?.();
  }

  async function bulkTag() {
    const tag = tagInput.trim();
    if (!tag) return;
    setLoading(true);
    try {
      await api.post("/api/assets/bulk-tag", { asset_ids: ids, tag });
    } catch {
      showToast("打标签失败，请重试");
    } finally {
      setLoading(false);
    }
    setTagInput("");
    setShowTagInput(false);
    onDone?.();
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-6 z-40 mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-white/[0.12] bg-[#1a1a2e]/95 px-4 py-3 shadow-popup backdrop-blur-md">
        {/* Count + clear */}
        <div className="flex items-center gap-2 text-sm font-medium text-white/70">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/25 text-xs text-violet-300">
            {count}
          </span>
          已选
        </div>

        <div className="mx-2 h-5 w-px bg-white/[0.10]" />

        {/* Tag */}
        {showTagInput ? (
          <form
            onSubmit={(e) => { e.preventDefault(); bulkTag(); }}
            className="flex items-center gap-1"
          >
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="输入标签…"
              autoFocus
              className="h-7 w-32 rounded-lg bg-white/[0.06] px-2 text-xs text-white/80 outline-none focus:ring-1 focus:ring-violet-500/50"
            />
            <button type="submit" className="h-7 rounded-lg bg-violet-500/20 px-2 text-xs text-violet-300 hover:bg-violet-500/30">
              添加
            </button>
            <button type="button" onClick={() => setShowTagInput(false)} className="text-white/30 hover:text-white/60">
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowTagInput(true)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/50 hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-40"
          >
            <Tag className="h-3.5 w-3.5" />
            打标签
          </button>
        )}

        <button
          onClick={() => setShowAITagConfirm(true)}
          disabled={loading || aiTagging}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-blue-300/70 hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI打标签
        </button>

        <button
          onClick={() => setShowCollection(true)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/50 hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-40"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          加入集合
        </button>

        <button
          onClick={bulkFavorite}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/50 hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-40"
        >
          <Heart className="h-3.5 w-3.5" />
          收藏
        </button>

        <button
          onClick={bulkDelete}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/50 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除
        </button>

        <button
          onClick={onClear}
          className="ml-auto rounded-full p-1 text-white/30 hover:text-white/60"
          aria-label="取消选择"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {showCollection && (
        <AddToCollectionDialog
          assetIds={ids}
          onClose={() => setShowCollection(false)}
          onDone={() => { setShowCollection(false); onDone?.(); }}
        />
      )}

      {showAITagConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-white/[0.1] bg-[oklch(12%_0.02_278)] p-6 shadow-2xl">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-white/90">AI 批量打标签</span>
            </div>
            <p className="mb-1 text-xs text-white/50">
              将对 <span className="font-medium text-white/80">{count} 个素材</span> 使用 Claude Vision 自动生成标签和描述。
            </p>
            <p className="mb-5 text-xs text-white/40">
              预计耗时 {Math.ceil(count * 0.5)} 秒，任务在后台运行，不影响正常使用。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAITagConfirm(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-white/40 hover:text-white/70"
              >
                取消
              </button>
              <button
                onClick={bulkAITag}
                className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/30"
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/[0.1] bg-[oklch(14%_0.02_278)]/95 px-4 py-2.5 text-xs text-white/80 shadow-popup backdrop-blur-md">
          {toast}
        </div>
      )}
    </>
  );
}
