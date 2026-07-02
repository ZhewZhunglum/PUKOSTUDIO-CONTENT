"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Play, Film, Mic, Loader2, ChevronRight,
  GripVertical, Sparkles, RefreshCw, Volume2, Settings2,
} from "lucide-react";
import {
  listProjects,
  createProject,
  deleteProject,
  addClip,
  deleteClip,
  generateClipVideo,
  generateTts,
  renderProject,
  getProject,
  type VideoProject,
  type VideoClip,
} from "../../../lib/api/video";
import { cn } from "../../../lib/utils";

const CLIP_TYPE_LABEL: Record<string, string> = {
  footage: "素材片段",
  ai_video: "AI 视频",
  image: "图片",
  text_overlay: "文字叠加",
  transition: "转场",
};

const RENDER_STATUS_LABEL: Record<number, string> = {
  0: "草稿", 1: "渲染中", 2: "完成", 3: "失败",
};

const AI_STATUS_LABEL: Record<number, string> = {
  0: "未生成", 1: "生成中", 2: "完成", 3: "失败",
};

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50";

export default function VideoPage() {
  const qc = useQueryClient();
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [showTts, setShowTts] = useState(false);
  const [ttsText, setTtsText] = useState("");
  const [ttsVoice, setTtsVoice] = useState("nova");
  const [clipPrompt, setClipPrompt] = useState<Record<number, string>>({});
  const [activeClipId, setActiveClipId] = useState<number | null>(null);

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["video-projects"],
    queryFn: listProjects,
  });

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const isRendering = activeProject?.render_status === 1;

  const { data: projectDetail } = useQuery({
    queryKey: ["video-project", activeProjectId],
    queryFn: () => getProject(activeProjectId!),
    enabled: !!activeProjectId,
    refetchInterval: isRendering ? 3000 : false,
  });

  const displayProject = projectDetail ?? activeProject;
  const clips = displayProject?.clips ?? [];

  const createProjectMut = useMutation({
    mutationFn: () => createProject({ name: newProjectName.trim(), resolution: "1080x1920", fps: 30 }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["video-projects"] });
      setActiveProjectId(p.id);
      setNewProjectName("");
      setShowNewProject(false);
    },
  });

  const deleteProjectMut = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-projects"] });
      setActiveProjectId(null);
    },
  });

  const addClipMut = useMutation({
    mutationFn: (payload: Parameters<typeof addClip>[1]) => addClip(activeProjectId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["video-project", activeProjectId] }),
  });

  const deleteClipMut = useMutation({
    mutationFn: (clipId: number) => deleteClip(activeProjectId!, clipId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["video-project", activeProjectId] }),
  });

  const genVideoMut = useMutation({
    mutationFn: ({ clipId, prompt }: { clipId: number; prompt: string }) =>
      generateClipVideo({ video_project_id: activeProjectId!, clip_id: clipId, prompt, duration_seconds: 5 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["video-project", activeProjectId] }),
  });

  const ttsMut = useMutation({
    mutationFn: () => generateTts({ text: ttsText, voice_id: ttsVoice, save_to_library: true }),
    onSuccess: () => { setTtsText(""); setShowTts(false); },
  });

  const renderMut = useMutation({
    mutationFn: () => renderProject(activeProjectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["video-projects"] }),
  });

  function handleAddClip() {
    addClipMut.mutate({ position: clips.length, clip_type: "ai_video", duration_ms: 5000 });
  }

  function handleGenVideo(clip: VideoClip) {
    const prompt = clipPrompt[clip.id]?.trim() || clip.ai_prompt || "";
    if (!prompt) return;
    genVideoMut.mutate({ clipId: clip.id, prompt });
  }

  const totalDurationMs = clips.reduce((sum, c) => sum + (c.duration_ms ?? 0), 0);
  const totalSec = (totalDurationMs / 1000).toFixed(1);

  return (
    <div className="flex h-full gap-0 overflow-hidden -m-6">
      {/* Sidebar: project list */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[oklch(10%_0.018_278)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/30">视频项目</span>
          <button
            onClick={() => setShowNewProject((v) => !v)}
            className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
            title="新建项目"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {showNewProject && (
          <div className="border-b border-white/[0.06] px-3 py-2.5">
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newProjectName.trim() && createProjectMut.mutate()}
              placeholder="项目名称…"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
            />
            <div className="mt-1.5 flex gap-1.5">
              <button
                disabled={!newProjectName.trim() || createProjectMut.isPending}
                onClick={() => createProjectMut.mutate()}
                className="flex-1 rounded-lg bg-violet-500 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {createProjectMut.isPending ? "创建中…" : "创建"}
              </button>
              <button
                onClick={() => setShowNewProject(false)}
                className="rounded-lg px-2 py-1 text-xs text-white/35 hover:bg-white/[0.06]"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loadingProjects && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-white/25" />
            </div>
          )}
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProjectId(p.id)}
              className={cn(
                "group flex w-full items-start gap-2 border-b border-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]",
                p.id === activeProjectId && "bg-white/[0.06]"
              )}
            >
              <Film className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white/80">{p.name}</p>
                <p className="text-[11px] text-white/35">
                  {RENDER_STATUS_LABEL[p.render_status]} · {p.resolution}
                </p>
              </div>
              <ChevronRight className="mt-1 h-3 w-3 shrink-0 text-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
          {!loadingProjects && projects.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-white/25">暂无项目，点击 + 新建</p>
          )}
        </div>
      </aside>

      {/* Main: editor */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {!displayProject ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/20">
            <Film className="h-12 w-12 opacity-20" />
            <p className="text-sm">选择或创建一个视频项目</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-3">
              <div>
                <h1 className="text-base font-semibold text-white/90">{displayProject.name}</h1>
                <p className="text-xs text-white/35">
                  {clips.length} 段 · {totalSec}s · {displayProject.resolution} · {displayProject.fps}fps
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTts((v) => !v)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/80"
                >
                  <Mic className="h-3.5 w-3.5" />
                  TTS 配音
                </button>
                <button
                  disabled={clips.length === 0 || displayProject.render_status === 1 || renderMut.isPending}
                  onClick={() => renderMut.mutate()}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
                >
                  {displayProject.render_status === 1 || renderMut.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />渲染中 {displayProject.render_progress}%</>
                  ) : (
                    <><Play className="h-3.5 w-3.5" />开始渲染</>
                  )}
                </button>
                <button
                  onClick={() => deleteProjectMut.mutate(displayProject.id)}
                  className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  title="删除项目"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Render done banner */}
            {displayProject.render_status === 2 && displayProject.output_asset_id && (
              <div className="flex items-center gap-3 border-b border-white/[0.06] bg-emerald-500/10 px-6 py-2.5 text-sm">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-400">渲染完成</span>
                <a
                  href={`/api/assets/${displayProject.output_asset_id}/download`}
                  className="ml-auto text-xs text-white/50 underline hover:text-white/80"
                  target="_blank"
                  rel="noreferrer"
                >
                  下载视频
                </a>
              </div>
            )}

            {/* TTS Panel */}
            {showTts && (
              <div className="border-b border-white/[0.06] bg-white/[0.02] px-6 py-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-white/70">
                  <Volume2 className="h-4 w-4" />
                  TTS 配音生成
                </h2>
                <div className="flex gap-3">
                  <textarea
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    placeholder="输入旁白文字…"
                    rows={3}
                    className="flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
                  />
                  <div className="flex flex-col gap-2">
                    <select
                      value={ttsVoice}
                      onChange={(e) => setTtsVoice(e.target.value)}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-xs text-white/60 outline-none"
                    >
                      {["nova", "alloy", "echo", "fable", "onyx", "shimmer"].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <button
                      disabled={!ttsText.trim() || ttsMut.isPending}
                      onClick={() => ttsMut.mutate()}
                      className="rounded-xl bg-violet-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {ttsMut.isPending ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : "生成配音"}
                    </button>
                    {ttsMut.isSuccess && <span className="text-center text-[10px] text-emerald-400">✓ 已保存素材库</span>}
                    {ttsMut.isError && <span className="text-center text-[10px] text-red-400">生成失败</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Clip Timeline */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30">时间线</h2>
                <button
                  onClick={handleAddClip}
                  disabled={addClipMut.isPending}
                  className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加片段
                </button>
              </div>

              {clips.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/[0.08] py-16 text-white/20">
                  <Film className="h-8 w-8 opacity-30" />
                  <p className="text-sm">暂无片段，点击「添加片段」开始</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clips.map((clip, idx) => (
                    <ClipRow
                      key={clip.id}
                      clip={clip}
                      index={idx}
                      projectId={displayProject.id}
                      prompt={clipPrompt[clip.id] ?? clip.ai_prompt ?? ""}
                      isActive={clip.id === activeClipId}
                      isGenerating={genVideoMut.isPending && genVideoMut.variables?.clipId === clip.id}
                      onSetPrompt={(v) => setClipPrompt((p) => ({ ...p, [clip.id]: v }))}
                      onGenerate={() => handleGenVideo(clip)}
                      onDelete={() => deleteClipMut.mutate(clip.id)}
                      onToggle={() => setActiveClipId((id) => (id === clip.id ? null : clip.id))}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── ClipRow ───────────────────────────────────────────────────────────────────

interface ClipRowProps {
  clip: VideoClip;
  index: number;
  projectId: number;
  prompt: string;
  isActive: boolean;
  isGenerating: boolean;
  onSetPrompt: (v: string) => void;
  onGenerate: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function ClipRow({ clip, index, prompt, isActive, isGenerating, onSetPrompt, onGenerate, onDelete, onToggle }: ClipRowProps) {
  const durationSec = clip.duration_ms ? (clip.duration_ms / 1000).toFixed(1) : "?";
  const startSec = (clip.start_ms / 1000).toFixed(1);

  const aiStatusCls =
    clip.ai_status === 2 ? "bg-emerald-500/10 text-emerald-400"
    : clip.ai_status === 1 ? "bg-blue-500/10 text-blue-400"
    : clip.ai_status === 3 ? "bg-red-500/10 text-red-400"
    : "bg-white/[0.06] text-white/35";

  return (
    <div className={cn(
      "rounded-xl border bg-white/[0.02] transition-colors",
      isActive ? "border-violet-500/40" : "border-white/[0.07]"
    )}>
      {/* Clip header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-white/20" />
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-semibold text-white/40">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/80">{CLIP_TYPE_LABEL[clip.clip_type]}</span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", aiStatusCls)}>
              {AI_STATUS_LABEL[clip.ai_status]}
            </span>
          </div>
          <p className="text-[11px] text-white/35">
            {startSec}s 起 · {durationSec}s · 速度 {clip.speed}x
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
            title="展开设置"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="删除片段"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* AI gen panel */}
      {isActive && clip.clip_type === "ai_video" && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <label className="mb-1.5 block text-xs font-medium text-white/40">AI 生成提示词</label>
          <div className="flex gap-2">
            <textarea
              value={prompt}
              onChange={(e) => onSetPrompt(e.target.value)}
              placeholder="描述这段视频内容…"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
            />
            <button
              disabled={!prompt.trim() || isGenerating || clip.ai_status === 1}
              onClick={onGenerate}
              className="flex flex-col items-center justify-center gap-1 rounded-xl bg-violet-500 px-4 text-xs font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
            >
              {isGenerating || clip.ai_status === 1 ? (
                <><Loader2 className="h-4 w-4 animate-spin" />生成中</>
              ) : (
                <><Sparkles className="h-4 w-4" />{clip.ai_status === 2 ? "重新生成" : "生成视频"}</>
              )}
            </button>
          </div>
          {clip.ai_status === 3 && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
              <RefreshCw className="h-3 w-3" />生成失败，请重试
            </p>
          )}
          {clip.asset_id && clip.ai_status === 2 && (
            <p className="mt-1.5 text-xs text-emerald-400">✓ 视频已生成并保存至素材库 (Asset #{clip.asset_id})</p>
          )}
        </div>
      )}
    </div>
  );
}
