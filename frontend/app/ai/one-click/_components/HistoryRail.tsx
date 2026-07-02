"use client";

import { Loader2 } from "lucide-react";
import type { PipelineRun } from "../../../../lib/api/pipeline";
import { platformLabel } from "../../../../lib/platforms";

interface HistoryRailProps {
  runs: PipelineRun[];
  loading: boolean;
  activeId: number | null;
  onSelect: (id: number) => void;
}

function statusDotColor(status: number): string {
  switch (status) {
    case 0:
      return "var(--accent)";
    case 1:
      return "var(--good)";
    case 2:
      return "var(--bad)";
    default:
      return "var(--ink-faint)";
  }
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${month}/${day} ${hours}:${mins}`;
  } catch {
    return ts;
  }
}

export function HistoryRail({ runs, loading, activeId, onSelect }: HistoryRailProps) {
  return (
    <aside
      className="flex w-[260px] shrink-0 flex-col"
      style={{
        borderRight: "1px solid var(--line)",
        background: "var(--surface-0)",
      }}
    >
      <div
        className="flex flex-col gap-1 px-5 py-5"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span className="eyebrow">PIPELINE · HISTORY</span>
        <h2
          className="font-display"
          style={{ fontSize: 18, color: "var(--ink-hi)", fontWeight: 600 }}
        >
          生产记录
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--ink-lo)" }} />
          </div>
        )}

        {!loading && runs.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="eyebrow mb-2">EMPTY</p>
            <p style={{ color: "var(--ink-lo)", fontSize: 12 }}>
              暂无生产记录,
              <br />
              从右侧创建首个任务。
            </p>
          </div>
        )}

        {runs.map((run) => {
          const isActive = run.id === activeId;
          const dotColor = statusDotColor(run.status);
          const isRunning = run.status === 0;
          const progress = Math.min(
            100,
            Math.max(4, (run.completed_clips / Math.max(1, run.clip_count)) * 100),
          );

          return (
            <button
              key={run.id}
              onClick={() => onSelect(run.id)}
              className="group relative flex w-full flex-col gap-1.5 px-5 py-3.5 text-left transition-colors"
              style={{
                borderBottom: "1px solid var(--line-lo)",
                background: isActive ? "var(--accent-soft)" : "transparent",
              }}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-0 h-full"
                  style={{ width: 2, background: "var(--accent)" }}
                />
              )}

              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    background: dotColor,
                    boxShadow: isRunning ? `0 0 8px ${dotColor}` : "none",
                    animation: isRunning ? "pulse-glow 1.6s ease-in-out infinite" : "none",
                  }}
                />
                <span
                  className="font-mono"
                  style={{ fontSize: 10.5, color: "var(--ink-lo)" }}
                >
                  #{run.id}
                </span>
                <span
                  className="ml-auto font-mono"
                  style={{ fontSize: 10.5, color: "var(--ink-faint)" }}
                >
                  {formatTs(run.created_at)}
                </span>
              </div>

              <p
                className="truncate"
                style={{
                  fontSize: 13.5,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "var(--ink-hi)" : "var(--ink)",
                  letterSpacing: "-0.005em",
                }}
              >
                {run.product_name}
              </p>

              <p
                className="truncate"
                style={{ fontSize: 10.5, color: "var(--ink-lo)" }}
              >
                {platformLabel(run.platform)} · {run.style} · {run.clip_count}clip
              </p>

              {isRunning && (
                <div
                  className="mt-1 overflow-hidden rounded-full"
                  style={{ height: 3, background: "var(--line)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progress}%`,
                      background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%)",
                    }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
