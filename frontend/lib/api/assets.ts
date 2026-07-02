import { api } from "../api";
import type {
  AssetListResponse,
  AssetFacetsResponse,
  AssetSearchRequest,
  UploadCompleteRequest,
  UploadInitRequest,
  UploadInitResponse,
} from "../types/asset";

export async function initUpload(req: UploadInitRequest): Promise<UploadInitResponse> {
  const res = await api.post<UploadInitResponse>("/api/assets/upload/init", req);
  return res.data;
}

export async function completeUpload(req: UploadCompleteRequest) {
  const res = await api.post("/api/assets/upload/complete", req);
  return res.data;
}

export function uploadToStorage(
  presignedUrl: string,
  file: File,
  contentType: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Storage upload failed: ${xhr.status} ${xhr.statusText}`));
    };
    xhr.onerror = () => reject(new Error("Storage upload failed: network error"));
    xhr.onabort = () => reject(new Error("Storage upload cancelled"));
    xhr.send(file);
  });
}

export async function listAssets(params: Record<string, unknown> = {}): Promise<AssetListResponse> {
  const res = await api.get<AssetListResponse>("/api/assets", { params });
  return res.data;
}

export async function searchAssets(req: AssetSearchRequest): Promise<AssetListResponse> {
  const res = await api.post<AssetListResponse>("/api/assets/search", req);
  return res.data;
}

export async function getAssetFacets(): Promise<AssetFacetsResponse> {
  const res = await api.get<AssetFacetsResponse>("/api/assets/facets");
  return res.data;
}

export async function deleteAsset(id: number): Promise<void> {
  await api.delete(`/api/assets/${id}`);
}

export async function toggleFavorite(id: number, favorite: boolean) {
  const res = await api.patch(`/api/assets/${id}`, { favorite });
  return res.data;
}

// ── URL Import ────────────────────────────────────────────────────────────────

export interface ImportUrlRequest {
  url: string;
  name?: string;
  tags?: string[];
  sku_id?: number;
  brand_id?: number;
  force?: boolean;
}

export interface ImportUrlStatus {
  task_id: number;
  status: "pending" | "running" | "done" | "failed";
  asset_id?: number;
  name?: string;
  platform?: string;
  platform_key?: string;
  extractor?: string;
  strategy?: string;
  error_code?: string;
  source_url?: string;
  asset_type?: number;
  error?: string;
}

export interface ImportUrlResponse {
  task_id: number | null;
  asset_id?: number | null;
  status: "queued" | "existing";
  platform?: string | null;
  reason?: string | null;
  message: string;
}

export interface ImportUrlSubmission {
  url: string;
  status: "queued" | "existing" | "rejected";
  task_id?: number | null;
  asset_id?: number | null;
  platform?: string | null;
  reason?: string | null;
}

export interface ImportUrlsResponse {
  submitted: number;
  existing: number;
  rejected: number;
  items: ImportUrlSubmission[];
}

export interface ImportPlatformCapability {
  key: string;
  label: string;
  tier: "first_class" | "generic_ytdlp" | "direct_file" | "mainland_compat";
  patterns: string[];
}

export interface ImportPlatformsResponse {
  platforms: ImportPlatformCapability[];
  ytdlp_version: string;
  extractor_count: number;
  cookies_configured: boolean;
  proxy_configured: boolean;
  user_agent_configured: boolean;
}

export async function importFromUrl(req: ImportUrlRequest): Promise<ImportUrlResponse> {
  const res = await api.post("/api/assets/import-url", req);
  return res.data;
}

export async function importFromUrls(req: {
  items: ImportUrlRequest[];
  force?: boolean;
}): Promise<ImportUrlsResponse> {
  const res = await api.post<ImportUrlsResponse>("/api/assets/import-urls", req);
  return res.data;
}

export async function getImportUrlStatus(taskId: number): Promise<ImportUrlStatus> {
  const res = await api.get<ImportUrlStatus>(`/api/assets/import-url/${taskId}`);
  return res.data;
}

export async function getImportPlatforms(): Promise<ImportPlatformsResponse> {
  const res = await api.get<ImportPlatformsResponse>("/api/assets/import-url/platforms");
  return res.data;
}
