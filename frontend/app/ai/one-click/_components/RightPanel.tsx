"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PipelineRun } from "../../../../lib/api/pipeline";
import { platformLabel } from "../../../../lib/platforms";
import { BriefPanel, type BriefFormState } from "./BriefPanel";
import { STAGE_META, mapServerStage } from "./types";

type TabKey = "brief" | "log" | "diag";

interface RightPanelProps {
  formState: BriefFormState;
  onFormChange: (patch: Partial<BriefFormState>) => void;
  onSubmit: () => void;
  isPending: boolean;
  submitError: string | null;
  activeRun: PipelineRun | null;
}

export function RightPanel(props: RightPanelProps) {
  const [tab, setTab] = useState<TabKey>("brief");

  return (
    <aside
      className="flex w-[360px] shrink-0 flex-col"
      style={{
        borderLeft: "1px solid var(--line)",
        background: "var(--surface-0)",
      }}
    >
      <TabBar tab={tab} setTab={setTab} />
      <div className="flex-1 overflow-y-auto">
        {tab === "brief" && (
          <BriefPanel
            state={props.formState}
            onChange={props.onFormChange}
            onSubmit={props.onSubmit}
            isPending={props.isPending}
            error={props.submitError}
          />
        )}
        {tab === "log" && <LogPanel run={props.activeRun} />}
        {tab === "diag" && <DiagPanel run={props.activeRun} />}
      </div>
    </aside>
  );
}

