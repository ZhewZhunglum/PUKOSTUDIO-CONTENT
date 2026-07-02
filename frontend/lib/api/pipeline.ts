import { api } from "../api";

export interface PipelineRun {
  id: number;
  video_project_id: number | null;
  status: number; // 0=running 1=done 2=failed
  stage: string | null;
  product_name: string;
  platform: string;
  style: string;
  duration_seconds: number;
  clip_count: number;
  completed_clips: number;
  error_message: string | null;
  script_json: ScriptJson | null;
  created_at: string;
}

export interface ScriptJson {
  title?: string;
  hook?: string;
  clips: ScriptClip[];
  cta?: string;
  tags?: string[];
}

export interface ScriptClip {
  position: number;
  type: string;
  prompt: string;
  duration_ms: number;
  narration?: string;
}

export type OneClickPayload = {
  product_name: string;
  product_description?: string;
  platform: string;
  style: "conversational" | "dramatic" | "educational" | "humorous";
  duration_seconds: number;
  clip_count: number;
};

export async function createPipelineRun(payload: OneClickPayload): Promise<PipelineRun> {
  const { data } = await api.post<PipelineRun>("/api/pipeline/one-click", payload);
  return data;
}

export async function listPipelineRuns(): Promise<PipelineRun[]> {
  const { data } = await api.get<PipelineRun[]>("/api/pipeline/runs");
  return data;
}

export async function getPipelineRun(id: number): Promise<PipelineRun> {
  const { data } = await api.get<PipelineRun>(`/api/pipeline/runs/${id}`);
  return data;
}
