"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Plus, Trash2, Loader2, Check } from "lucide-react";
import { api } from "../../lib/api";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusPill } from "../../components/ui/StatusPill";

interface Project {
  id: number;
  name: string;
  description: string | null;
  status: number;
  sku_id: number | null;
  brand_id: number | null;
  deadline: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_META: Record<number, { label: string; variant: "neutral" | "blue" | "green" | "amber" }> = {
  0: { label: "草稿",   variant: "neutral" },
  1: { label: "进行中", variant: "blue" },
  2: { label: "完成",   variant: "green" },
  3: { label: "归档",   variant: "amber" },
};

async function listProjects(status?: number): Promise<Project[]> {
  const params = status !== undefined ? { status } : {};
  const { data } = await api.get<Project[]>("/api/projects", { params });
  return data;
}

async function createProject(payload: { name: string; description?: string; status?: number }): Promise<Project> {
  const { data } = await api.post<Project>("/api/projects", payload);
  return data;
}

async function deleteProject(id: number): Promise<void> {
  await api.delete(`/api/projects/${id}`);
}

async function patchProject(id: number, patch: Partial<Project>): Promise<Project> {
  const { data } = await api.patch<Project>(`/api/projects/${id}`, patch);
  return data;
}

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<number | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", status: "0" });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", filterStatus],
    queryFn: () => listProjects(filterStatus),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createProject({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: Number(form.status),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setCreating(false);
      setForm({ name: "", description: "", status: "0" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setDeleteConfirm(null);
    },
  });

  const patchMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) => patchProject(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        icon={<Briefcase size={18} />}
        title="项目管理"
        subtitle="组织视频生产项目，关联商品和品牌"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={filterStatus ?? ""}
              onChange={(e) => setFilterStatus(e.target.value !== "" ? Number(e.target.value) : undefined)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white/60 outline-none"
            >
              <option value="">全部状态</option>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              新建项目
            </button>
          </div>
        }
      />

      {creating && (
        <SurfaceCard>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">新建项目</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs text-white/40">项目名称 *</label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如：Q2 产品推广视频"
                className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/40">初始状态</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white/60 outline-none"
              >
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/40">描述</label>
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
              onClick={() => setCreating(false)}
              className="rounded-xl px-4 py-2 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              取消
            </button>
          </div>
        </SurfaceCard>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12 text-white/20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08] py-16 text-white/20">
          <Briefcase className="h-10 w-10 opacity-30" />
          <p className="text-sm">还没有项目</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => {
            const meta = STATUS_META[project.status] ?? STATUS_META[0];
            return (
              <div
                key={project.id}
                className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-card px-5 py-4 hover:border-white/[0.10] hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <p className="font-medium text-white/80">{project.name}</p>
                    <StatusPill label={meta.label} variant={meta.variant} />
                  </div>
                  {project.description && (
                    <p className="mt-0.5 truncate text-xs text-white/30">{project.description}</p>
                  )}
                  <p className="mt-1 text-[11px] text-white/20">
                    {new Date(project.created_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>

                <select
                  value={project.status}
                  onChange={(e) => patchMut.mutate({ id: project.id, status: Number(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-white/50 opacity-0 group-hover:opacity-100 outline-none transition-opacity"
                >
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>

                {deleteConfirm === project.id ? (
                  <button
                    onClick={() => deleteMut.mutate(project.id)}
                    className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    确认删除
                  </button>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(project.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
