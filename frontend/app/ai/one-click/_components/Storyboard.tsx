"use client";

import { Film, Play, Loader2, Clock, CheckCircle2, ChevronRight } from "lucide-react";
import type { PipelineRun, ScriptClip } from "../../../../lib/api/pipeline";
import { thumbGradient } from "./types";

interface StoryboardProps {
  run: PipelineRun;
}

type ClipStatus = "done" | "running" | "queued";

function clipStatus(index: number, run: PipelineRun): ClipStatus {
  if (run.status === 1) return "done";
  if (index < run.completed_clips) return "done";
  if (index === run.completed_clips && run.status === 0) return "running";
  return "queued";
}

export function Storyboard({ run }: StoryboardProps) {
  const script = run.script_json;

  if (run.status === 2 && run.error_message) {
    return (
      <div className="px-8 py-6">
        <div
          className="rounded-xl px-5 py-4"
          style={{
            background: "oklch(20% 0.08 22 / 0.18)",
            border: "1px solid var(--bad)",
            color: "var(--bad)",
            fontSize: 13,
          }}
        >
          <p className="mb-1 eyebrow" style={{ color: "var(--bad)" }}>
            ERROR
          </p>
          <p style={{ color: "var(--ink-hi)" }}>{run.error_message}</p>
        </div>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--ink-lo)" }} />
        <p className="eyebrow">SCRIPT · 生成中</p>
        <p style={{ color: "var(--ink-mid)", fontSize: 13 }}>
          Claude 正在编写脚本结构…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      {(script.title || script.hook) && (
        <div className="grid grid-cols-[1.4fr_1fr] gap-4">
          {script.title && <TitleCard title={script.title} />}
          {script.hook && <HookCard hook={script.hook} />}
        </div>
      )}

      {run.video_project_id && (
        <a
          href="/ai/video"
          className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-line)",
            color: "var(--accent-2)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <Film style={{ width: 16, height: 16 }} />
          在视频编辑器中查看项目 #{run.video_project_id}
          <ChevronRight
            className="ml-auto transition-transform group-hover:translate-x-1"
            style={{ width: 16, height: 16 }}
          />
        </a>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">
            STORYBOARD · {script.clips.length} CLIPS
          </span>
          <span
            className="font-mono"
            style={{ fontSize: 10.5, color: "var(--ink-lo)" }}
          >
            {run.completed_clips}/{run.clip_count} READY
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {script.clips.map((clip, i) => (
            <ClipCard
              key={i}
              index={i}
              clip={clip}
              status={clipStatus(i, run)}
            />
          ))}
        </div>
      </div>

      {script.tags && script.tags.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="eyebrow">TAGS</span>
          <div className="flex flex-wrap gap-1.5">
            {script.tags.map((t) => (
              <span
                key={t}
                className="rounded-full px-2.5 py-1 font-mono"
                style={{
                  fontSize: 10.5,
                  color: "var(--ink-mid)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TitleCard({ title }: { title: string }) {
  return (
    <div
      className="rounded-xl px-4 py-4"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
        borderRadius: 12,
      }}
    >
      <p className="eyebrow mb-2">VIDEO TITLE</p>
      <p
        className="font-display"
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--ink-hi)",
          letterSpacing: "-0.02em",
          lineHeight: 1.3,
        }}
      >
        {title}
      </p>
    </div>
  );
}

function HookCard({ hook }: { hook: string }) {
  return (
    <div
      className="rounded-xl px-4 py-4"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        borderLeft: "2px solid var(--accent)",
      }}
    >
      <p className="eyebrow mb-2">OPENING HOOK</p>
      <p
        className="font-display italic"
        style={{
          fontSize: 14,
          color: "var(--ink)",
          lineHeight: 1.45,
        }}
      >
        “{hook}”
      </p>
    </div>
  );
}

function ClipCard({
  index,
  clip,
  status,
}: {
  index: number;
  clip: ScriptClip;
  status: ClipStatus;
}) {
  return (
    <div
      className="grid items-stretch overflow-hidden"
      style={{
        gridTemplateColumns: "48px 78px 1fr auto",
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
        borderRadius: 12,
      }}
    >
      <div
        className="flex flex-col items-center justify-center gap-1 px-2 py-3"
        style={{
          background: "var(--surface-2)",
          borderRight: "1px solid var(--line)",
        }}
      >
        <span
          className="font-display italic"
          style={{
            fontSize: 22,
            color: "var(--ink-hi)",
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 9.5, color: "var(--ink-lo)" }}
        >
          {(clip.duration_ms / 1000).toFixed(1)}s
        </span>
      </div>

      <div
        className="relative my-3 ml-3 flex items-center justify-center overflow-hidden"
        style={{
          width: 60,
          aspectRatio: "9/16",
          borderRadius: 6,
          background: thumbGradient(index),
        }}
      >
        <ClipThumbIcon status={status} />
      </div>

      <div className="flex flex-col justify-center gap-1.5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="font-mono uppercase rounded px-1.5 py-0.5"
            style={{
              fontSize: 9.5,
              color: "var(--ink-mid)",
              background: "var(--surface-2)",
              letterSpacing: "0.1em",
            }}
          >
            {clip.type}
          </span>
        </div>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ink)",
            lineHeight: 1.45,
          }}
        >
          {clip.prompt}
        </p>
        {clip.narration && (
          <blockquote
            className="font-display italic"
            style={{
              fontSize: 12,
              color: "var(--ink-mid)",
              borderLeft: "2px solid var(--accent-line)",
              paddingLeft: 10,
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {clip.narration}
          </blockquote>
        )}
      </div>

      <div className="flex items-center px-3">
        <ClipStatusPill status={status} />
      </div>
    </div>
  );
}

function ClipThumbIcon({ status }: { status: ClipStatus }) {
  if (status === "done") {
    return <Play style={{ width: 16, height: 16, color: "white" }} fill="white" />;
  }
  if (status === "running") {
    return (
      <Loader2
        className="animate-spin"
        style={{ width: 16, height: 16, color: "white" }}
      />
    );
  }
  return <Clock style={{ width: 14, height: 14, color: "oklch(100% 0 0 / 0.7)" }} />;
}

function ClipStatusPill({ status }: { status: ClipStatus }) {
  if (status === "done") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono"
        style={{
          fontSize: 9.5,
          color: "var(--good)",
          background: "oklch(25% 0.10 155 / 0.18)",
          border: "1px solid var(--good)",
          letterSpacing: "0.06em",
        }}
      >
        <CheckCircle2 style={{ width: 10, height: 10 }} />
        DONE
      </span>
    );
  }
  if (status === "running") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono"
        style={{
          fontSize: 9.5,
          color: "var(--accent)",
          background: "var(--accent-soft)",
          border: "1px solid var(--accent-line)",
          letterSpacing: "0.06em",
        }}
      >
        <Loader2 className="animate-spin" style={{ width: 10, height: 10 }} />
        RUNNING
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono"
      style={{
        fontSize: 9.5,
        color: "var(--ink-lo)",
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        letterSpacing: "0.06em",
      }}
    >
      QUEUED
    </span>
  );
}
