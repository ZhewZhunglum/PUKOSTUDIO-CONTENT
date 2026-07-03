"use client";

import { useMemo, useState } from "react";
import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, GitMerge, Layers3, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { createTag, deleteTag, listTags, mergeTags, type TagOut } from "../../lib/api/tags";
import { cn } from "../../lib/utils";
import { DEFAULT_TAG_FAMILIES, useTagFamilies } from "../../hooks/useTagFamilies";

export default function TagsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeFamily, setActiveFamily] = useState(DEFAULT_TAG_FAMILIES[0]);
  const [activeParentId, setActiveParentId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newMode, setNewMode] = useState<"root" | "child">("root");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mergeTarget, setMergeTarget] = useState("");

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["tags", "manager"],
    queryFn: () => listTags({ limit: 500 }),
  });

  const { families, addFamily } = useTagFamilies(tags);

  const rootTags = useMemo(
    () =>
      tags
        .filter((tag) => !tag.parent_id && familyFor(tag) === activeFamily)
        .filter((tag) => !search.trim() || tag.name.includes(search.trim().toLowerCase()))
        .sort(sortTags),
    [activeFamily, search, tags]
  );
  const activeParent = tags.find((tag) => tag.id === activeParentId) ?? rootTags[0] ?? null;
  const childTags = useMemo(
    () => tags.filter((tag) => tag.parent_id === activeParent?.id).sort(sortTags),
    [activeParent?.id, tags]
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createTag({
        name: newName.trim(),
        category: activeFamily === "未分类" ? undefined : activeFamily,
        parent_id: newMode === "child" ? activeParent?.id ?? null : null,
      }),
    onSuccess: (tag) => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      setNewName("");
      if (!tag.parent_id) setActiveParentId(tag.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      setSelectedIds((ids) => ids.filter((id) => id !== activeParentId));
    },
  });

  const mergeMutation = useMutation({
    mutationFn: () => mergeTags(selectedIds, mergeTarget.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      setSelectedIds([]);
      setMergeTarget("");
    },
  });

  function toggleSelected(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((tagId) => tagId !== id) : [...current, id]);
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-hidden">
      <SectionHeader
        icon={<Layers3 className="h-4 w-4" />}
        title="标签体系"
        subtitle={`${tags.length} 个标签 · ${families.length} 个一级主题`}
        actions={
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/28" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索二级标签"
              className="h-9 w-full rounded-lg border border-white/8 bg-white/[0.045] pl-8 pr-3 text-sm text-white/76 outline-none placeholder:text-white/25 focus:border-violet-300/30"
            />
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_1fr_1fr]">
        <SurfaceCard className="overflow-hidden p-0">
          <PanelHeader title="一级主题" />
          <div className="space-y-1 p-2">
            {families.map((family) => (
              <button
                key={family}
                onClick={() => {
                  setActiveFamily(family);
                  setActiveParentId(null);
                  setNewMode("root");
                }}
                className={cn(
                  "flex h-9 w-full items-center justify-between rounded-lg px-3 text-left text-sm transition-colors",
                  activeFamily === family ? "bg-violet-400/16 text-violet-100" : "text-white/58 hover:bg-white/[0.055] hover:text-white/80"
                )}
              >
                <span>{family}</span>
                <span className="font-mono text-[10px] text-white/28">{tags.filter((tag) => familyFor(tag) === family).length}</span>
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const family = addFamily(newFamilyName);
              if (family) {
                setActiveFamily(family);
                setActiveParentId(null);
                setNewMode("root");
                setNewFamilyName("");
              }
            }}
            className="border-t border-white/[0.06] p-2"
          >
            <input
              value={newFamilyName}
              onChange={(event) => setNewFamilyName(event.target.value)}
              placeholder="新建一级主题"
              className="mb-2 h-8 w-full rounded-lg border border-white/8 bg-white/[0.04] px-2.5 text-xs text-white/70 outline-none placeholder:text-white/24 focus:border-violet-300/30"
            />
            <button
              type="submit"
              disabled={!newFamilyName.trim()}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs text-white/56 transition-colors hover:border-violet-300/24 hover:text-violet-100 disabled:opacity-30"
            >
              <Plus className="h-3.5 w-3.5" />
              添加一级
            </button>
          </form>
        </SurfaceCard>

        <SurfaceCard className="flex min-h-0 flex-col overflow-hidden p-0">
          <PanelHeader
            title="二级标签"
            action={<AddModeButton active={newMode === "root"} onClick={() => setNewMode("root")} />}
          />
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {isLoading && <EmptyState text="加载中..." />}
            {!isLoading && rootTags.length === 0 && <EmptyState text="暂无二级标签" />}
            <div className="space-y-1">
              {rootTags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  active={tag.id === activeParent?.id}
                  selected={selectedIds.includes(tag.id)}
                  onOpen={() => setActiveParentId(tag.id)}
                  onSelect={() => toggleSelected(tag.id)}
                  onDelete={() => deleteMutation.mutate(tag.id)}
                />
              ))}
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="flex min-h-0 flex-col overflow-hidden p-0">
          <PanelHeader
            title={activeParent ? `三级标签 · ${activeParent.name}` : "三级标签"}
            action={<AddModeButton active={newMode === "child"} disabled={!activeParent} onClick={() => setNewMode("child")} />}
          />
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {!activeParent && <EmptyState text="选择一个二级标签" />}
            {activeParent && childTags.length === 0 && <EmptyState text="暂无三级标签" />}
            <div className="space-y-1">
              {childTags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  selected={selectedIds.includes(tag.id)}
                  onSelect={() => toggleSelected(tag.id)}
                  onDelete={() => deleteMutation.mutate(tag.id)}
                />
              ))}
            </div>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Plus className="h-4 w-4 shrink-0 text-violet-300" />
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && newName.trim() && createMutation.mutate()}
            placeholder={newMode === "child" && activeParent ? `在「${activeParent.name}」下新建三级标签` : `在「${activeFamily}」中新建二级标签`}
            className="h-9 min-w-56 flex-1 rounded-lg border border-white/8 bg-white/[0.045] px-3 text-sm text-white/76 outline-none placeholder:text-white/25 focus:border-violet-300/30"
          />
          <button
            disabled={!newName.trim() || createMutation.isPending || (newMode === "child" && !activeParent)}
            onClick={() => createMutation.mutate()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-violet-500 px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-35"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            新建
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 border-l border-white/10 pl-3">
            <GitMerge className="h-4 w-4 text-violet-300" />
            <span className="text-xs text-white/45">已选 {selectedIds.length}</span>
            <input
              value={mergeTarget}
              onChange={(event) => setMergeTarget(event.target.value)}
              placeholder="合并为标签名"
              className="h-9 w-40 rounded-lg border border-white/8 bg-white/[0.045] px-3 text-sm text-white/76 outline-none placeholder:text-white/25"
            />
            <button
              disabled={!mergeTarget.trim() || mergeMutation.isPending}
              onClick={() => mergeMutation.mutate()}
              className="h-9 rounded-lg border border-violet-300/20 bg-violet-300/12 px-3 text-sm text-violet-100 transition-colors hover:bg-violet-300/18 disabled:opacity-35"
            >
              合并
            </button>
            <button
              aria-label="清空选择"
              onClick={() => {
                setSelectedIds([]);
                setMergeTarget("");
              }}
              className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.055] text-white/45 transition-colors hover:bg-white/10 hover:text-white/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

function PanelHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-white/[0.06] px-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/38">{title}</h2>
      {action}
    </div>
  );
}

function AddModeButton({ active, disabled, onClick }: { active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-lg transition-colors disabled:opacity-30",
        active ? "bg-violet-400/20 text-violet-100" : "bg-white/[0.055] text-white/45 hover:bg-white/10 hover:text-white/70"
      )}
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

function TagRow({
  tag,
  active,
  selected,
  onOpen,
  onSelect,
  onDelete,
}: {
  tag: TagOut;
  active?: boolean;
  selected?: boolean;
  onOpen?: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex h-10 items-center gap-2 rounded-lg px-2 transition-colors",
        active ? "bg-white/10" : "hover:bg-white/[0.055]"
      )}
    >
      {onOpen && (
        <button onClick={onOpen} className="grid h-7 w-7 place-items-center rounded-md text-white/28 hover:bg-white/10 hover:text-white/70">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={onSelect}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-sm",
          selected ? "text-violet-100" : "text-white/68"
        )}
      >
        {tag.name}
      </button>
      <span className="font-mono text-[10px] text-white/28">{tag.use_count}</span>
      {!tag.is_system && (
        <button
          aria-label={`删除标签 ${tag.name}`}
          onClick={onDelete}
          className="grid h-7 w-7 place-items-center rounded-md text-white/18 opacity-0 transition-all hover:bg-red-400/10 hover:text-red-200 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-white/25">{text}</div>;
}

function familyFor(tag: TagOut) {
  return tag.category || "未分类";
}

function sortTags(a: TagOut, b: TagOut) {
  return b.use_count - a.use_count || a.name.localeCompare(b.name, "zh-CN");
}
