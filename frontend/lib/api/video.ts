import { api } from "../api";

export interface VideoClip {
  id: number;
  position: number;
  clip_type: "footage" | "ai_video" | "image" | "text_overlay" | "transition";
  asset_id: number | null;
  ai_prompt: string | null;
  ai_status: number; // 0=none 1=generating 2=done 3=failed
  duration_ms: number | null;
  trim_start_ms: number;
  volume: string;
  speed: string;
  start_ms: number;
  text_content: string | null;
  created_at: string;
}

export interface VideoProject {
  id: number;
  name: string;
  description: string | null;
  resolution: string;
  fps: number;
  render_status: number; // 0=draft 1=rendering 2=done 3=failed
  render_progress: number;
  output_asset_id: number | null;
  clips: VideoClip[];
  created_at: string;
}

export type CreateProjectPayload = {
  name: string;
  description?: string;
  resolution?: string;
  fps?: number;
};

export type AddClipPayload = {
  position: number;
  clip_type: VideoClip["clip_type"];
  asset_id?: number;
  ai_prompt?: string;
  duration_ms?: number;
};

export type UpdateClipPayload = {
  duration_ms?: number;
  trim_start_ms?: number;
  volume?: string;
  speed?: string;
  text_content?: string;
  ai_prompt?: string;
};

export async function listProjects(): Promise<VideoProject[]> {
  const { data } = await api.get<VideoProject[]>("/api/video/projects");
  return data;
}

export async function createProject(payload: CreateProjectPayload): Promise<VideoProject> {
  const { data } = await api.post<VideoProject>("/api/video/projects", payload);
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/api/video/projects/${id}`);
}

export async function addClip(projectId: number, payload: AddClipPayload): Promise<VideoClip> {
  const { data } = await api.post<VideoClip>(`/api/video/projects/${projectId}/clips`, payload);
  return data;
}

export async function updateClip(
  projectId: number,
  clipId: number,
  payload: UpdateClipPayload,
): Promise<VideoClip> {
  const { data } = await api.patch<VideoClip>(
    `/api/video/projects/${projectId}/clips/${clipId}`,
    payload,
  );
  return data;
}

export async function deleteClip(projectId: number, clipId: number): Promise<void> {
  await api.delete(`/api/video/projects/${projectId}/clips/${clipId}`);
}

export async function generateClipVideo(payload: {
  video_project_id: number;
  clip_id: number;
  prompt: string;
  duration_seconds?: number;
  reference_asset_id?: number;
}): Promise<{ task_id: number; message: string }> {
  const { data } = await api.post("/api/video/generate", payload);
  return data;
}

export async function generateTts(payload: {
  text: string;
  voice_id?: string;
  speed?: number;
  save_to_library?: boolean;
}): Promise<{ asset_id: number | null; duration_ms: number | null; model_used: string; cost_usd: number }> {
  const { data } = await api.post("/api/video/tts", payload);
  return data;
}

export async function renderProject(videoProjectId: number): Promise<{ task_id: number; message: string }> {
  const { data } = await api.post("/api/video/render", { video_project_id: videoProjectId });
  return data;
}

export async function getProject(id: number): Promise<VideoProject> {
  const { data } = await api.get<VideoProject>(`/api/video/projects/${id}`);
  return data;
}
