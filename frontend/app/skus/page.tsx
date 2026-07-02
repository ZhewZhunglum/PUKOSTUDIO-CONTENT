"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Plus, Trash2, Loader2, Check } from "lucide-react";
import { api } from "../../lib/api";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusPill } from "../../components/ui/StatusPill";

interface Sku {
  id: number;
  name: string;
  brand_id: number | null;
  description: string | null;
  category: string | null;
  price_cny: string | null;
  tags: string[];
  status: number;
  notes: string | null;
  created_at: string;
}

interface Brand {
  id: number;
  name: string;
}

const STATUS_META: Record<number, { label: string; variant: "neutral" | "green" | "red" }> = {
  0: { label: "草稿", variant: "neutral" },
  1: { label: "在售", variant: "green" },
  2: { label: "停售", variant: "red" },
};

async function listSkus(brandId?: number): Promise<Sku[]> {
  const params = brandId ? { brand_id: brandId } : {};
  const { data } = await api.get<Sku[]>("/api/skus", { params });
  return data;
}

async function listBrands(): Promise<Brand[]> {
  const { data } = await api.get<Brand[]>("/api/brands");
  return data;
}

async function createSku(payload: {
  name: string;
  brand_id?: number;
  description?: string;
  category?: string;
  price_cny?: number;
  tags?: string[];
}): Promise<Sku> {
  const { data } = await api.post<Sku>("/api/skus", payload);
  return data;
}

async function deleteSku(id: number): Promise<void> {
  await api.delete(`/api/skus/${id}`);
}

export default function SkusPage() {
  const qc = useQueryClient();
  const [filterBrand, setFilterBrand] = useState<number | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", brand_id: "", description: "", category: "", price_cny: "", tags: "",
  });

  const { data: skus = [], isLoading } = useQuery({
    queryKey: ["skus", filterBrand],
    queryFn: () => listSkus(filterBrand),
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: listBrands,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createSku({
        name: form.name.trim(),
        brand_id: form.brand_id ? Number(form.brand_id) : undefined,
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
        price_cny: form.price_cny ? Number(form.price_cny) : undefined,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skus"] });
      setCreating(false);
      setForm({ name: "", brand_id: "", description: "", category: "", price_cny: "", tags: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteSku,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skus"] });
      setDeleteConfirm(null);
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        icon={<ShoppingBag size={18} />}
        title="商品管理"
        subtitle="管理 SKU，关联到品牌和素材"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={filterBrand ?? ""}
              onChange={(e) => setFilterBrand(e.target.value ? Number(e.target.value) : undefined)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white/60 outline-none"
            >
              <option value="">全部品牌</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              新建商品
            </button>
          </div>
        }
      />

      {creating && (
        <SurfaceCard>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">新建商品</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key: "name", label: "商品名称 *", placeholder: "如：兰蔻小黑瓶精华液" },
              { key: "category", label: "分类", placeholder: "如：护肤品" },
              { key: "price_cny", label: "价格（元）", placeholder: "0.00" },
              { key: "tags", label: "标签（逗号分隔）", placeholder: "护肤,精华,美妆" },
              { key: "description", label: "描述", placeholder: "简短描述…" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="mb-1.5 block text-xs text-white/40">{label}</label>
                <input
                  autoFocus={key === "name"}
                  type={key === "price_cny" ? "number" : "text"}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
                />
              </div>
            ))}
            <div>
              <label className="mb-1.5 block text-xs text-white/40">品牌</label>
              <select
                value={form.brand_id}
                onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
                className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white/60 outline-none"
              >
                <option value="">— 不关联品牌 —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
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
              onClick={() => setCreating(false)}
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
      ) : skus.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08] py-16 text-white/20">
          <ShoppingBag className="h-10 w-10 opacity-30" />
          <p className="text-sm">还没有商品</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead className="border-b border-white/[0.06] bg-white/[0.02]">
              <tr>
                {["商品名", "品牌", "分类", "价格", "标签", "状态", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/25">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {skus.map((sku) => {
                const brandName = brands.find((b) => b.id === sku.brand_id)?.name;
                const meta = STATUS_META[sku.status] ?? STATUS_META[0];
                return (
                  <tr key={sku.id} className="group bg-card hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-medium text-white/70">{sku.name}</td>
                    <td className="px-4 py-3 text-white/35">{brandName ?? "—"}</td>
                    <td className="px-4 py-3 text-white/35">{sku.category ?? "—"}</td>
                    <td className="px-4 py-3 text-white/35">
                      {sku.price_cny ? `¥${Number(sku.price_cny).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {sku.tags.slice(0, 3).map((t) => (
                          <span key={t} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/40">
                            {t}
                          </span>
                        ))}
                        {sku.tags.length > 3 && (
                          <span className="text-[10px] text-white/25">+{sku.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill label={meta.label} variant={meta.variant} />
                    </td>
                    <td className="px-4 py-3">
                      {deleteConfirm === sku.id ? (
                        <button
                          onClick={() => deleteMut.mutate(sku.id)}
                          className="rounded-lg bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-500/20 transition-colors"
                        >
                          确认
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(sku.id)}
                          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