function TabBar({ tab, setTab }: { tab: TabKey; setTab: (t: TabKey) => void }) {
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "brief", label: "新建任务" },
    { key: "log", label: "实时日志" },
    { key: "diag", label: "诊断" },
  ];
  return (
    <div
      className="flex items-stretch"
      style={{ borderBottom: "1px solid var(--line)" }}
    >
      {tabs.map((t) => {
        const isActive = t.key === tab;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="relative flex-1 px-3 py-3.5 transition-colors"
            style={{
              fontSize: 12.5,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--ink-hi)" : "var(--ink-lo)",
              letterSpacing: "-0.005em",
            }}
          >
            {t.label}
            {isActive && (
              <span
                aria-hidden
                className="absolute bottom-0 left-0 right-0"
                style={{ height: 1.5, background: "var(--accent)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface LogLine {
  ts: string;
  level: "info" | "ok" | "warn" | "err";
  msg: string;
}

function buildLog(run: PipelineRun | null): LogLine[] {
  if (!run) return [];
  const lines: LogLine[] = [];
  const created = new Date(run.created_at);
  const ts0 = created.toISOString().substring(11, 19);

  lines.push({
    ts: ts0,
    level: "info",
    msg: `pipeline.start id=${run.id} product="${run.product_name}"`,
  });
  lines.push({
    ts: ts0,
    level: "info",
    msg: `config platform=${platformLabel(run.platform)} style=${run.style} duration=${run.duration_seconds}s clips=${run.clip_count}`,
  });

  const stage = mapServerStage(run);
  const stageIdx = ["queued", "script", "project", "generating", "compose", "done"].indexOf(stage);
  const stageStream: Array<{ key: string; msg: string; level: LogLine["level"] }> = [
    { key: "queued", msg: "queue.enter waiting for worker", level: "info" },
    { key: "script", msg: "script.generate via claude-sonnet-4-7", level: "info" },
    { key: "project", msg: "video.project.create timeline=ready", level: "ok" },
    { key: "generating", msg: `seedance.dispatch clips=${run.clip_count}`, level: "info" },
    { key: "compose", msg: "ffmpeg.compose joining clips", level: "info" },
    { key: "done", msg: "pipeline.done ✓", level: "ok" },
  ];

  for (let i = 0; i <= stageIdx; i++) {
    const item = stageStream[i];
    if (!item) continue;
    const offset = i * 1200;
    const ts = new Date(created.getTime() + offset).toISOString().substring(11, 19);
    lines.push({ ts, level: item.level, msg: item.msg });
  }

  if (run.completed_clips > 0) {
    for (let i = 0; i < run.completed_clips; i++) {
      const t = new Date(created.getTime() + 5000 + i * 1800)
        .toISOString()
        .substring(11, 19);
      lines.push({
        ts: t,
        level: "ok",
        msg: `clip[${String(i + 1).padStart(2, "0")}] rendered`,
      });
    }
  }

  if (run.status === 2 && run.error_message) {
    lines.push({
      ts: new Date().toISOString().substring(11, 19),
      level: "err",
      msg: run.error_message,
    });
  }

  return lines;
}

function LogPanel({ run }: { run: PipelineRun | null }) {
  const lines = useMemo(() => buildLog(run), [run]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [lines.length]);

  if (!run) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
        <p className="eyebrow">NO RUN</p>
        <p style={{ fontSize: 12, color: "var(--ink-mid)" }}>
          选择左侧任务以查看日志流。
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span className="eyebrow">RUN · #{run.id} · STREAM</span>
        <span
          className="inline-flex items-center gap-1.5 font-mono"
          style={{ fontSize: 10.5, color: "var(--ink-lo)" }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background:
                run.status === 0
                  ? "var(--accent)"
                  : run.status === 1
                    ? "var(--good)"
                    : "var(--bad)",
              animation: run.status === 0 ? "pulse-glow 1.6s ease-in-out infinite" : "none",
            }}
          />
          {run.status === 0 ? "STREAMING" : run.status === 1 ? "ENDED" : "ERRORED"}
        </span>
      </div>
      <div
        ref={scroller}
        className="flex-1 overflow-y-auto px-5 py-4 font-mono"
        style={{ fontSize: 11, lineHeight: 1.65, background: "var(--surface-0)" }}
      >
        {lines.map((l, i) => (
          <div key={i} className="flex gap-3">
            <span style={{ color: "var(--ink-faint)" }}>{l.ts}</span>
            <span
              style={{
                color:
                  l.level === "ok"
                    ? "var(--good)"
                    : l.level === "warn"
                      ? "var(--warn)"
                      : l.level === "err"
                        ? "var(--bad)"
                        : "var(--ink-mid)",
                minWidth: 36,
              }}
            >
              {l.level.toUpperCase()}
            </span>
            <span style={{ color: "var(--ink)" }}>{l.msg}</span>
          </div>
        ))}
        {run.status === 0 && (
          <div className="flex gap-3 mt-1">
            <span style={{ color: "var(--ink-faint)" }}>...</span>
            <span style={{ color: "var(--accent)" }}>
              <span
                className="inline-block h-1.5 w-1.5 rounded-full align-middle"
                style={{
                  background: "var(--accent)",
                  animation: "pulse-glow 1s ease-in-out infinite",
                }}
              />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function DiagPanel({ run }: { run: PipelineRun | null }) {
  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <p className="eyebrow">NO RUN</p>
        <p style={{ fontSize: 12, color: "var(--ink-mid)" }}>
          选择一个任务以查看诊断信息。
        </p>
      </div>
    );
  }
  const rows: Array<[string, string]> = [
    ["RUN ID", `#${run.id}`],
    ["STATUS", run.status === 0 ? "running" : run.status === 1 ? "done" : "failed"],
    ["STAGE", STAGE_META[mapServerStage(run)].label],
    ["PROJECT", run.video_project_id ? `#${run.video_project_id}` : "—"],
    ["CLIPS", `${run.completed_clips} / ${run.clip_count}`],
    ["PLATFORM", platformLabel(run.platform)],
    ["STYLE", run.style],
    ["DURATION", `${run.duration_seconds}s`],
    ["CREATED", new Date(run.created_at).toLocaleString()],
  ];
  return (
    <div className="flex flex-col gap-3 px-5 py-5">
      <span className="eyebrow">DIAGNOSTICS</span>
      <div
        className="overflow-hidden rounded-xl"
        style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
      >
        {rows.map(([k, v], i) => (
          <div
            key={k}
            className="flex items-center justify-between px-3.5 py-2.5"
            style={{
              borderTop: i === 0 ? "none" : "1px solid var(--line-lo)",
            }}
          >
            <span
              className="font-mono"
              style={{ fontSize: 10.5, color: "var(--ink-lo)", letterSpacing: "0.12em" }}
            >
              {k}
            </span>
            <span
              className="font-mono"
              style={{ fontSize: 11.5, color: "var(--ink-hi)" }}
            >
              {v}
            </span>
          </div>
        ))}
      </div>
      {run.error_message && (
        <div
          className="rounded-xl px-3.5 py-3"
          style={{
            background: "oklch(20% 0.08 22 / 0.18)",
            border: "1px solid var(--bad)",
            fontSize: 12,
            color: "var(--ink-hi)",
            lineHeight: 1.5,
          }}
        >
          <p className="eyebrow mb-1" style={{ color: "var(--bad)" }}>
            ERROR
          </p>
          {run.error_message}
        </div>
      )}
    </div>
  );
}
