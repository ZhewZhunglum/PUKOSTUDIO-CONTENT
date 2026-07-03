"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Film, Plus, ExternalLink, Trash2, TrendingUp,
  Eye, MousePointer, Play, ChevronRight,
  DollarSign, BarChart2, X, Check, Loader2,
} from "lucide-react";
import {
  listProductions,
  createProduction,
  updateProduction,
  deleteProduction,
  createAdPerformance,
  deleteAdPerformance,
  type Production,
  type AdPerformanceCreate,
} from "../../lib/api/productions";
import {
  getImportUrlStatus,
  importFromUrl,
  searchAssets,
  type ImportUrlStatus,
} from "../../lib/api/assets";
import type { AssetListItem } from "../../lib/types/asset";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { cn } from "../../lib/utils";
import { SOCIAL_PLATFORMS, platformLabel } from "../../lib/platforms";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = SOCIAL_PLATFORMS;

const STATUS_MAP = {
  0: { label: "草稿", color: "text-white/40 bg-white/[0.06]" },
  1: { label: "已发布", color: "text-emerald-300 bg-emerald-500/10" },
  2: { label: "已归档", color: "text-white/25 bg-white/[0.04]" },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | string | null | undefined, decimals = 0): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "—";
  return num.toLocaleString("zh-CN", { maximumFractionDigits: decimals });
}

function fmtRate(n: string | null | undefined): string {
  if (n == null) return "—";
  const num = parseFloat(n);
  if (isNaN(num)) return "—";
  return `${num.toFixed(2)}%`;
}

