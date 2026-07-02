"use client";

import {
  Clock,
  FileText,
  FolderOpen,
  Sparkles,
  Film,
  CheckCircle2,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { PipelineRun } from "../../../../lib/api/pipeline";
import { platformLabel } from "../../../../lib/platforms";
import { STAGE_ORDER, STAGE_META, activeStageIndex, type StageKey } from "./types";

const STAGE_ICON: Record<StageKey, LucideIcon> = {
  queued: Clock,
  script: FileText,
  project: FolderOpen,
  generating: Sparkles,
  compose: Film,
  done: CheckCircle2,
};

interface ActiveHeaderProps {
  run: PipelineRun;
}

function statusPill(run: PipelineRun) {
  if (run.status === 1) {
    return {
      label: "已完成",
      color: "var(--good)",
      Icon: CheckCircle2,
      spin: false,
    };
  }
  if (run.status === 2) {
    return {
      label: "失败",
      color: "var(--bad)",
      Icon: XCircle,
      spin: false,
    };
  }
  return {
    label: "进行中",
    color: "var(--accent)",
    Icon: Loader2,
    spin: true,
  };
}

export function ActiveHeader({ run }: ActiveHeaderProps) {
  const idx = activeStageIndex(run);
  const pill = statusPill(run);
  const PillIcon = pill.Icon;

  return (
    <section
      className="relative overflow-hidden"
      style={{
        borderBottom: "1px solid var(--line)",
        background:
          "linear-gradient(180deg, oklch(11% 0.022 295) 0%, var(--surface-0) 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          right: -120,
          top: -100,
          width: 280,
          height: 280,
          background:
            "radial-gradient(circle, var(--accent-soft), transparent 60%)",
        }}
      />

      <div className="relative px-8 pt-7 pb-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="eyebrow">RUN · #{String(run.id).padStart(4, "0")}</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono"
            style={{
              fontSize: 10.5,
              color: pill.color,
              background: "oklch(100% 0 0 / 0.04)",
              border: `1px solid ${pill.color}`,
              borderColor: pill.color,
              letterSpacing: "0.06em",
            }}
          >
            <PillIcon
              className={pill.spin ? "animate-spin" : ""}
              style={{ width: 11, height: 11 }}
            />
            {pill.label}
          </span>
        </div>

        <h1
          className="font-display mb-3"
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "var(--ink-hi)",
            letterSpacing: "-0.025em",
            lineHeight: 1.15,
          }}
        >
          {run.product_name}
        </h1>

        <div
          className="mb-7 flex flex-wrap items-center gap-x-5 gap-y-1"
          style={{ fontSize: 12, color: "var(--ink-mid)" }}
        >
          <MetaItem label="平台" value={platformLabel(run.platform)} />
          <MetaItem label="风格" value={run.style} />
          <MetaItem label="时长" value={`${run.duration_seconds}s`} />
          <MetaItem
            label="片段"
            value={`${run.completed_clips}/${run.clip_count}`}
          />
        </div>

        <StagePipeline activeIndex={idx} failed={run.status === 2} />
      </div>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="font-mono uppercase"
        style={{ fontSize: 10, color: "var(--ink-lo)", letterSpacing: "0.16em" }}
      >
        {label}
      </span>
      <span style={{ color: "var(--ink-hi)", fontWeight: 500 }}>{value}</span>
    </span>
  );
}

function StagePipeline({
  activeIndex,
  failed,
}: {
  activeIndex: number;
  failed: boolean;
}) {
  return (
    <div className="flex items-start">
      {STAGE_ORDER.map((stage, i) => {
        const isDone = i < activeIndex || activeIndex === STAGE_ORDER.length - 1;
        const isActive = i === activeIndex && !failed;
        const Icon = STAGE_ICON[stage];

        return (
          <div key={stage} className="flex flex-1 items-start">
            <div className="flex flex-col items-center" style={{ minWidth: 64 }}>
              <div className="relative flex h-7 w-7 items-center justify-center">
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full"
                    style={{
                      border: "1px solid var(--accent)",
                      animation: "pulse-glow 1.8s ease-in-out infinite",
                    }}
                  />
                )}
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{
                    background: isDone
                      ? "var(--accent)"
                      : isActive
                        ? "var(--accent-soft)"
                        : "var(--surface-2)",
                    border: isActive
                      ? "1px solid var(--accent)"
                      : "1px solid var(--line)",
                    color: isDone
                      ? "oklch(15% 0.02 295)"
                      : isActive
                        ? "var(--accent)"
                        : "var(--ink-lo)",
                  }}
                >
                  <Icon style={{ width: 13, height: 13 }} strokeWidth={2.2} />
                </div>
              </div>
              <span
                className="mt-2 text-center"
                style={{
                  fontSize: 10.5,
                  color: isDone || isActive ? "var(--ink)" : "var(--ink-lo)",
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: "-0.005em",
                }}
              >
                {STAGE_META[stage].label}
              </span>
            </div>
            {i < STAGE_ORDER.length - 1 && (
              <div
                className="mt-3.5 flex-1"
                style={{
                  height: 1,
                  background: i < activeIndex ? "var(--accent)" : "var(--line)",
                  opacity: i < activeIndex ? 0.6 : 1,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
