"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Download, Star, Heart, Tag, Image as ImageIcon,
  Film, Volume2, FileText, Loader2, Copy, Check, Sparkles,
  Calendar, HardDrive, Clock, Eye, Plus, X, RefreshCw,
  GitBranch, Trash2,
} from "lucide-react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { StatusPill } from "../../../components/ui/StatusPill";

// Backend stores {name, source, confidence} — not {label, score}
interface AITag {
  name: string;
  source: string;
  confidence: number;
}

interface AssetDetail {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  asset_type: number;
  asset_subtype: string | null;
  mime_type: string | null;
  file_format: string | null;
  file_size: number | null;
  storage_key: string;
  thumbnail_key: string | null;
  cdn_url: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  user_tags: string[];
  ai_tags: AITag[] | null;
  ai_description: string | null;
  source: number;
  source_url: string | null;
  source_platform: string | null;
  source_extractor: string | null;
  source_model: string | null;
  source_prompt: string | null;
  favorite: boolean;
  rating: number;
  use_count: number;
  view_count: number;
  ai_processing_status: number;
  imported_at: string;
  updated_at: string;
  captured_at: string | null;
}

interface AssetRelation {
  id: number;
  source_asset_id: number;
  target_asset_id: number;
  relation_type: string;
  metadata: Record<string, unknown> | null;
}

const ASSET_TYPE_META: Record<number, { label: string; icon: React.ElementType; color: string }> = {
  1: { label: "图片", icon: ImageIcon, color: "text-blue-400" },
  2: { label: "视频", icon: Film, color: "text-violet-400" },
  3: { label: "音频", icon: Volume2, color: "text-green-400" },
  4: { label: "字幕", icon: FileText, color: "text-yellow-400" },
  5: { label: "脚本", icon: FileText, color: "text-cyan-400" },
  10: { label: "输出", icon: Film, color: "text-orange-400" },
  11: { label: "分析报告", icon: FileText, color: "text-pink-400" },
};

