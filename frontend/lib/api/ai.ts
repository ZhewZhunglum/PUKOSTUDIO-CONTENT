import { api } from "../api";

export interface ScriptGenRequest {
  product_name: string;
  product_description?: string;
  platform?: string;
  duration_seconds?: number;
  style?: string;
  target_audience?: string;
  keywords?: string[];
  quality?: string;
}

export interface ScriptGenResponse {
  script: string;
  hooks: string[];
  tags_suggested: string[];
  model_used: string;
  cost_usd: number;
  asset_id?: number | null;
}

export async function generateScript(req: ScriptGenRequest): Promise<ScriptGenResponse> {
  const res = await api.post<ScriptGenResponse>("/ai/generate/script", req);
  return res.data;
}

export interface ImageGenRequest {
  prompt: string;
  size?: string;
  quality?: string;
  style_preset?: string;
  n?: number;
  save_to_library?: boolean;
}

export interface ImageGenResponse {
  images: string[];
  cdn_urls: string[];
  model_used: string;
  cost_usd: number;
  asset_ids: number[];
}

export async function generateImage(req: ImageGenRequest): Promise<ImageGenResponse> {
  const res = await api.post<ImageGenResponse>("/ai/generate/image", req);
  return res.data;
}

export async function searchAssets(q: string, types?: number[]): Promise<unknown[]> {
  const params: Record<string, unknown> = { q };
  if (types?.length) params.types = types.join(",");
  const res = await api.get<unknown[]>("/api/search", { params });
  return res.data;
}

export async function searchSimilarByText(query: string, limit = 20): Promise<unknown[]> {
  const res = await api.post<unknown[]>("/api/search/similar/text", { query, limit });
  return res.data;
}
