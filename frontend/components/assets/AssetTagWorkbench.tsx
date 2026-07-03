"use client";

import { useMemo, useState } from "react";
import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Loader2, Pencil, Plus, Search, Tag, X } from "lucide-react";
import { api } from "../../lib/api";
import { createTag, listTags, renameTagFamily, type TagOut } from "../../lib/api/tags";
import { cn } from "../../lib/utils";
import { DEFAULT_TAG_FAMILIES, useTagFamilies } from "../../hooks/useTagFamilies";

interface AssetTagWorkbenchProps {
  assetId: number;
  selectedTags: string[];
  onAssetUpdated: (asset: unknown) => void;
}

export function AssetTagWorkbench({ assetId, selectedTags, onAssetUpdated }: AssetTagWorkbenchProps) {
  const qc = useQueryClient();
  const [activeFamily, setActiveFamily] = useState<string>(DEFAULT_TAG_FAMILIES[0]);
  const [activeParentId, setActiveParentId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newFamilyName, setNewFamilyName] = useState("");
  const [familyDraft, setFamilyDraft] = useState("");
  const [isRenamingFamily, setIsRenamingFamily] = useState(false);
  const [createMode, setCreateMode] = useState<"root" | "child">("root");

  const selected = useMemo(() => new Set(selectedTags.map(normalizeTag)), [selectedTags]);
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["tags", "workbench"],
    queryFn: () => listTags({ limit: 500 }),
  });

  const { families, addFamily, renameFamily } = useTagFamilies(tags);

  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    tags.forEach((tag) => {
      const family = familyFor(tag);
      counts.set(family, (counts.get(family) ?? 0) + 1);
    });
    return counts;
  }, [tags]);

  const rootTags = useMemo(
    () =>
      tags
        .filter((tag) => !tag.parent_id && familyFor(tag) === activeFamily)
        .filter((tag) => tag.name.includes(search.trim().toLowerCase()) || !search.trim())
        .sort(sortTags),
    [activeFamily, search, tags]
  );

  const parent = tags.find((tag) => tag.id === activeParentId) ?? rootTags[0] ?? null;
  const childTags = useMemo(
    () => tags.filter((tag) => tag.parent_id === parent?.id).sort(sortTags),
    [parent?.id, tags]
  );

  const addMutation = useMutation({
    mutationFn: (name: string) =>
      api.patch(`/api/assets/${assetId}`, { user_tags_add: [name] }).then((res) => res.data),
    onSuccess: (asset) => {
      onAssetUpdated(asset);
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (name: string) =>
      api.patch(`/api/assets/${assetId}`, { user_tags_remove: [name] }).then((res) => res.data),
    onSuccess: (asset) => {
      onAssetUpdated(asset);
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) return null;
      const created = await createTag({
        name,
        category: activeFamily === "未分类" ? undefined : activeFamily,
        parent_id: createMode === "child" ? parent?.id ?? null : null,
      });
      return created;
    },
    onSuccess: (created) => {
      if (!created) return;
      setNewName("");
      qc.invalidateQueries({ queryKey: ["tags"] });
      addMutation.mutate(created.name);
      if (!created.parent_id) setActiveParentId(created.id);
    },
  });

  const renameFamilyMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      renameTagFamily(oldName, newName),
    onSuccess: (_, variables) => {
      const renamed = renameFamily(variables.oldName, variables.newName);
      if (renamed) {
        setActiveFamily(renamed);
        setActiveParentId(null);
      }
      setFamilyDraft("");
      setIsRenamingFamily(false);
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  function submitFamilyRename() {
    const newName = familyDraft.trim();
    if (!newName || newName === activeFamily || renameFamilyMutation.isPending) {
      setFamilyDraft("");
      setIsRenamingFamily(false);
      return;
    }
    renameFamilyMutation.mutate({ oldName: activeFamily, newName });
  }

  function toggleTag(name: string) {
    const normalized = normalizeTag(name);
    if (selected.has(normalized)) {
      removeMutation.mutate(name);
    } else {
      addMutation.mutate(name);
    }
  }

  const busy = addMutation.isPending || removeMutation.isPending || createMutation.isPending || renameFamilyMutation.isPending;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 shadow-[0_18px_60px_oklch(0%_0_0_/_0.18)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-400/14 text-violet-200">
            <Tag className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white/90">标签工作台</h2>
            <p className="text-[11px] text-white/38">先选一级主题，再添加二级或三级标签</p>
          </div>
        </div>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-violet-300" />}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {selectedTags.length > 0 ? selectedTags.map((tag) => (
          <button
            key={tag}
            onClick={() => removeMutation.mutate(tag)}
            className="group flex items-center gap-1 rounded-full border border-violet-300/20 bg-violet-300/12 px-2.5 py-1 text-xs text-violet-100 transition-colors hover:border-red-300/30 hover:bg-red-400/10"
          >
            {tag}
            <X className="h-3 w-3 text-violet-100/40 group-hover:text-red-200" />
          </button>
        )) : (
          <span className="rounded-full border border-dashed border-white/12 px-2.5 py-1 text-xs text-white/28">未打标签</span>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索现有标签"
          className="h-9 w-full rounded-lg border border-white/8 bg-black/20 pl-8 pr-3 text-xs text-white/70 outline-none placeholder:text-white/25 focus:border-violet-300/30"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
        <TagColumn
          title="一级主题"
          action={
            <button
              type="button"
              aria-label={`重命名一级主题 ${activeFamily}`}
              onClick={() => {
                setFamilyDraft(activeFamily);
                setIsRenamingFamily(true);
              }}
              className="grid h-6 w-6 place-items-center rounded-md bg-white/[0.055] text-white/42 transition-colors hover:bg-white/10 hover:text-white/72"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          }
        >
          {families.map((family) => (
            <ColumnButton
              key={family}
              active={family === activeFamily}
              label={family}
              count={familyCounts.get(family) ?? 0}
              onClick={() => {
                setActiveFamily(family);
                setActiveParentId(null);
                setCreateMode("root");
              }}
            />
          ))}
        </TagColumn>

        <TagColumn
          title="二级标签"
          action={<AddButton onClick={() => setCreateMode("root")} active={createMode === "root"} />}
        >
          {isLoading && <div className="px-2 py-4 text-xs text-white/30">加载中...</div>}
          {!isLoading && rootTags.length === 0 && <EmptyColumn label="暂无二级标签" />}
          {rootTags.map((tag) => (
            <ColumnButton
              key={tag.id}
              active={tag.id === parent?.id}
              selected={selected.has(normalizeTag(tag.name))}
              label={tag.name}
              count={tag.use_count}
              onClick={() => {
                setActiveParentId(tag.id);
                toggleTag(tag.name);
              }}
            />
          ))}
        </TagColumn>

        <TagColumn
          title="三级标签"
          action={<AddButton onClick={() => setCreateMode("child")} active={createMode === "child"} disabled={!parent} />}
        >
          {!parent && <EmptyColumn label="先选择二级标签" />}
          {parent && childTags.length === 0 && <EmptyColumn label="暂无三级标签" />}
          {childTags.map((tag) => (
            <ColumnButton
              key={tag.id}
              selected={selected.has(normalizeTag(tag.name))}
              label={tag.name}
              count={tag.use_count}
              onClick={() => toggleTag(tag.name)}
            />
          ))}
        </TagColumn>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (newName.trim()) createMutation.mutate();
        }}
        className="mt-3 flex flex-wrap gap-2"
      >
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={createMode === "child" && parent ? `在「${parent.name}」下新建三级标签` : `在「${activeFamily}」中新建二级标签`}
          className="h-9 min-w-64 flex-1 rounded-lg border border-white/8 bg-black/18 px-3 text-xs text-white/72 outline-none placeholder:text-white/25 focus:border-violet-300/30"
        />
        <button
          type="submit"
          disabled={!newName.trim() || createMutation.isPending || (createMode === "child" && !parent)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-violet-500 px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-35"
        >
          {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          新建并添加
        </button>
      </form>

      {isRenamingFamily && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitFamilyRename();
          }}
          className="mt-2 flex flex-wrap gap-2 rounded-xl border border-violet-300/14 bg-violet-300/[0.055] p-2"
        >
          <input
            autoFocus
            value={familyDraft}
            onChange={(event) => setFamilyDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setFamilyDraft("");
                setIsRenamingFamily(false);
              }
            }}
            placeholder={`重命名「${activeFamily}」`}
            className="h-8 min-w-56 flex-1 rounded-lg border border-white/8 bg-black/18 px-3 text-xs text-white/72 outline-none placeholder:text-white/25 focus:border-violet-300/30"
          />
          <button
            type="submit"
            disabled={!familyDraft.trim() || renameFamilyMutation.isPending}
            className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500 text-white transition-opacity hover:opacity-90 disabled:opacity-35"
            aria-label="保存一级主题名称"
          >
            {renameFamilyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setFamilyDraft("");
              setIsRenamingFamily(false);
            }}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.055] text-white/45 transition-colors hover:bg-white/10 hover:text-white/70"
            aria-label="取消重命名"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const family = addFamily(newFamilyName);
          if (family) {
            setActiveFamily(family);
            setActiveParentId(null);
            setCreateMode("root");
            setNewFamilyName("");
          }
        }}
        className="mt-2 flex flex-wrap gap-2"
      >
        <input
          value={newFamilyName}
          onChange={(event) => setNewFamilyName(event.target.value)}
          placeholder="自定义一级主题，例如：素材状态"
          className="h-8 min-w-56 flex-1 rounded-lg border border-white/8 bg-black/12 px-3 text-xs text-white/62 outline-none placeholder:text-white/22 focus:border-violet-300/30"
        />
        <button
          type="submit"
          disabled={!newFamilyName.trim()}
          className="h-8 shrink-0 rounded-lg border border-white/10 px-3 text-xs text-white/56 transition-colors hover:border-violet-300/24 hover:text-violet-100 disabled:opacity-30"
        >
          新建一级
        </button>
      </form>
    </section>
  );
}

