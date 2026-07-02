"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Trash2, Upload as UploadIcon, Link2, CheckCircle2, XCircle,
  Loader2, ExternalLink, X, Plus, Tag, RotateCcw, ArrowRight,
} from "lucide-react";
import { useUpload } from "../../hooks/useUpload";
import { DropZone } from "../../components/upload/DropZone";
import { UploadItem } from "../../components/upload/UploadItem";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { cn } from "../../lib/utils";
import { detectPlatformByUrl, OVERSEAS_SOCIAL_PLATFORMS } from "../../lib/platforms";
import {
  importFromUrls,
  importFromUrl,
  getImportUrlStatus,
  getImportPlatforms,
  type ImportUrlStatus,
} from "../../lib/api/assets";

// ── Platform detection ────────────────────────────────────────────────────────

interface PlatformInfo {
  label: string;
  color: string;
}

function detectPlatform(url: string): PlatformInfo | null {
  const platform = detectPlatformByUrl(url);
  if (platform) {
    return {
      label: platform.label,
      color: platform.region === "overseas" ? "text-cyan-400" : "text-amber-400",
    };
  }
  if (/\.(mp4|mov|avi|mkv|webm|m4v|flv|jpg|jpeg|png|gif|webp|avif|mp3|m4a|wav)(\?|#|$)/i.test(url)) {
    return { label: "直接链接", color: "text-emerald-400" };
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { label: "通用 yt-dlp", color: "text-sky-400" };
  }
  return null;
}

// ── Task item type ─────────────────────────────────────────────────────────────

type ImportTaskStatus = ImportUrlStatus["status"] | "queued" | "existing" | "rejected";

interface ImportTask {
  url: string;
  task_id?: number | null;
  status: ImportTaskStatus;
  submittedAt: number;
  asset_id?: number | null;
  name?: string;
  platform?: string | null;
  platform_key?: string;
  extractor?: string;
  strategy?: string;
  error_code?: string;
  source_url?: string;
  asset_type?: number;
  error?: string;
  reason?: string | null;
  tags?: string[];
}

interface ParsedImportItem {
  url: string;
  name?: string;
  tags?: string[];
  sku_id?: number;
  brand_id?: number;
}

const TASK_STORAGE_KEY = "contentforge.importUrlTasks.v1";

// ── URL Import Panel ───────────────────────────────────────────────────────────

function UrlImportPanel() {
  const [input, setInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tasks, setTasks] = useState<ImportTask[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: capabilities } = useQuery({
    queryKey: ["import-platforms"],
    queryFn: getImportPlatforms,
    staleTime: 60_000,
  });

  useEffect(() => {
    const raw = window.localStorage.getItem(TASK_STORAGE_KEY);
    if (!raw) return;
    try {
      const restored = JSON.parse(raw) as ImportTask[];
      setTasks(restored.filter((task) => task.status === "pending" || task.status === "running" || task.status === "queued"));
    } catch {
      window.localStorage.removeItem(TASK_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks.slice(0, 200)));
  }, [tasks]);

  function addTag() {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
    tagInputRef.current?.focus();
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  async function handleSubmit() {
    const parsed = parseImportInput(input, tags);
    if (parsed.items.length === 0 && parsed.rejected.length === 0) {
      setError("请粘贴至少一个 http(s) 链接");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await importFromUrls({ items: parsed.items });
      const now = Date.now();
      const submitted = res.items.map((item): ImportTask => ({
        url: item.url,
        task_id: item.task_id,
        asset_id: item.asset_id,
        status: item.status === "queued" ? "pending" : item.status,
        platform: item.platform,
        reason: item.reason,
        submittedAt: now,
        tags: parsed.items.find((row) => row.url === item.url)?.tags,
      }));
      setTasks((prev) => [...parsed.rejected, ...submitted, ...prev]);
      setInput("");
      setTags([]);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  const pollTasks = useCallback(async () => {
    const pending = tasks.filter(
      (t) => (t.status === "pending" || t.status === "running" || t.status === "queued") && t.task_id
    );
    if (pending.length === 0) return;

    const updates = await Promise.allSettled(
      pending.map((t) => getImportUrlStatus(t.task_id!))
    );

    setTasks((prev) =>
      prev.map((task, _i) => {
        const idx = pending.findIndex((p) => p.task_id === task.task_id);
        if (idx === -1) return task;
        const result = updates[idx];
        if (result.status === "fulfilled") {
          return { ...task, ...result.value };
        }
        return task;
      })
    );
    if (updates.some((result) => result.status === "fulfilled" && result.value.status === "done")) {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    }
  }, [queryClient, tasks]);

  const pollIntervalMs = useMemo(() => {
    const active = tasks.filter((t) => t.status === "pending" || t.status === "running" || t.status === "queued");
    if (active.length === 0) return 0;
    if (active.length > 10) return 5000;
    if (active.some((t) => t.status === "running")) return 1800;
    return 3000;
  }, [tasks]);

  useEffect(() => {
    if (pollIntervalMs === 0) return;
    const id = setInterval(pollTasks, pollIntervalMs);
    return () => clearInterval(id);
  }, [pollIntervalMs, pollTasks]);

  async function retryTask(task: ImportTask) {
    const targetKey = taskKey(task);
    setTasks((prev) => prev.map((item) => taskKey(item) === targetKey ? { ...item, status: "pending", error: undefined } : item));
    try {
      const res = await importFromUrl({
        url: task.url,
        tags: task.tags,
        force: true,
      });
      setTasks((prev) =>
        prev.map((item) =>
          taskKey(item) === targetKey
            ? {
                ...item,
                task_id: res.task_id,
                asset_id: res.asset_id,
                status: res.status === "queued" ? "pending" : res.status,
                platform: res.platform,
                reason: res.reason,
                submittedAt: Date.now(),
              }
            : item
        )
      );
    } catch (err) {
      setTasks((prev) =>
        prev.map((item) =>
          taskKey(item) === targetKey
            ? { ...item, status: "failed", error: err instanceof Error ? err.message : "重试失败" }
            : item
        )
      );
    }
  }

  const inputCls =
    "w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50";
  const preview = parseImportInput(input, tags);
  const stats = summarizeTasks(tasks);
  const firstClass = capabilities?.platforms.filter((p) => p.tier === "first_class").slice(0, 10) ?? OVERSEAS_SOCIAL_PLATFORMS.slice(0, 10);

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/40">
          在线素材链接 / CSV
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"每行一个 TikTok / YouTube / Instagram / X 链接\n或 CSV: url,name,tags,sku_id,brand_id"}
          rows={7}
          className={`${inputCls} resize-none`}
          autoComplete="off"
        />
        <p className="mt-1 text-[11px] text-white/25">
          单批最多 200 条；CSV 的 tags 用 | 分隔。频道、主页、playlist 本轮不展开。
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/40 flex items-center gap-1.5">
          <Tag className="h-3 w-3" /> 追加到本批的标签
          <span className="text-white/20">（回车或逗号添加）</span>
        </label>
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 focus-within:ring-1 focus-within:ring-violet-500/50 min-h-[42px]">
          {tags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs text-violet-300"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                className="hover:text-violet-100 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => tagInput.trim() && addTag()}
            placeholder={tags.length === 0 ? "输入标签…" : ""}
            className="flex-1 min-w-[80px] bg-transparent text-sm text-white/70 outline-none placeholder:text-white/20"
          />
          {tagInput.trim() && (
            <button
              type="button"
              onClick={addTag}
              className="flex items-center gap-0.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              <Plus className="h-3 w-3" /> 添加
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {(preview.items.length > 0 || preview.rejected.length > 0) && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
          {[...preview.items.map((item) => ({ ...item, status: "ready" as const })), ...preview.rejected].slice(0, 30).map((item, index) => {
            const platform = detectPlatform(item.url);
            return (
              <div key={`${item.url}-${index}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs">
                <span className={cn("w-24 shrink-0 font-medium", platform?.color ?? "text-white/25")}>
                  {platform?.label ?? "未知"}
                </span>
                <span className="min-w-0 flex-1 truncate text-white/55">{item.url}</span>
                <span className={item.status === "ready" ? "text-emerald-300/70" : "text-red-300/70"}>
                  {item.status === "ready" ? "待提交" : item.reason}
                </span>
              </div>
            );
          })}
          {preview.items.length + preview.rejected.length > 30 && (
            <p className="px-2 text-[11px] text-white/25">还有 {preview.items.length + preview.rejected.length - 30} 条未显示</p>
          )}
        </div>
      )}

      <button
        disabled={preview.items.length === 0 || submitting}
        onClick={handleSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 hover:opacity-90"
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" />提交中…</>
        ) : (
          <><Link2 className="h-4 w-4" />提交 {preview.items.length} 条迁移任务</>
        )}
      </button>

      <p className="text-[11px] text-white/20 text-center">
        海外优先：{firstClass.map((p) => p.label).join(" · ")}
        {capabilities && ` · yt-dlp ${capabilities.ytdlp_version} / ${capabilities.extractor_count} extractors`}
      </p>

      {tasks.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-white/30 uppercase tracking-wider">迁移队列</p>
            <p className="text-[11px] text-white/30">
              完成 {stats.done} · 已存在 {stats.existing} · 失败 {stats.failed} · 跳过 {stats.rejected}
            </p>
          </div>
          {tasks.map((task) => (
            <TaskRow key={`${task.task_id ?? task.url}-${task.submittedAt}`} task={task} onRetry={retryTask} />
          ))}
        </div>
      )}
    </div>
  );
}

function taskKey(task: ImportTask): string {
  return `${task.url}-${task.submittedAt}`;
}

// ── Task row ───────────────────────────────────────────────────────────────────

function TaskRow({ task, onRetry }: { task: ImportTask; onRetry: (task: ImportTask) => void }) {
  const isActive = task.status === "pending" || task.status === "running" || task.status === "queued";
  const isDone = task.status === "done";
  const isFailed = task.status === "failed";
  const isExisting = task.status === "existing";
  const isRejected = task.status === "rejected";

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
      <div className="mt-0.5 shrink-0">
        {isActive && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
        {(isDone || isExisting) && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        {(isFailed || isRejected) && <XCircle className="h-4 w-4 text-red-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm text-white/70">
          {task.name ?? task.url}
        </p>
        <p className="mt-0.5 text-[11px] text-white/30">
          {isActive && (task.status === "running" ? "下载中…" : "等待中…")}
          {isDone && `导入完成${task.platform ? ` · ${task.platform}` : ""}`}
          {isExisting && `已存在${task.platform ? ` · ${task.platform}` : ""}`}
          {isRejected && (task.reason ?? "已跳过")}
          {isFailed && (friendlyImportError(task.error_code, task.error) ?? "导入失败")}
          {task.extractor && ` · ${task.extractor}`}
        </p>
      </div>
      {(isDone || isExisting) && task.asset_id && (
        <a
          href={`/assets/${task.asset_id}`}
          className="shrink-0 flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          查看 <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {isFailed && (
        <button
          onClick={() => onRetry(task)}
          className="shrink-0 flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />重试
        </button>
      )}
    </div>
  );
}

function parseImportInput(text: string, sharedTags: string[]): { items: ParsedImportItem[]; rejected: ImportTask[] } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 200);
  const isCsv = lines[0]?.toLowerCase().startsWith("url,");
  const rows = isCsv ? parseCsvRows(lines, sharedTags) : lines.map((url) => ({ url, tags: sharedTags }));
  const seen = new Set<string>();
  const items: ParsedImportItem[] = [];
  const rejected: ImportTask[] = [];

  for (const row of rows) {
    const url = row.url.trim();
    if (!isValidUrl(url)) {
      rejected.push(rejectedTask(url, "invalid_url"));
      continue;
    }
    if (seen.has(url)) {
      rejected.push(rejectedTask(url, "duplicate_in_batch"));
      continue;
    }
    seen.add(url);
    items.push({ ...row, url, tags: normalizeTags(row.tags ?? []) });
  }
  return { items, rejected };
}

function parseCsvRows(lines: string[], sharedTags: string[]): ParsedImportItem[] {
  const header = parseCsvLine(lines[0]).map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""]));
    return {
      url: row.url ?? "",
      name: row.name || undefined,
      tags: [...sharedTags, ...(row.tags ? row.tags.split("|") : [])],
      sku_id: row.sku_id ? Number(row.sku_id) : undefined,
      brand_id: row.brand_id ? Number(row.brand_id) : undefined,
    };
  });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === "\"") quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function rejectedTask(url: string, reason: string): ImportTask {
  return { url, status: "rejected", reason, submittedAt: Date.now() };
}

function isValidUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url);
}

function normalizeTags(values: string[]): string[] {
  return Array.from(new Set(values.map((tag) => tag.trim()).filter(Boolean)));
}

function summarizeTasks(tasks: ImportTask[]) {
  return {
    done: tasks.filter((task) => task.status === "done").length,
    existing: tasks.filter((task) => task.status === "existing").length,
    failed: tasks.filter((task) => task.status === "failed").length,
    rejected: tasks.filter((task) => task.status === "rejected").length,
  };
}

function friendlyImportError(code?: string, fallback?: string): string | null {
  const map: Record<string, string> = {
    unsupported_url: "不支持的链接，请粘贴单条作品 URL",
    auth_required: "需要登录凭据，请配置 cookies 后重试",
    geo_restricted: "地区受限，可配置代理后重试",
    too_large: "文件超过 500MB",
    download_failed: "下载失败",
    storage_failed: "存储上传失败",
  };
  return code ? map[code] ?? fallback ?? null : fallback ?? null;
}

// ── Main page ──────────────────────────────────────────────────────────────────

type Tab = "local" | "url";

export default function UploadPage() {
  const [tab, setTab] = useState<Tab>("local");
  const { uploads, enqueueFiles, removeUpload, clearDone } = useUpload();
  const queryClient = useQueryClient();
  const refreshedAssetIds = useRef<Set<number>>(new Set());

  const doneCount = uploads.filter(
    (u) => u.status === "done" || u.status === "duplicate"
  ).length;
  const allFinished =
    uploads.length > 0 &&
    uploads.every((u) => u.status === "done" || u.status === "duplicate" || u.status === "error");

  function handleFiles(files: FileList) {
    enqueueFiles(files);
  }

  useEffect(() => {
    const completed = uploads.filter(
      (upload) =>
        (upload.status === "done" || upload.status === "duplicate") &&
        upload.assetId &&
        !refreshedAssetIds.current.has(upload.assetId)
    );
    if (completed.length === 0) return;

    completed.forEach((upload) => {
      if (upload.assetId) refreshedAssetIds.current.add(upload.assetId);
    });
    queryClient.invalidateQueries({ queryKey: ["assets"] });
    queryClient.invalidateQueries({ queryKey: ["library-types-count"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  }, [queryClient, uploads]);

  function handleClearDone() {
    clearDone();
    queryClient.invalidateQueries({ queryKey: ["assets"] });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <SectionHeader
        icon={<UploadIcon className="h-4 w-4" />}
        title="上传素材"
        subtitle="支持本地文件上传或直接导入链接到素材库。"
      />

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
        {(
          [
            { id: "local", icon: UploadIcon, label: "本地上传" },
            { id: "url", icon: Link2, label: "链接导入" },
          ] as const
        ).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all",
              tab === id
                ? "bg-white/[0.08] text-white/90 shadow-sm"
                : "text-white/35 hover:text-white/55"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Local upload tab */}
      {tab === "local" && (
        <>
          <DropZone onFiles={handleFiles} accept="image/*,video/*,audio/*" />

          {uploads.length > 0 && (
            <SurfaceCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-white/60">
                  队列 · {uploads.length} 个文件
                </h2>
                {doneCount > 0 && (
                  <button
                    onClick={handleClearDone}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-white/40 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    清除已完成 ({doneCount})
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {uploads.map((item) => (
                  <UploadItem key={item.id} item={item} onRemove={removeUpload} />
                ))}
              </div>

              {allFinished && doneCount > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs text-white/40">
                    {doneCount} 个素材已入库
                  </span>
                  <Link
                    href={`/assets?uploaded=${doneCount}`}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-violet-300 hover:text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-all"
                  >
                    前往素材库查看 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </SurfaceCard>
          )}
        </>
      )}

      {/* URL import tab */}
      {tab === "url" && (
        <SurfaceCard>
          <UrlImportPanel />
        </SurfaceCard>
      )}
    </div>
  );
}
