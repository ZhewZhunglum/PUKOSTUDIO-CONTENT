import { api } from "../api";

export type ProductionStatus = 0 | 1 | 2; // 0=draft 1=published 2=archived

export interface AdPerformance {
  id: number;
  production_id: number;
  platform: string | null;
  campaign_name: string | null;
  date_start: string | null;
  date_end: string | null;
  spend: string | null;
  currency: string;
  impressions: number | null;
  clicks: number | null;
  plays: number | null;
  ctr: string | null;
  completion_rate: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  conversions: number | null;
  revenue: string | null;
  roas: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Production {
  id: number;
  asset_id: number;
  title: string;
  description: string | null;
  platform: string | null;
  platform_url: string | null;
  published_at: string | null;
  status: ProductionStatus;
  sku_id: number | null;
  brand_id: number | null;
  video_project_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // enriched
  ad_performances: AdPerformance[];
  asset_thumbnail_url: string | null;
  asset_preview_url: string | null;
  asset_name: string | null;
  asset_duration_ms: number | null;
}

export interface ProductionListResponse {
  items: Production[];
  total: number;
}

export interface ProductionCreate {
  asset_id: number;
  title: string;
  description?: string;
  platform?: string;
  platform_url?: string;
  published_at?: string;
  status?: number;
  sku_id?: number;
  brand_id?: number;
  video_project_id?: number;
  notes?: string;
}

export interface ProductionUpdate {
  title?: string;
  description?: string;
  platform?: string;
  platform_url?: string;
  published_at?: string;
  status?: number;
  sku_id?: number;
  brand_id?: number;
  video_project_id?: number;
  notes?: string;
}

export interface AdPerformanceCreate {
  platform?: string;
  campaign_name?: string;
  date_start?: string;
  date_end?: string;
  spend?: string;
  currency?: string;
  impressions?: number;
  clicks?: number;
  plays?: number;
  ctr?: string;
  completion_rate?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  conversions?: number;
  revenue?: string;
  roas?: string;
  notes?: string;
}

// ── Productions ───────────────────────────────────────────────────────────────

export async function listProductions(params?: {
  status?: number;
  platform?: string;
  limit?: number;
  offset?: number;
}): Promise<ProductionListResponse> {
  const res = await api.get<ProductionListResponse>("/api/productions", {
    params,
  });
  return res.data;
}

export async function getProduction(id: number): Promise<Production> {
  const res = await api.get<Production>(`/api/productions/${id}`);
  return res.data;
}

export async function createProduction(data: ProductionCreate): Promise<Production> {
  const res = await api.post<Production>("/api/productions", data);
  return res.data;
}

export async function updateProduction(
  id: number,
  data: ProductionUpdate
): Promise<Production> {
  const res = await api.patch<Production>(`/api/productions/${id}`, data);
  return res.data;
}

export async function deleteProduction(id: number): Promise<void> {
  await api.delete(`/api/productions/${id}`);
}

// ── Ad Performance ────────────────────────────────────────────────────────────

export async function createAdPerformance(
  productionId: number,
  data: AdPerformanceCreate
): Promise<AdPerformance> {
  const res = await api.post<AdPerformance>(
    `/api/productions/${productionId}/ad-performances`,
    data
  );
  return res.data;
}

export async function updateAdPerformance(
  productionId: number,
  adId: number,
  data: Partial<AdPerformanceCreate>
): Promise<AdPerformance> {
  const res = await api.patch<AdPerformance>(
    `/api/productions/${productionId}/ad-performances/${adId}`,
    data
  );
  return res.data;
}

export async function deleteAdPerformance(
  productionId: number,
  adId: number
): Promise<void> {
  await api.delete(
    `/api/productions/${productionId}/ad-performances/${adId}`
  );
}
