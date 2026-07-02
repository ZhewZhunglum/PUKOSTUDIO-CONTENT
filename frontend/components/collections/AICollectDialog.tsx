"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Sparkles, Loader2, CheckCircle2, AlertCircle, FolderOpen } from "lucide-react";
import { startAICollect, getAICollectStatus, type AICollectStatus } from "../../lib/api/collections";
import Link from "next/link";

interface AICollectDialogProps {
  onClose: () => void;
}

type Stage = "input" | "processing" | "done" | "failed";

const STAGE_LABELS: Record<string, string> = {
  pending: "解析需求描述…",
  running: "检索 + 精选素材…",
};

export function AICollectDialog({ onClose }: AICollectDialogProps) {
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [maxResults, setMaxResults] = useState(30);
  const [stage, setStage] = useState<Stage>("input");
  const [taskId, setTaskId] = useState<number | null>(null);
  const [status, setStatus] = useState<AICollectStatus | null>(null);
  const [progressLabel, setProgressLabel] = useState("处理中…");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function submit() {
    if (!description.trim()) return;
    setStage("processing");
    setProgressLabel("解析需求描述…");
    try {
      const { task_id } = await startAICollect({
        description: description.trim(),
        collection_name: collectionName.trim() || undefined,
        max_results: maxResults,
      });
      setTaskId(task_id);
      startPolling(task_id);
    } catch {
      setStage("failed");
    }
  }

  function startPolling(id: number) {
    let tick = 0;
    pollRef.current = setInterval(async () => {
      tick++;
      if (tick === 3) setProgressLabel("检索素材库…");
      if (tick === 6) setProgressLabel("AI 精选中…");

      try {
        const s = await getAICollectStatus(id);
        setStatus(s);
        if (s.status === "done") {
          clearInterval(pollRef.current!);
          setStage("done");
          qc.invalidateQueries({ queryKey: ["collections"] });
        } else if (s.status === "failed") {
          clearInterval(pollRef.current!);
          setStage("failed");
        }
      } catch {
        // keep polling
      }
    }, 2500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[oklch(12%_0.02_278)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-white/90">AI 智能收集素材</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {stage === "input" && (
            <InputStage
              description={description}
              setDescription={setDescription}
              collectionName={collectionName}
              setCollectionName={setCollectionName}
              maxResults={maxResults}
              setMaxResults={setMaxResults}
              onSubmit={submit}
              textareaRef={textareaRef}
            />
          )}

          {stage === "processing" && (
            <ProcessingStage label={progressLabel} />
          )}

          {stage === "done" && status && (
            <DoneStage status={status} onClose={onClose} />
          )}

          {stage === "failed" && (
            <FailedStage error={status?.error} onRetry={() => setStage("input")} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-stages ─────────────────────────────────────────────────────────────────

interface InputStageProps {
  description: string;
  setDescription: (v: string) => void;
  collectionName: string;
  setCollectionName: (v: string) => void;
  maxResults: number;
  setMaxResults: (v: number) => void;
  onSubmit: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

function InputStage({
  description, setDescription,
  collectionName, setCollectionName,
  maxResults, setMaxResults,
  onSubmit, textareaRef,
}: InputStageProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/50">
          描述你想要的素材
        </label>
        <textarea
          ref={textareaRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例如：节日气氛浓厚的产品展示图，暖色调，有人物互动…"
          rows={4}
          className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 text-sm text-white/80 placeholder-white/25 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(); }}
        />
        <p className="mt-1 text-xs text-white/25">⌘↵ 提交</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">集合名称（选填）</label>
          <input
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            placeholder="留空则由 AI 命名"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white/80 placeholder-white/25 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            最多素材数 <span className="text-violet-400">{maxResults}</span>
          </label>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className="mt-2 w-full accent-violet-500"
          />
        </div>
      </div>

      <button
        onClick={onSubmit}
        disabled={!description.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500/20 py-2.5 text-sm font-medium text-violet-300 transition-colors hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Sparkles className="h-3.5 w-3.5" />
        开始 AI 收集
      </button>
    </div>
  );
}

function ProcessingStage({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-violet-500/15" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
          <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white/80">{label}</p>
        <p className="mt-1 text-xs text-white/35">AI 正在分析素材库，请稍候…</p>
      </div>

      {/* 3-step progress dots */}
      <div className="flex items-center gap-3 text-xs text-white/30">
        <Step label="解析描述" active />
        <div className="h-px w-6 bg-white/[0.1]" />
        <Step label="检索素材" active={label.includes("检索") || label.includes("精选")} />
        <div className="h-px w-6 bg-white/[0.1]" />
        <Step label="精选整理" active={label.includes("精选")} />
      </div>
    </div>
  );
}

function Step({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={active ? "text-violet-400" : "text-white/30"}>
      {label}
    </span>
  );
}

function DoneStage({ status, onClose }: { status: AICollectStatus; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
        <CheckCircle2 className="h-7 w-7 text-emerald-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-white/90">收集完成！</p>
        <p className="mt-1 text-xs text-white/45">
          已创建集合「<span className="text-white/70">{status.collection_name}</span>」，
          共收录 <span className="font-medium text-emerald-400">{status.asset_count}</span> 个素材
        </p>
      </div>
      <div className="flex items-center gap-3">
        {status.collection_id && (
          <Link
            href={`/collections?id=${status.collection_id}`}
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl bg-violet-500/20 px-4 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/30"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            查看集合
          </Link>
        )}
        <button
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-xs text-white/40 hover:text-white/70"
        >
          关闭
        </button>
      </div>
    </div>
  );
}

function FailedStage({ error, onRetry }: { error?: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
        <AlertCircle className="h-7 w-7 text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-white/90">收集失败</p>
        <p className="mt-1 text-xs text-white/40">{error ?? "未知错误，请重试"}</p>
      </div>
      <button
        onClick={onRetry}
        className="rounded-xl bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.1]"
      >
        重新尝试
      </button>
    </div>
  );
}
