import { api } from "../api";

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  cover_asset_id: number | null;
  asset_count: number;
  is_smart: boolean;
  smart_rules: Record<string, unknown> | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionAsset {
  id: number;
  uuid: string;
  name: string;
  asset_type: number;
  mime_type: string | null;
  file_size: number | null;
  thumbnail_key: string | null;
  cdn_url: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  favorite: boolean;
  rating: number;
  use_count: number;
  user_tags: string[];
  ai_processing_status: number;
  imported_at: string;
  storage_key: string;
}

export interface CreateCollectionPayload {
  name: string;
  description?: string;
  cover_asset_id?: number;
  is_smart?: boolean;
  sort_order?: number;
}

export async function listCollections(limit = 50, offset = 0): Promise<Collection[]> {
  const { data } = await api.get<Collection[]>("/api/collections", {
    params: { limit, offset },
  });
  return data;
}

export async function createCollection(payload: CreateCollectionPayload): Promise<Collection> {
  const { data } = await api.post<Collection>("/api/collections", payload);
  return data;
}

export async function updateCollection(
  id: number,
  payload: Partial<CreateCollectionPayload>
): Promise<Collection> {
  const { data } = await api.patch<Collection>(`/api/collections/${id}`, payload);
  return data;
}

export async function deleteCollection(id: number): Promise<void> {
  await api.delete(`/api/collections/${id}`);
}

export async function getCollectionAssets(colId: number): Promise<CollectionAsset[]> {
  const { data } = await api.get<CollectionAsset[]>(
    `/api/collections/${colId}/assets/detail`
  );
  return data;
}

export async function addAssetsToCollection(colId: number, assetIds: number[]): Promise<void> {
  await api.post(`/api/collections/${colId}/assets`, { asset_ids: assetIds });
}

export async function removeAssetFromCollection(colId: number, assetId: number): Promise<void> {
  await api.delete(`/api/collections/${colId}/assets/${assetId}`);
}

export interface AICollectStatus {
  task_id: number;
  status: "pending" | "running" | "done" | "failed";
  collection_id: number | null;
  collection_name: string | null;
  asset_count: number | null;
  error: string | null;
}

export async function startAICollect(payload: {
  description: string;
  collection_name?: string;
  max_results?: number;
}): Promise<{ task_id: number; message: string }> {
  const { data } = await api.post("/api/collections/ai-collect", payload);
  return data;
}

export async function getAICollectStatus(taskId: number): Promise<AICollectStatus> {
  const { data } = await api.get<AICollectStatus>(`/api/collections/ai-collect/${taskId}`);
  return data;
}
