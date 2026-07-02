"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Trash2, Loader2, Check, X, Edit3 } from "lucide-react";
import { api } from "../../lib/api";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { SectionHeader } from "../../components/ui/SectionHeader";

interface Brand {
  id: number;
  name: string;
  description: string | null;
  website: string | null;
  color_primary: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

async function listBrands(): Promise<Brand[]> {
  const { data } = await api.get<Brand[]>("/api/brands");
  return data;
}

async function createBrand(payload: { name: string; description?: string; website?: string }): Promise<Brand> {
  const { data } = await api.post<Brand>("/api/brands", payload);
  return data;
}

async function deleteBrand(id: number): Promise<void> {
  await api.delete(`/api/brands/${id}`);
}

async function updateBrand(id: number, payload: Partial<Brand>): Promise<Brand> {
  const { data } = await api.patch<Brand>(`/api/brands/${id}`, payload);
  return data;
}

const BRAND_COLORS = [
  "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e",
  "#6366f1", "#84cc16", "#ec4899", "#0ea5e9", "#14b8a6",
];

function brandColor(id: number): string {
  return BRAND_COLORS[id % BRAND_COLORS.length];
}

function BrandMonogram({ brand }: { brand: Brand }) {
  const color = brand.color_primary ?? brandColor(brand.id);
  const letter = brand.name.slice(0, 1).toUpperCase();
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
      style={{ background: `${color}22`, border: `1px solid ${color}44`, color }}
    >
      {letter}
    </div>
  );
}

export default function BrandsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", website: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["brands"],
    queryFn: listBrands,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createBrand({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        website: form.website.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      setCreating(false);
      setForm({ name: "", description: "", website: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      setDeleteConfirm(null);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => updateBrand(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      setEditId(null);
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionHeader
        icon={<Building2 size={18} />}
        title="品牌管理"
        subtitle="管理品牌信息，关联素材和商品"
        actions={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            新建品牌
          </button>
        }
      />

      {creating && (
        <SurfaceCard>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">新建品牌</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs text-white/40">品牌名称 *</label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如：兰蔻"
                className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/40">网站</label>
              <input
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/40">简介</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="可选描述…"
                className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              disabled={!form.name.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
              className="flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              创建
            </button>
            <button
              onClick={() => { setCreating(false); setForm({ name: "", description: "", website: "" }); }}
              className="rounded-xl px-4 py-2 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              取消
            </button>
          </div>
        </SurfaceCard>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-white/20" />
        </div>
      ) : brands.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08] py-16 text-white/20">
          <Building2 className="h-10 w-10 opacity-30" />
          <p className="text-sm">还没有品牌</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => {
            const accentColor = brand.color_primary ?? brandColor(brand.id);
            return (
              <div
                key={brand.id}
                className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-card p-4 transition-colors hover:border-white/[0.10]"
              >
                {/* Accent bar */}
                <div
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{ background: `linear-gradient(90deg, ${accentColor}88 0%, transparent 100%)` }}
                />

                <div className="mb-3 flex items-start justify-between">
                  {editId === brand.id ? (
                    <div className="flex flex-1 items-center gap-1">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") updateMut.mutate({ id: brand.id, name: editName });
                          if (e.key === "Escape") setEditId(null);
                        }}
                        className="flex-1 rounded-lg bg-white/[0.08] px-2 py-1 text-sm text-white/80 outline-none focus:ring-1 focus:ring-violet-500/50"
                      />
                      <button onClick={() => updateMut.mutate({ id: brand.id, name: editName })}>
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      </button>
                      <button onClick={() => setEditId(null)}>
                        <X className="h-3.5 w-3.5 text-white/30" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center gap-2.5">
                      <BrandMonogram brand={brand} />
                      <p className="font-semibold text-white/80">{brand.name}</p>
                    </div>
                  )}

                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => { setEditId(brand.id); setEditName(brand.name); }}
                      className="rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    {deleteConfirm === brand.id ? (
                      <button
                        onClick={() => deleteMut.mutate(brand.id)}
                        className="rounded-lg bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-500/20 transition-colors"
                      >
                        确认
                      </button>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(brand.id)}
                        className="rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {brand.description && (
                  <p className="mb-1.5 text-xs text-white/35">{brand.description}</p>
                )}
                {brand.website && (
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-violet-400/70 hover:text-violet-400 transition-colors"
                  >
                    {brand.website}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
