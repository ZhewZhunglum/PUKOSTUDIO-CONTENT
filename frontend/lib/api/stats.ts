import { api } from "../api";

export interface StatsOverview {
  assets: { total: number; by_type: Record<string, number> };
  video_projects: { total: number; by_status: Record<string, number> };
  tasks: { by_status: Record<string, number> };
  ai_calls: { total: number; total_cost_usd: number };
  tags: { total: number };
  collections: { total: number };
  pipelines: { by_status: Record<string, number> };
}

export interface CostStats {
  period_days: number;
  total_cost_usd: number;
  by_provider: Record<string, { total_cost: number; capabilities: CapabilityCost[] }>;
}

export interface CapabilityCost {
  capability: string;
  calls: number;
  cost_usd: number;
  avg_latency_ms: number;
}

export interface ActivityStats {
  assets: ActivityAsset[];
  ai_calls: ActivityCall[];
}

export interface ActivityAsset {
  id: number;
  name: string;
  asset_type: number;
  mime_type: string;
  source: number;
  created_at: string;
}

export interface ActivityCall {
  id: number;
  provider: string;
  capability: string;
  model: string;
  cost_usd: number;
  latency_ms: number;
  created_at: string;
}

export interface StorageStats {
  total_bytes: number;
  total_gb: number;
  by_type: { asset_type: number; count: number; bytes: number }[];
}

export async function getOverview(): Promise<StatsOverview> {
  const { data } = await api.get<StatsOverview>("/api/stats/overview");
  return data;
}

export async function getCosts(days = 30): Promise<CostStats> {
  const { data } = await api.get<CostStats>(`/api/stats/costs?days=${days}`);
  return data;
}

export async function getActivity(): Promise<ActivityStats> {
  const { data } = await api.get<ActivityStats>("/api/stats/activity");
  return data;
}

export async function getStorage(): Promise<StorageStats> {
  const { data } = await api.get<StorageStats>("/api/stats/storage");
  return data;
}
