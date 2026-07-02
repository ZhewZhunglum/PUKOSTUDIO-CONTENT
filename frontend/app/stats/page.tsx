"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart2, Database, Cpu, Film, Tag, FolderOpen,
  HardDrive, Zap, TrendingUp, Clock,
} from "lucide-react";
import {
  getOverview, getCosts, getActivity, getStorage,
  type ActivityCall,
} from "../../lib/api/stats";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusPill } from "../../components/ui/StatusPill";
import { IconTile } from "../../components/ui/IconTile";

const ASSET_TYPE_CN: Record<number, string> = {
  1: "图片", 2: "视频", 3: "音频", 4: "字幕", 10: "输出",
};
const TASK_STATUS_CN: Record<number, { label: string; variant: "neutral"|"blue"|"green"|"red"|"amber" }> = {
  0: { label: "待执行", variant: "neutral" },
  1: { label: "执行中", variant: "blue" },
  2: { label: "完成",   variant: "green" },
  3: { label: "失败",   variant: "red" },
  4: { label: "重试",   variant: "amber" },
};
const PROVIDER_COLOR: Record<string, "violet"|"amber"|"blue"|"green"> = {
  anthropic: "violet",
  openai: "amber",
  replicate: "blue",
  together: "green",
};

function MetricCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: "violet"|"amber"|"green"|"blue";
}) {
  return (
    <SurfaceCard className="flex items-start gap-4">
      <IconTile icon={icon} color={color ?? "violet"} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/40">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-white/90">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-white/30">{sub}</p>}
      </div>
    </SurfaceCard>
  );
}

function ProviderBar({ name, cost, total }: { name: string; cost: number; total: number }) {
  const pct = total > 0 ? (cost / total) * 100 : 0;
  const color = PROVIDER_COLOR[name.toLowerCase()] ?? "neutral";
  const barColor = color === "violet" ? "bg-violet-500" : color === "amber" ? "bg-amber-500" : color === "blue" ? "bg-blue-500" : "bg-green-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60 capitalize">{name}</span>
        <span className="tabular-nums text-white/50">${cost.toFixed(4)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct.toFixed(1)}%` }} />
      </div>
    </div>
  );
}

function CallRow({ call }: { call: ActivityCall }) {
  return (
    <div className="flex items-center gap-3 py-2 text-xs">
      <StatusPill label={call.provider} variant={PROVIDER_COLOR[call.provider.toLowerCase()] ?? "neutral"} />
      <span className="flex-1 truncate text-white/50">{call.capability} · {call.model}</span>
      <span className="tabular-nums text-white/35">{call.latency_ms}ms</span>
      <span className="tabular-nums text-white/35">${call.cost_usd.toFixed(4)}</span>
    </div>
  );
}

export default function StatsPage() {
  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ["stats-overview"], queryFn: getOverview, retry: 1,
  });
  const { data: costs } = useQuery({
    queryKey: ["stats-costs"], queryFn: () => getCosts(30), retry: 1,
  });
  const { data: activity } = useQuery({
    queryKey: ["stats-activity"], queryFn: getActivity, retry: 1,
  });
  const { data: storage } = useQuery({
    queryKey: ["stats-storage"], queryFn: getStorage, retry: 1,
  });

  const totalCost = costs?.total_cost_usd ?? overview?.ai_calls.total_cost_usd ?? 0;
  const storageGb = storage?.total_gb?.toFixed(2) ?? "—";

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={<BarChart2 size={18} />}
        title="数据看板"
        subtitle="系统运行统计"
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          icon={<Database size={16} />}
          label="素材总数"
          value={ovLoading ? "…" : (overview?.assets.total ?? 0)}
          color="violet"
        />
        <MetricCard
          icon={<Tag size={16} />}
          label="标签"
          value={overview?.tags.total ?? "—"}
          sub={`${overview?.collections.total ?? "—"} 个集合`}
          color="blue"
        />
        <MetricCard
          icon={<Cpu size={16} />}
          label="AI 调用"
          value={overview?.ai_calls.total ?? "—"}
          sub={`累计 $${totalCost.toFixed(3)}`}
          color="amber"
        />
        <MetricCard
          icon={<HardDrive size={16} />}
          label="存储"
          value={`${storageGb} GB`}
          color="green"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Asset breakdown */}
        <SurfaceCard>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">
            素材类型分布
          </p>
          {overview?.assets.by_type && Object.keys(overview.assets.by_type).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(overview.assets.by_type).map(([typeStr, count]) => {
                const total = overview.assets.total || 1;
                const pct = ((count as number) / total * 100).toFixed(0);
                return (
                  <div key={typeStr} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">
                        {ASSET_TYPE_CN[Number(typeStr)] ?? `类型 ${typeStr}`}
                      </span>
                      <span className="tabular-nums text-white/40">{count as number} · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-violet-500/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/25">暂无数据</p>
          )}
        </SurfaceCard>

        {/* AI cost by provider */}
        <SurfaceCard>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">
            AI 费用（近 30 天）
          </p>
          {costs?.by_provider && Object.keys(costs.by_provider).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(costs.by_provider).map(([name, data]) => (
                <ProviderBar key={name} name={name} cost={data.total_cost} total={totalCost} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/25">暂无 AI 调用记录</p>
          )}
        </SurfaceCard>
      </div>

      {/* Task queue */}
      {overview?.tasks.by_status && Object.keys(overview.tasks.by_status).length > 0 && (
        <SurfaceCard>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">
            任务队列
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(overview.tasks.by_status).map(([status, count]) => {
              const meta = TASK_STATUS_CN[Number(status)] ?? { label: status, variant: "neutral" as const };
              return (
                <div key={status} className="flex items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2">
                  <StatusPill label={meta.label} variant={meta.variant} />
                  <span className="text-sm font-semibold tabular-nums text-white/70">{count as number}</span>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* Storage breakdown */}
      {storage?.by_type && storage.by_type.length > 0 && (
        <SurfaceCard>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/30">
            存储分布
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {storage.by_type.map((row) => (
              <div key={row.asset_type} className="rounded-xl border border-white/[0.06] p-3">
                <p className="text-xs text-white/40">
                  {ASSET_TYPE_CN[row.asset_type] ?? `类型 ${row.asset_type}`}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white/80">
                  {(row.bytes / 1024 / 1024 / 1024).toFixed(2)} GB
                </p>
                <p className="mt-0.5 text-[10px] text-white/30">{row.count} 个文件</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* Recent AI calls */}
      {activity?.ai_calls && activity.ai_calls.length > 0 && (
        <SurfaceCard>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/30">
            最近 AI 调用
          </p>
          <div className="divide-y divide-white/[0.04]">
            {activity.ai_calls.slice(0, 10).map((call) => (
              <CallRow key={call.id} call={call} />
            ))}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
