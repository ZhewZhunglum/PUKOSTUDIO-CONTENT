"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GitMerge, Plus, Search, Trash2, Tag as TagIcon, X, Hash } from "lucide-react";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import {
  createTag,
  deleteTag,
  listTags,
  mergeTags,
  type TagOut,
} from "../../lib/api/tags";
import { cn } from "../../lib/utils";

const CATEGORIES = ["全部", "场景", "人物", "情绪", "运镜", "视觉风格", "色调", "构图", "平台适配", "比例", "质量", "品类", "场景用途"];

export default function TagsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mergeTarget, setMergeTarget] = useState("");

  const { data: tags = [] } = useQuery({
    queryKey: ["tags", search, category],
    queryFn: () =>
      listTags({
        search: search || undefined,
        category: category === "全部" ? undefined : category,
        limit: 500,
      }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTag({ name: newName.trim(), category: newCategory || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      setNewName("");
      setCreating(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });

  const mergeMutation = useMutation({
    mutationFn: () => mergeTags(selectedIds, mergeTarget.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      setSelectedIds([]);
      setMergeTarget("");
    },
  });

  const grouped = tags.reduce<Record<string, TagOut[]>>((acc, tag) => {
    const key = tag.category ?? "其他";
    if (!acc[key]) acc[key] = [];
    acc[key].push(tag);
    return acc;
  }, {});

  function toggleSelected(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((tagId) => tagId !== id) : [...current, id]
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-hidden">
      <SectionHeader
        icon={<Hash className="h-4 w-4" />}
        title="标签管理"
        subtitle={`${tags.length} 个标签`}
        actions={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            新建标签
          </button>
        }
      />

      {creating && (
        <SurfaceCard className="flex items-center gap-3 shrink-0">
          <TagIcon className="h-4 w-4 text-violet-400 shrink-0" />
          <input
            autoFocus
            placeholder="标签名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && createMutation.mutate()}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs text-white/60 outline-none"
          >
            <option value="">无分类</option>
            {CATEGORIES.slice(1).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            disabled={!newName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            创建
          </button>
          <button
            onClick={() => { setCreating(false); setNewName(""); }}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            取消
          </button>
        </SurfaceCard>
      )}

      <div className="flex items-center gap-3 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="search"
            placeholder="搜索标签…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-lg bg-white/[0.06] pl-8 pr-3 text-sm text-white/80 placeholder:text-white/25 outline-none focus:ring-1 focus:ring-violet-500/50"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "shrink-0 h-8 rounded-lg px-3 text-xs transition-colors",
                category === c
                  ? "bg-violet-500/20 text-violet-300"
                  : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <SurfaceCard className="flex flex-wrap items-center gap-2 shrink-0">
          <GitMerge className="h-4 w-4 text-violet-300" />
          <span className="text-xs text-white/50">已选 {selectedIds.length} 个</span>
          <input
            placeholder="合并为标签名"
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            className="h-8 min-w-40 flex-1 rounded-lg bg-white/[0.06] px-3 text-sm text-white/80 outline-none placeholder:text-white/25 focus:ring-1 focus:ring-violet-500/50"
          />
          <button
            disabled={!mergeTarget.trim() || mergeMutation.isPending}
            onClick={() => mergeMutation.mutate()}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-violet-500 px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <GitMerge className="h-3.5 w-3.5" />
            合并
          </button>
          <button
            aria-label="清空选择"
            onClick={() => {
              setSelectedIds([]);
              setMergeTarget("");
            }}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04] text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </SurfaceCard>
      )}

      <div className="flex-1 overflow-auto space-y-6">
        {Object.entries(grouped).map(([cat, catTags]) => (
          <section key={cat}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">
              {cat} · {catTags.length}
            </h2>
            <div className="flex flex-wrap gap-2">
              {catTags.map((tag) => (
                <div
                  key={tag.id}
                  onClick={() => toggleSelected(tag.id)}
                  className={cn(
                    "group flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors",
                    selectedIds.includes(tag.id)
                      ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30"
                      : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1]"
                  )}
                  style={tag.color ? { borderLeft: `3px solid ${tag.color}` } : undefined}
                >
                  <span>{tag.name}</span>
                  {tag.use_count > 0 && (
                    <span className="text-white/25">{tag.use_count}</span>
                  )}
                  {!tag.is_system && (
                    <button
                      aria-label="删除标签"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteMutation.mutate(tag.id);
                      }}
                      className="ml-1 opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        {tags.length === 0 && (
          <div className="flex h-40 items-center justify-center text-white/20">
            暂无标签
          </div>
        )}
      </div>
    </div>
  );
}