function TagColumn({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-56 max-h-96 flex-col overflow-hidden rounded-xl border border-white/8 bg-black/16 p-2">
      <div className="mb-2 flex shrink-0 items-center justify-between px-1">
        <span className="text-[11px] font-semibold text-white/42">{title}</span>
        {action}
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-auto pr-1">{children}</div>
    </div>
  );
}

function ColumnButton({
  active,
  selected,
  label,
  count,
  onClick,
}: {
  active?: boolean;
  selected?: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs transition-colors",
        active ? "bg-white/10 text-white" : "text-white/58 hover:bg-white/[0.055] hover:text-white/82"
      )}
    >
      {selected ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <ChevronRight className="h-3.5 w-3.5 text-white/22" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && count > 0 && <span className="font-mono text-[10px] text-white/28">{count}</span>}
    </button>
  );
}

function AddButton({ onClick, active, disabled }: { onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-6 w-6 place-items-center rounded-md transition-colors disabled:opacity-30",
        active ? "bg-violet-400/22 text-violet-100" : "bg-white/[0.055] text-white/45 hover:bg-white/10 hover:text-white/70"
      )}
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  );
}

function EmptyColumn({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-white/10 px-2 py-5 text-center text-xs text-white/25">{label}</div>;
}

function normalizeTag(name: string) {
  return name.trim().toLowerCase();
}

function familyFor(tag: TagOut) {
  return tag.category || "未分类";
}

function sortTags(a: TagOut, b: TagOut) {
  return b.use_count - a.use_count || a.name.localeCompare(b.name, "zh-CN");
}
