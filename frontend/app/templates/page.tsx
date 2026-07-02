"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutTemplate, Copy, Check, ChevronRight, Zap,
  Plus, Trash2, Loader2,
} from "lucide-react";
import Link from "next/link";
import { listTemplates, createTemplate, deleteTemplate, markTemplateUsed, type Template } from "../../lib/api/templates";
import { SOCIAL_PLATFORMS, platformLabel } from "../../lib/platforms";

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<string>("全部");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", category: "", platform: "", style: "",
    duration: "", description: "", hooks: "", outline: "", cta: "",
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => listTemplates(),
  });

  const categories = ["全部", ...Array.from(new Set(templates.map((t) => t.category).filter(Boolean) as string[]))];
  const filtered = activeCategory === "全部"
    ? templates
    : templates.filter((t) => t.category === activeCategory);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  const createMut = useMutation({
    mutationFn: () => createTemplate({
      name: form.name.trim(),
      category: form.category.trim() || undefined,
      platform: form.platform.trim() || undefined,
      style: form.style.trim() || undefined,
      duration: form.duration ? Number(form.duration) : undefined,
      description: form.description.trim() || undefined,
      hooks: form.hooks.split("\n").map((h) => h.trim()).filter(Boolean),
      outline: form.outline.split("\n").map((o) => o.trim()).filter(Boolean),
      cta: form.cta.trim() || undefined,
    }),
    onSuccess: (tmpl) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setCreating(false);
      setSelectedId(tmpl.id);
      setForm({ name: "", category: "", platform: "", style: "", duration: "", description: "", hooks: "", outline: "", cta: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setDeleteConfirm(null);
      if (selectedId === deleteConfirm) setSelectedId(null);
    },
  });

  const useMut = useMutation({
    mutationFn: (id: number) => markTemplateUsed(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  async function copyHooks(template: Template) {
    const text = template.hooks.map((h, i) => `${i + 1}. ${h}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(`hooks-${template.id}`);
    setTimeout(() => setCopied(null), 1500);
  }

  async function copyOutline(template: Template) {
    const text = template.outline.join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(`outline-${template.id}`);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="flex h-full gap-0 overflow-hidden -m-6">
      {/* Sidebar */}
      <aside className="flex w-72 flex-col border-r border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">模板中心</span>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="rounded-md bg-primary/10 p-1 text-primary hover:bg-primary/20"
              title="新建模板"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <LayoutTemplate className="h-8 w-8 opacity-20" />
              <p className="text-xs">还没有模板</p>
            </div>
          ) : (
            filtered.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedId(template.id)}
                className={`group flex w-full flex-col items-start gap-1 border-b border-border px-4 py-3 text-left transition hover:bg-accent ${
                  template.id === selectedId ? "bg-accent" : ""
                }`}
              >
                <div className="flex w-full items-start justify-between">
                  <p className="text-sm font-medium">{template.name}</p>
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {template.platform && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {platformLabel(template.platform)}
                    </span>
                  )}
                  {template.duration && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {template.duration}s
                    </span>
                  )}
                  {template.category && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {template.category}
                    </span>
                  )}
                  {template.is_builtin && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                      内置
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Detail panel / Create form */}
      <main className="flex-1 overflow-y-auto">
        {creating ? (
          <div className="max-w-2xl space-y-5 p-8">
            <h2 className="text-lg font-semibold">新建模板</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">模板名称 *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="如：产品测评 30秒"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">分类</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="如：测评"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">平台</label>
                <select
                  value={form.platform}
                  onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">通用 / 不限平台</option>
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <option key={platform.value} value={platform.value}>{platform.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">时长（秒）</label>
                <input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  placeholder="30"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">描述</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="简短说明这个模板适用于什么场景"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">开场钩子（每行一个）</label>
              <textarea
                value={form.hooks}
                onChange={(e) => setForm((f) => ({ ...f, hooks: e.target.value }))}
                rows={3}
                placeholder={"这个产品让我惊呆了！\n我已经用了30天，真实效果来了"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">脚本结构（每行一步）</label>
              <textarea
                value={form.outline}
                onChange={(e) => setForm((f) => ({ ...f, outline: e.target.value }))}
                rows={4}
                placeholder={"钩子 (0-3s): 开场惊喜/问题引出\n产品展示 (3-8s): 外观+包装"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">CTA 建议</label>
              <input
                value={form.cta}
                onChange={(e) => setForm((f) => ({ ...f, cta: e.target.value }))}
                placeholder="点击主页链接购买，评论区留言有惊喜"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <button
                disabled={!form.name.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                保存模板
              </button>
              <button
                onClick={() => setCreating(false)}
                className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                取消
              </button>
            </div>
          </div>
        ) : !selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <LayoutTemplate className="h-12 w-12 opacity-15" />
            <p className="text-sm">选择一个模板查看详情</p>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Plus className="h-3 w-3" />
              新建自定义模板
            </button>
          </div>
        ) : (
          <div className="max-w-2xl space-y-6 p-8">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold">{selected.name}</h1>
                {selected.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.platform && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                      {platformLabel(selected.platform)}
                    </span>
                  )}
                  {selected.duration && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {selected.duration}s
                    </span>
                  )}
                  {selected.style && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {selected.style}
                    </span>
                  )}
                  {selected.is_builtin && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">内置</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {!selected.is_builtin && (
                  deleteConfirm === selected.id ? (
                    <button
                      onClick={() => deleteMut.mutate(selected.id)}
                      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive hover:bg-destructive hover:text-white"
                    >
                      确认删除
                    </button>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(selected.id)}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )
                )}
                <Link
                  href="/ai/one-click"
                  onClick={() => useMut.mutate(selected.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Zap className="h-4 w-4" />
                  使用此模板成片
                </Link>
              </div>
            </div>

            {/* Hooks */}
            {selected.hooks.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">开场钩子备选</h2>
                  <button
                    onClick={() => copyHooks(selected)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copied === `hooks-${selected.id}` ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    复制全部
                  </button>
                </div>
                <ol className="space-y-2">
                  {selected.hooks.map((hook, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="text-foreground/80">{hook}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Outline */}
            {selected.outline.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">脚本结构</h2>
                  <button
                    onClick={() => copyOutline(selected)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copied === `outline-${selected.id}` ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    复制
                  </button>
                </div>
                <ol className="space-y-2">
                  {selected.outline.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      <span className="text-foreground/80">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* CTA */}
            {selected.cta && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-2 text-sm font-semibold">CTA 建议</h2>
                <p className="text-sm italic text-muted-foreground">"{selected.cta}"</p>
              </div>
            )}

            {/* Stats */}
            <p className="text-xs text-muted-foreground">
              使用次数: {selected.use_count} · 创建: {new Date(selected.created_at).toLocaleDateString("zh-CN")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