const SOURCE_LABEL: Record<number, string> = {
  1: "用户上传", 2: "AI 生成", 3: "URL 导入", 5: "渲染输出",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${(s % 60).toString().padStart(2, "0")}` : `${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

async function getAsset(id: number): Promise<AssetDetail> {
  const { data } = await api.get<AssetDetail>(`/api/assets/${id}`);
  return data;
}

async function getRelations(id: number): Promise<AssetRelation[]> {
  const { data } = await api.get<AssetRelation[]>(`/api/relations/asset/${id}`);
  return data;
}

export default function AssetDetailPage({ params }: { params: { id: string } }) {
  const { id: idStr } = params;
  const assetId = Number(idStr);
  const qc = useQueryClient();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagPending, setTagPending] = useState(false);
  const [retagging, setRetagging] = useState(false);

  const isProcessing = (status: number) => status === 1;

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => getAsset(assetId),
    enabled: !isNaN(assetId),
    // Poll every 3s while AI is processing
    refetchInterval: (query) =>
      isProcessing(query.state.data?.ai_processing_status ?? -1) ? 3000 : false,
  });

  const { data: relations = [] } = useQuery({
    queryKey: ["asset-relations", assetId],
    queryFn: () => getRelations(assetId),
    enabled: !isNaN(assetId),
  });

  const favMut = useMutation({
    mutationFn: (fav: boolean) => api.patch<AssetDetail>(`/api/assets/${assetId}`, { favorite: fav }).then(r => r.data),
    onSuccess: (updated) => qc.setQueryData(["asset", assetId], updated),
  });

  const ratingMut = useMutation({
    mutationFn: (rating: number) => api.patch<AssetDetail>(`/api/assets/${assetId}`, { rating }).then(r => r.data),
    onSuccess: (updated) => qc.setQueryData(["asset", assetId], updated),
  });

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    const tag = tagInput.trim();
    if (!tag || tagPending) return;
    setTagPending(true);
    try {
      const { data } = await api.patch<AssetDetail>(`/api/assets/${assetId}`, { user_tags_add: [tag] });
      qc.setQueryData(["asset", assetId], data);
      setTagInput("");
    } finally {
      setTagPending(false);
    }
  }

  async function removeTag(tag: string) {
    try {
      const { data } = await api.patch<AssetDetail>(`/api/assets/${assetId}`, { user_tags_remove: [tag] });
      qc.setQueryData(["asset", assetId], data);
    } catch { /* ignore */ }
  }

  async function triggerRetag() {
    setRetagging(true);
    try {
      await api.post(`/api/assets/${assetId}/ai-tag?force=true`);
      // Optimistically set status to "processing" so polling kicks in
      qc.setQueryData<AssetDetail>(["asset", assetId], (prev) =>
        prev ? { ...prev, ai_processing_status: 1 } : prev
      );
    } finally {
      setRetagging(false);
    }
  }

  async function handleDelete() {
    if (!asset) return;
    if (!confirm(`确认删除「${asset.name}」？此操作不可恢复。`)) return;
    setDeleting(true);
    try {
      await api.delete(`/api/assets/${assetId}`);
      router.replace("/assets");
    } catch (e) {
      alert("删除失败，请重试");
      setDeleting(false);
    }
  }

  async function copyStorageKey() {
    if (!asset) return;
    await navigator.clipboard.writeText(asset.storage_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/20" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-white/20">
        <p className="text-sm">素材未找到</p>
        <Link href="/assets" className="text-xs text-violet-400 hover:underline">返回素材库</Link>
      </div>
    );
  }

  const typeMeta = ASSET_TYPE_META[asset.asset_type] ?? ASSET_TYPE_META[1];
  const TypeIcon = typeMeta.icon;
  const aiStatus = asset.ai_processing_status;
  const hasAIResults = (asset.ai_tags && asset.ai_tags.length > 0) || asset.ai_description;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-white/35">
        <Link href="/assets" className="flex items-center gap-1 hover:text-white/70 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          素材库
        </Link>
        <span>/</span>
        <span className="text-white/60 truncate max-w-xs">{asset.name}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Preview ── */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            {asset.cdn_url && asset.asset_type === 1 ? (
              <img src={asset.cdn_url} alt={asset.name} className="w-full object-contain" style={{ maxHeight: 520 }} />
            ) : asset.cdn_url && asset.asset_type === 2 ? (
              <video src={asset.cdn_url} controls className="w-full" style={{ maxHeight: 520 }} />
            ) : asset.cdn_url && asset.asset_type === 3 ? (
              <div className="flex items-center justify-center py-12">
                <audio src={asset.cdn_url} controls className="w-full max-w-md" />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <TypeIcon className={`h-16 w-16 opacity-15 ${typeMeta.color}`} />
              </div>
            )}
          </div>

          {/* AI Analysis block */}
          <SurfaceCard>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/30">AI 分析</span>
              </div>
              <div className="flex items-center gap-2">
                {aiStatus === 0 && <StatusPill label="待分析" variant="neutral" dot />}
                {aiStatus === 1 && <StatusPill label="分析中…" variant="blue" dot />}
                {aiStatus === 2 && <StatusPill label="已完成" variant="green" dot />}
                {aiStatus === 3 && <StatusPill label="失败" variant="red" dot />}
                <button
                  onClick={triggerRetag}
                  disabled={retagging || aiStatus === 1}
                  title={aiStatus === 2 ? "重新分析" : "开始分析"}
                  className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1 text-xs text-white/40 hover:text-white/70 disabled:opacity-30 transition-colors"
                >
                  <RefreshCw className={`h-3 w-3 ${retagging || aiStatus === 1 ? "animate-spin" : ""}`} />
                  {aiStatus === 2 ? "重新分析" : "立即分析"}
                </button>
              </div>
            </div>

            {aiStatus === 1 && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-500/5 px-4 py-3 text-sm text-blue-300/70">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                AI 正在分析素材，标签将自动更新…
              </div>
            )}

            {aiStatus === 3 && (
              <div className="rounded-xl bg-red-500/5 px-4 py-3 text-sm text-red-300/70">
                分析失败，可点击「立即分析」重试。
              </div>
            )}

            {!hasAIResults && aiStatus === 0 && (
              <p className="text-sm text-white/20">点击「立即分析」让 AI 自动识别内容并打标签。</p>
            )}

            {asset.ai_description && (
              <div className="mb-4">
                <p className="mb-1.5 text-[11px] uppercase tracking-wider text-white/25">AI 描述</p>
                <p className="text-sm leading-relaxed text-white/60">{asset.ai_description}</p>
              </div>
            )}

            {asset.ai_tags && asset.ai_tags.length > 0 && (
              <div>
                <p className="mb-2.5 text-[11px] uppercase tracking-wider text-white/25">AI 标签</p>
                <div className="flex flex-wrap gap-1.5">
                  {asset.ai_tags.map((t) => (
                    <span
                      key={t.name}
                      className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300"
                      title={`置信度 ${Math.round(t.confidence * 100)}%`}
                    >
                      {t.name}
                      <span className="text-blue-400/40 text-[10px]">{Math.round(t.confidence * 100)}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </SurfaceCard>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Name + actions */}
          <SurfaceCard>
            <div className="mb-4 flex items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]`}>
                <TypeIcon className={`h-5 w-5 ${typeMeta.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-semibold leading-tight text-white/90">{asset.name}</h1>
                <p className="text-xs text-white/35">{typeMeta.label}</p>
              </div>
            </div>

            {/* Rating */}
            <div className="mb-4 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => ratingMut.mutate(star === asset.rating ? 0 : star)}
                  className="p-0.5"
                >
                  <Star
                    className={`h-4.5 w-4.5 transition-colors ${
                      star <= asset.rating ? "fill-amber-400 text-amber-400" : "text-white/15 hover:text-amber-400/50"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-1.5 text-xs text-white/25">{asset.rating}/5</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => favMut.mutate(!asset.favorite)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-sm transition-colors ${
                  asset.favorite
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : "border-white/[0.08] text-white/40 hover:border-white/[0.14] hover:text-white/70"
                }`}
              >
                <Heart className={`h-4 w-4 ${asset.favorite ? "fill-current" : ""}`} />
                {asset.favorite ? "已收藏" : "收藏"}
              </button>
              {asset.cdn_url && (
                <a
                  href={asset.cdn_url}
                  download={asset.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] py-2 text-sm text-white/40 hover:border-white/[0.14] hover:text-white/70 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  下载
                </a>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-2 text-sm text-white/40 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40 transition-colors"
                title="删除此素材"
              >
                {deleting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />
                }
              </button>
            </div>
          </SurfaceCard>

          {/* Metadata */}
          <SurfaceCard>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">素材信息</p>
            <dl className="space-y-2.5 text-sm">
              {asset.file_size && (
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-white/40"><HardDrive className="h-3.5 w-3.5" />文件大小</dt>
                  <dd className="text-white/60">{formatBytes(asset.file_size)}</dd>
                </div>
              )}
              {asset.width && asset.height && (
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-white/40"><ImageIcon className="h-3.5 w-3.5" />尺寸</dt>
                  <dd className="text-white/60">{asset.width} × {asset.height}</dd>
                </div>
              )}
              {asset.duration_ms && (
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-white/40"><Clock className="h-3.5 w-3.5" />时长</dt>
                  <dd className="text-white/60">{formatDuration(asset.duration_ms)}</dd>
                </div>
              )}
              {asset.mime_type && (
                <div className="flex items-center justify-between">
                  <dt className="text-white/40">格式</dt>
                  <dd className="font-mono text-xs text-white/50">{asset.mime_type}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-white/40">来源</dt>
                <dd className="text-white/60">{asset.source_platform ?? SOURCE_LABEL[asset.source] ?? "未知"}</dd>
              </div>
              {asset.source_extractor && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-white/40">下载器</dt>
                  <dd className="truncate font-mono text-xs text-white/55">{asset.source_extractor}</dd>
                </div>
              )}
              {asset.source_model && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-white/40">来源模型</dt>
                  <dd className="truncate font-mono text-xs text-white/55">{asset.source_model}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-white/40"><Eye className="h-3.5 w-3.5" />使用次数</dt>
                <dd className="text-white/60">{asset.use_count}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-white/40"><Calendar className="h-3.5 w-3.5" />导入时间</dt>
                <dd className="text-xs text-white/50">{formatDate(asset.imported_at)}</dd>
              </div>
            </dl>
            {asset.source_prompt && (
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <p className="mb-2 text-[11px] uppercase tracking-wider text-white/25">Source Prompt</p>
                <p className="max-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-white/[0.04] p-2.5 text-xs leading-relaxed text-white/45">
                  {asset.source_prompt}
                </p>
              </div>
            )}
            {asset.source_url && (
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <p className="mb-2 text-[11px] uppercase tracking-wider text-white/25">原始链接</p>
                <a
                  href={asset.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate rounded-lg bg-white/[0.04] p-2.5 text-xs text-violet-300/80 hover:text-violet-200"
                >
                  {asset.source_url}
                </a>
              </div>
            )}
          </SurfaceCard>

          {/* Relations */}
          <SurfaceCard>
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/30">
              <GitBranch className="h-3 w-3" />
              关系图
            </p>
            {relations.length > 0 ? (
              <div className="space-y-2">
                {relations.slice(0, 4).map((rel) => {
                  const otherId = rel.source_asset_id === asset.id ? rel.target_asset_id : rel.source_asset_id;
                  return (
                    <Link
                      key={rel.id}
                      href={`/assets/${otherId}`}
                      className="flex items-center justify-between rounded-lg bg-white/[0.04] px-2.5 py-2 text-xs text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white/70"
                    >
                      <span>{rel.relation_type}</span>
                      <span className="font-mono">Asset #{otherId}</span>
                    </Link>
                  );
                })}
                {relations.length > 4 && (
                  <p className="text-xs text-white/25">还有 {relations.length - 4} 条关系</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/20">暂无派生、组成或使用关系。</p>
            )}
          </SurfaceCard>

          {/* User tags — editable */}
          <SurfaceCard>
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/30">
              <Tag className="h-3 w-3" />
              手动标签
            </p>
            <div className="flex flex-wrap gap-1.5">
              {asset.user_tags.map((t) => (
                <span
                  key={t}
                  className="group flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/60"
                >
                  {t}
                  <button
                    onClick={() => removeTag(t)}
                    className="text-white/20 hover:text-red-300 transition-colors"
                    aria-label={`删除标签 ${t}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              {asset.user_tags.length === 0 && (
                <span className="text-xs text-white/20">暂无手动标签</span>
              )}
            </div>
            <form onSubmit={addTag} className="mt-3 flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="添加标签…"
                className="flex-1 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/25 outline-none focus:ring-1 focus:ring-violet-500/50"
              />
              <button
                type="submit"
                disabled={!tagInput.trim() || tagPending}
                className="flex items-center gap-1 rounded-lg bg-violet-500/20 px-2.5 py-1.5 text-xs text-violet-300 hover:bg-violet-500/30 disabled:opacity-40 transition-colors"
              >
                {tagPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                添加
              </button>
            </form>
          </SurfaceCard>

          {/* Storage key */}
          <SurfaceCard>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">存储路径</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] text-white/35">
                {asset.storage_key}
              </code>
              <button
                onClick={copyStorageKey}
                className="shrink-0 rounded-lg p-1.5 hover:bg-white/[0.06] transition-colors"
                title="复制"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-white/30" />}
              </button>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
