import type { PipelineRun } from "../../../../lib/api/pipeline";

export type StageKey =
  | "queued"
  | "script"
  | "project"
  | "generating"
  | "compose"
  | "done";

export const STAGE_ORDER: StageKey[] = [
  "queued",
  "script",
  "project",
  "generating",
  "compose",
  "done",
];

export const STAGE_META: Record<StageKey, { label: string }> = {
  queued: { label: "排队" },
  script: { label: "脚本" },
  project: { label: "建项目" },
  generating: { label: "AI生成" },
  compose: { label: "合成" },
  done: { label: "完成" },
};

// Map server-side stage strings to our 6-stage pipeline keys
export function mapServerStage(run: PipelineRun): StageKey {
  if (run.status === 1) return "done";
  const stage = run.stage ?? "";
  switch (stage) {
    case "queued":
      return "queued";
    case "generating_script":
      return "script";
    case "creating_project":
      return "project";
    case "queuing_generation":
    case "generating_videos":
      return "generating";
    case "composing":
    case "rendering":
      return "compose";
    case "completed":
    case "done":
      return "done";
    default:
      return run.status === 0 ? "generating" : "queued";
  }
}

export function activeStageIndex(run: PipelineRun): number {
  return STAGE_ORDER.indexOf(mapServerStage(run));
}

// 8 thumbnail gradient pairs for clip cards
export const THUMB_GRADIENTS: Array<[string, string]> = [
  ["oklch(58% 0.18 295)", "oklch(40% 0.14 260)"],
  ["oklch(62% 0.16 200)", "oklch(38% 0.12 240)"],
  ["oklch(60% 0.18 25)", "oklch(38% 0.14 350)"],
  ["oklch(64% 0.16 150)", "oklch(40% 0.12 200)"],
  ["oklch(62% 0.18 75)", "oklch(40% 0.14 30)"],
  ["oklch(56% 0.20 320)", "oklch(34% 0.16 280)"],
  ["oklch(60% 0.16 100)", "oklch(38% 0.12 150)"],
  ["oklch(58% 0.18 235)", "oklch(36% 0.14 280)"],
];

export function thumbGradient(index: number): string {
  const [a, b] = THUMB_GRADIENTS[index % THUMB_GRADIENTS.length];
  return `linear-gradient(155deg, ${a} 0%, ${b} 100%)`;
}