function durationLabel(ms: number | null | undefined): string {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}:${String(rem).padStart(2, "0")}` : `${rem}s`;
}

// ── Ad Form ───────────────────────────────────────────────────────────────────

const emptyAd: AdPerformanceCreate = {
  platform: "", campaign_name: "",
  date_start: "", date_end: "",
  spend: "", currency: "CNY",
  impressions: undefined, clicks: undefined, plays: undefined,
  ctr: "", completion_rate: "",
  likes: undefined, comments: undefined, shares: undefined,
  conversions: undefined, revenue: "", roas: "",
};

function AdForm({
  productionId,
  onSuccess,
  onCancel,
}: {
  productionId: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AdPerformanceCreate>({ ...emptyAd });
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => {
      const payload: AdPerformanceCreate = {
        ...form,
        impressions: form.impressions || undefined,
        clicks: form.clicks || undefined,
        plays: form.plays || undefined,
        conversions: form.conversions || undefined,
        likes: form.likes || undefined,
        comments: form.comments || undefined,
        shares: form.shares || undefined,
        spend: form.spend || undefined,
        revenue: form.revenue || undefined,
        roas: form.roas || undefined,
        ctr: form.ctr || undefined,
        completion_rate: form.completion_rate || undefined,
        date_start: form.date_start || undefined,
        date_end: form.date_end || undefined,
        platform: form.platform || undefined,
        campaign_name: form.campaign_name || undefined,
      };
      return createAdPerformance(productionId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productions"] });
      onSuccess();
    },
  });

  const field = (
    label: string,
    key: keyof AdPerformanceCreate,
    type = "text",
    placeholder = ""
  ) => (
    <div>
      <label className="mb-1 block text-[11px] text-white/30">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={(form[key] as string | number | undefined) ?? ""}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            [key]: type === "number" ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value,
          }))
        }
        className="h-8 w-full rounded-lg bg-white/[0.05] px-2.5 text-xs text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/40"
      />
    </div>
  );

  return (
    <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">
        新增投放数据
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-white/30">平台</label>
          <select
            value={form.platform ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
            className="h-8 w-full rounded-lg bg-white/[0.05] px-2.5 text-xs text-white/80 outline-none focus:ring-1 focus:ring-violet-500/40"
          >
            <option value="">选择平台</option>
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        {field("广告系列名称", "campaign_name", "text", "Campaign name")}
        {field("开始日期", "date_start", "date")}
        {field("结束日期", "date_end", "date")}
        {field("消耗 (CNY)", "spend", "text", "0.00")}
        {field("ROAS", "roas", "text", "0.00")}
        {field("曝光量", "impressions", "number", "0")}
        {field("点击量", "clicks", "number", "0")}
        {field("播放量", "plays", "number", "0")}
        {field("CTR (%)", "ctr", "text", "0.00")}
        {field("完播率 (%)", "completion_rate", "text", "0.00")}
        {field("转化量", "conversions", "number", "0")}
        {field("点赞", "likes", "number", "0")}
        {field("评论", "comments", "number", "0")}
        {field("分享", "shares", "number", "0")}
        {field("收入 (CNY)", "revenue", "text", "0.00")}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          取消
        </button>
        <button
          disabled={mut.isPending}
          onClick={() => mut.mutate()}
          className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {mut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          保存
        </button>
      </div>
    </div>
  );
}

// ── AdRow ─────────────────────────────────────────────────────────────────────

function AdRow({
  ad,
  productionId,
}: {
  ad: Production["ad_performances"][0];
  productionId: number;
}) {
  const qc = useQueryClient();
  const delMut = useMutation({
    mutationFn: () => deleteAdPerformance(productionId, ad.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["productions"] }),
  });

  const platLabel = PLATFORMS.find((p) => p.value === ad.platform)?.label ?? ad.platform ?? "—";

  return (
    <div className="group relative rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300">
          {platLabel}
        </span>
        {ad.campaign_name && (
          <span className="text-[11px] text-white/50">{ad.campaign_name}</span>
        )}
        {(ad.date_start || ad.date_end) && (
          <span className="ml-auto text-[10px] text-white/25">
            {ad.date_start ?? ""} ~ {ad.date_end ?? ""}
          </span>
        )}
        <button
          onClick={() => delMut.mutate()}
          className="ml-2 opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all"
          aria-label="删除"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-[11px]">
        <Metric label="消耗" value={`¥${fmt(ad.spend, 2)}`} />
        <Metric label="ROAS" value={fmt(ad.roas, 2)} />
        <Metric label="曝光" value={fmt(ad.impressions)} />
        <Metric label="播放" value={fmt(ad.plays)} />
        <Metric label="点击" value={fmt(ad.clicks)} />
        <Metric label="CTR" value={fmtRate(ad.ctr)} />
        <Metric label="完播率" value={fmtRate(ad.completion_rate)} />
        <Metric label="转化" value={fmt(ad.conversions)} />
        <Metric label="点赞" value={fmt(ad.likes)} />
        <Metric label="评论" value={fmt(ad.comments)} />
        <Metric label="分享" value={fmt(ad.shares)} />
        <Metric label="收入" value={`¥${fmt(ad.revenue, 2)}`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-white/25">{label}</p>
      <p className="font-medium text-white/80">{value}</p>
    </div>
  );
}

// ── ProductionCard ────────────────────────────────────────────────────────────

function ProductionCard({
  prod,
  selected,
  onClick,
}: {
  prod: Production;
  selected: boolean;
  onClick: () => void;
}) {
  const statusCfg = STATUS_MAP[prod.status as 0 | 1 | 2] ?? STATUS_MAP[0];
  const platLabel = platformLabel(prod.platform);

  const totalSpend = prod.ad_performances.reduce(
    (s, a) => s + (a.spend ? parseFloat(a.spend) : 0),
    0
  );
  const totalPlays = prod.ad_performances.reduce(
    (s, a) => s + (a.plays ?? 0),
    0
  );

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full text-left rounded-xl border transition-colors",
        selected
          ? "border-violet-500/30 bg-violet-500/[0.06]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.04]"
      )}
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="relative h-[60px] w-[100px] shrink-0 overflow-hidden rounded-lg bg-white/[0.04]">
          {prod.asset_thumbnail_url ? (
            <img
              src={prod.asset_thumbnail_url}
              alt={prod.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Film className="h-5 w-5 text-white/15" />
            </div>
          )}
          {prod.asset_duration_ms && (
            <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white/70">
              {durationLabel(prod.asset_duration_ms)}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="flex items-start gap-2">
            <p className="flex-1 truncate text-sm font-medium text-white/80">{prod.title}</p>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", statusCfg.color)}>
              {statusCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/30">
            {prod.platform && <span>{platLabel}</span>}
            {prod.asset_name && <span className="truncate">· {prod.asset_name}</span>}
          </div>
          {prod.ad_performances.length > 0 && (
            <div className="mt-1 flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-white/40">
                <DollarSign className="h-3 w-3" />
                ¥{fmt(totalSpend, 0)}
              </span>
              <span className="flex items-center gap-1 text-white/40">
                <Play className="h-3 w-3" />
                {fmt(totalPlays)}
              </span>
              <span className="text-white/25">{prod.ad_performances.length} 条投放</span>
            </div>
          )}
        </div>

        <ChevronRight className={cn(
          "mt-1 h-4 w-4 shrink-0 transition-colors",
          selected ? "text-violet-400" : "text-white/15 group-hover:text-white/30"
        )} />
      </div>
    </button>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  prod,
  onClose,
}: {
  prod: Production;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [showAdForm, setShowAdForm] = useState(false);
  const statusCfg = STATUS_MAP[prod.status as 0 | 1 | 2] ?? STATUS_MAP[0];

  const delProd = useMutation({
    mutationFn: () => deleteProduction(prod.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productions"] });
      onClose();
    },
  });

  const publishMut = useMutation({
    mutationFn: () =>
      updateProduction(prod.id, {
        status: prod.status === 1 ? 0 : 1,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["productions"] }),
  });

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] xl:max-h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-white/90">{prod.title}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", statusCfg.color)}>
              {statusCfg.label}
            </span>
            {prod.platform && (
              <span className="text-[11px] text-white/30">
                {platformLabel(prod.platform)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-white/25 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Video preview */}
        {prod.asset_preview_url && (
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black">
            <video
              src={prod.asset_preview_url}
              poster={prod.asset_thumbnail_url ?? undefined}
              controls
              className="w-full max-h-[200px] object-contain"
            />
          </div>
        )}

        {/* Meta */}
        <SurfaceCard className="space-y-2 text-[13px]">
          {prod.description && (
            <p className="text-white/50">{prod.description}</p>
          )}
          {prod.platform_url && (
            <a
              href={prod.platform_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {prod.platform_url}
            </a>
          )}
          {prod.published_at && (
            <p className="text-white/30 text-xs">
              发布时间：{new Date(prod.published_at).toLocaleDateString("zh-CN")}
            </p>
          )}
          {prod.notes && (
            <p className="text-white/40 text-xs italic">{prod.notes}</p>
          )}
        </SurfaceCard>

        {/* Ad Performance Section */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30">
              广告投放数据 · {prod.ad_performances.length} 条
            </h3>
            <button
              onClick={() => setShowAdForm((v) => !v)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-violet-400 hover:bg-violet-500/10 transition-colors"
            >
              <Plus className="h-3 w-3" />
              新增
            </button>
          </div>

          {showAdForm && (
            <AdForm
              productionId={prod.id}
              onSuccess={() => setShowAdForm(false)}
              onCancel={() => setShowAdForm(false)}
            />
          )}

          {prod.ad_performances.length === 0 && !showAdForm ? (
            <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-xs text-white/25">
              暂无投放数据，点击新增
            </div>
          ) : (
            <div className="space-y-2">
              {prod.ad_performances.map((ad) => (
                <AdRow key={ad.id} ad={ad} productionId={prod.id} />
              ))}
            </div>
          )}
        </div>

        {/* Totals summary */}
        {prod.ad_performances.length > 0 && (
          <SurfaceCard>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">汇总</p>
            <div className="grid grid-cols-3 gap-3">
              <SummaryCell
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="总消耗"
                value={`¥${fmt(
                  prod.ad_performances.reduce((s, a) => s + (a.spend ? parseFloat(a.spend) : 0), 0),
                  2
                )}`}
              />
              <SummaryCell
                icon={<Play className="h-3.5 w-3.5" />}
                label="总播放"
                value={fmt(prod.ad_performances.reduce((s, a) => s + (a.plays ?? 0), 0))}
              />
              <SummaryCell
                icon={<MousePointer className="h-3.5 w-3.5" />}
                label="总点击"
                value={fmt(prod.ad_performances.reduce((s, a) => s + (a.clicks ?? 0), 0))}
              />
              <SummaryCell
                icon={<Eye className="h-3.5 w-3.5" />}
                label="总曝光"
                value={fmt(prod.ad_performances.reduce((s, a) => s + (a.impressions ?? 0), 0))}
              />
              <SummaryCell
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="总转化"
                value={fmt(prod.ad_performances.reduce((s, a) => s + (a.conversions ?? 0), 0))}
              />
              <SummaryCell
                icon={<BarChart2 className="h-3.5 w-3.5" />}
                label="总收入"
                value={`¥${fmt(
                  prod.ad_performances.reduce((s, a) => s + (a.revenue ? parseFloat(a.revenue) : 0), 0),
                  2
                )}`}
              />
            </div>
          </SurfaceCard>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex gap-2">
        <button
          onClick={() => publishMut.mutate()}
          disabled={publishMut.isPending}
          className={cn(
            "flex-1 rounded-xl py-2 text-sm font-medium transition-opacity disabled:opacity-40",
            prod.status === 1
              ? "bg-white/[0.06] text-white/60 hover:bg-white/[0.10]"
              : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
          )}
        >
          {prod.status === 1 ? "取消发布" : "标记为已发布"}
        </button>
        <button
          onClick={() => delProd.mutate()}
          disabled={delProd.isPending}
          className="rounded-xl px-3 py-2 text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-40"
          aria-label="删除"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

function SummaryCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-white/25">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <p className="text-sm font-semibold text-white/80">{value}</p>
    </div>
  );
}

// ── Create Dialog ─────────────────────────────────────────────────────────────

async function waitForImportedAsset(taskId: number): Promise<ImportUrlStatus> {
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const status = await getImportUrlStatus(taskId);
    if (status.status === "done") return status;
    if (status.status === "failed") {
      throw new Error(status.error || "在线视频下载失败");
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error("在线视频下载超时，请稍后在上传页查看导入队列");
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [sourceMode, setSourceMode] = useState<"library" | "url">("library");
  const [assetQuery, setAssetQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetListItem | null>(null);
  const [onlineUrl, setOnlineUrl] = useState("");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [platformUrl, setPlatformUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [progressText, setProgressText] = useState("");

  const { data: assetResults, isFetching: loadingAssets } = useQuery({
    queryKey: ["production-asset-search", assetQuery],
    queryFn: () =>
      searchAssets({
        query: assetQuery.trim() || undefined,
        filters: { asset_type: [2, 10] },
        sort: "recency",
        limit: 24,
      }),
  });

  const assets = assetResults?.items ?? [];
  const hasLibraryAsset = sourceMode === "library" && selectedAsset !== null;
  const hasOnlineUrl = sourceMode === "url" && onlineUrl.trim().length > 0;

  const mut = useMutation({
    mutationFn: async () => {
      let assetId = selectedAsset?.id;
      let urlForPlatform = platformUrl.trim() || undefined;

      if (sourceMode === "url") {
        setProgressText("正在提交在线视频下载任务…");
        const task = await importFromUrl({
          url: onlineUrl.trim(),
          name: title.trim(),
          tags: ["成片", "在线下载"],
        });
        if (task.status === "existing" && task.asset_id) {
          assetId = task.asset_id;
        } else {
          if (!task.task_id) {
            throw new Error("下载任务创建失败");
          }
          setProgressText("正在下载在线视频并写入素材库…");
          const imported = await waitForImportedAsset(task.task_id);
          if (!imported.asset_id) {
            throw new Error("在线视频已导入但没有返回 Asset ID");
          }
          assetId = imported.asset_id;
        }
        urlForPlatform = urlForPlatform || onlineUrl.trim();
      }

      if (!assetId) {
        throw new Error("请选择一个视频/成片素材，或粘贴在线公开视频链接");
      }

      setProgressText("正在创建成片记录…");
      return createProduction({
        asset_id: assetId,
        title: title.trim(),
        platform: platform || undefined,
        platform_url: urlForPlatform,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : undefined,
        status: publishedAt ? 1 : 0,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productions"] });
      onClose();
    },
    onSettled: () => setProgressText(""),
  });

  const canCreate = Boolean(title.trim()) && (hasLibraryAsset || hasOnlineUrl) && !mut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <SurfaceCard raised className="max-h-[88vh] w-[560px] space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">新建成片记录</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="标题">
            <input
              autoFocus
              placeholder="视频标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/40"
            />
          </Field>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/40">视频来源</label>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
              {[
                { value: "library", label: "从素材库选择" },
                { value: "url", label: "下载在线视频" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSourceMode(item.value as "library" | "url")}
                  className={cn(
                    "rounded-lg py-2 text-xs font-medium transition-colors",
                    sourceMode === item.value
                      ? "bg-violet-500/25 text-violet-200"
                      : "text-white/35 hover:bg-white/[0.05] hover:text-white/60"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {sourceMode === "library" ? (
            <Field label="选择视频 / 成片 Asset">
              <input
                placeholder="搜索标题、文件名、标签…"
                value={assetQuery}
                onChange={(e) => setAssetQuery(e.target.value)}
                className="h-9 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/40"
              />
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                {loadingAssets && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-white/30">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    加载素材…
                  </div>
                )}
                {!loadingAssets && assets.length === 0 && (
                  <p className="px-3 py-2 text-xs text-white/25">
                    暂无视频/成片素材，可切换到“下载在线视频”。
                  </p>
                )}
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      setSelectedAsset(asset);
                      if (!title.trim()) setTitle(asset.name);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors",
                      selectedAsset?.id === asset.id
                        ? "bg-violet-500/20 text-violet-100"
                        : "text-white/55 hover:bg-white/[0.05] hover:text-white/80"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{asset.name}</span>
                      <span className="text-[10px] text-white/25">Asset #{asset.id}</span>
                    </span>
                    {selectedAsset?.id === asset.id && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </Field>
          ) : (
            <Field label="在线视频链接">
              <input
                type="url"
                placeholder="https://www.tiktok.com/… 或 https://youtu.be/…"
                value={onlineUrl}
                onChange={(e) => setOnlineUrl(e.target.value)}
                className="h-9 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/40"
              />
              <p className="mt-1 text-[11px] text-white/25">
                支持 TikTok、YouTube、Instagram、Facebook、X、Reddit、Twitch 等公开视频和直链。
              </p>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="发布平台">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="h-9 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white/80 outline-none focus:ring-1 focus:ring-violet-500/40"
              >
                <option value="">选择平台</option>
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="发布时间">
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="h-9 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white/80 outline-none focus:ring-1 focus:ring-violet-500/40"
              />
            </Field>
          </div>

          <Field label="平台链接">
            <input
              type="url"
              placeholder="https://…"
              value={platformUrl}
              onChange={(e) => setPlatformUrl(e.target.value)}
              className="h-9 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/40"
            />
          </Field>
        </div>

        {mut.isError && (
          <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {mut.error instanceof Error ? mut.error.message : "创建失败，请检查视频来源"}
          </p>
        )}

        {progressText && (
          <p className="flex items-center gap-2 rounded-xl bg-blue-500/10 px-3 py-2 text-sm text-blue-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {progressText}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            取消
          </button>
          <button
            disabled={!canCreate}
            onClick={() => mut.mutate()}
            className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            创建
          </button>
        </div>
      </SurfaceCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/40">{label}</label>
      {children}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: undefined, label: "全部" },
  { value: 0, label: "草稿" },
  { value: 1, label: "已发布" },
  { value: 2, label: "已归档" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductionsPage() {
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [platformFilter, setPlatformFilter] = useState<string | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["productions", statusFilter, platformFilter],
    queryFn: () =>
      listProductions({
        status: statusFilter,
        platform: platformFilter,
        limit: 100,
      }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const selectedProd = items.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col gap-5 overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
        <SectionHeader
          icon={<Film className="h-4 w-4" />}
          title="成片库"
          subtitle={`${total} 个成片记录`}
          actions={
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              新建成片
            </button>
          }
        />

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={String(f.value)}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "h-7 rounded-lg px-3 text-xs transition-colors",
                  statusFilter === f.value
                    ? "bg-violet-500/20 text-violet-300"
                    : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
            <button
              onClick={() => setPlatformFilter(undefined)}
              className={cn(
                "h-7 rounded-lg px-3 text-xs transition-colors",
                !platformFilter
                  ? "bg-violet-500/20 text-violet-300"
                  : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60"
              )}
            >
              全平台
            </button>
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPlatformFilter(p.value)}
                className={cn(
                  "h-7 rounded-lg px-3 text-xs transition-colors",
                  platformFilter === p.value
                    ? "bg-violet-500/20 text-violet-300"
                    : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* List */}
        <div className="min-w-0 overflow-y-auto rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white/25" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center gap-4 text-white/20">
              <Film className="h-12 w-12 opacity-20" />
              <p className="text-sm">暂无成片记录</p>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2 text-xs text-white/30 hover:border-white/[0.16] hover:text-white/50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                新建第一个成片
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((prod) => (
                <ProductionCard
                  key={prod.id}
                  prod={prod}
                  selected={prod.id === selectedId}
                  onClick={() =>
                    setSelectedId(prod.id === selectedId ? null : prod.id)
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedProd ? (
          <DetailPanel
            prod={selectedProd}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="hidden min-h-0 items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] text-sm text-white/24 xl:flex">
            选择一个成片查看详情和投放数据
          </div>
        )}
      </div>

      {showCreate && <CreateDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}
