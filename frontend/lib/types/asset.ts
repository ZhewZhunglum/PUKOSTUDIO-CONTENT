export interface AssetListItem {
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
  source_url?: string | null;
  source_platform?: string | null;
  source_extractor?: string | null;
}

export interface AssetListResponse {
  items: AssetListItem[];
  next_cursor: number | null;
  total_hint: number | null;
}

export interface AssetFacetTag {
  name: string;
  use_count: number;
}

export interface AssetFacetsResponse {
  by_type: Record<string, number>;
  top_tags: AssetFacetTag[];
}

export interface IntRangeFilter {
  gte?: number;
  lte?: number;
}

export interface AssetSearchFilters {
  asset_ids?: number[];
  asset_type?: number[];
  duration_ms?: IntRangeFilter;
  width?: IntRangeFilter;
  height?: IntRangeFilter;
  tags_all?: string[];
  tags_any?: string[];
  tags_not?: string[];
  favorite?: boolean | null;
  rating_gte?: number | null;
  imported_after?: string;
  imported_before?: string;
  sku_id?: number;
  brand_id?: number;
  project_id?: number;
}

export interface AssetSearchRequest {
  query?: string;
  keyword?: string;
  search_mode?: "keyword" | "semantic" | "hybrid";
  filters?: AssetSearchFilters;
  sort?: string;
  cursor?: number;
  limit?: number;
}

export interface UploadInitRequest {
  filename: string;
  file_size: number;
  mime_type: string;
  file_md5?: string;
  asset_type: number;
}

export interface UploadInitResponse {
  upload_url: string | null;
  storage_key: string;
  asset_id: number | null;
  is_duplicate: boolean;
}

export interface UploadCompleteRequest {
  storage_key: string;
  filename: string;
  mime_type: string;
  file_size: number;
  file_md5?: string;
  asset_type: number;
  name?: string;
}

export const ASSET_TYPE_MAP: Record<number, string> = {
  1: "image",
  2: "video",
  3: "audio",
  4: "subtitle",
  5: "script",
  6: "product",
  7: "brand",
  8: "avatar",
  9: "ai_asset",
  10: "output",
  11: "reference",
};

export function guessAssetType(mimeType: string): number {
  if (mimeType.startsWith("image/")) return 1;
  if (mimeType.startsWith("video/")) return 2;
  if (mimeType.startsWith("audio/")) return 3;
  return 11;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(ms: number | null): string {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
