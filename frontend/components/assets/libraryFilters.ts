import {
  Image as ImageIcon, Video, Music, FileText, Sparkles as SparkleIcon, Film,
} from "lucide-react";
import type { AssetSearchRequest } from "../../lib/types/asset";

/** Shared filter state + constants for the asset library page, its filter
 * rail, and its header — split out so each stays under the file-size cap. */

export type SearchMode = "keyword" | "semantic" | "hybrid";

export interface FilterState {
  search: string;
  search_mode: SearchMode;
  asset_types: number[];
  favorite: boolean | null;
  rating_gte: number | null;
  tags_any: string[];
  sort: string;
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  search_mode: "hybrid",
  asset_types: [],
  favorite: null,
  rating_gte: null,
  tags_any: [],
  sort: "recency",
};

export function buildSearchRequest(filters: FilterState, cursor?: number): AssetSearchRequest {
  return {
    query: filters.search || undefined,
    search_mode: filters.search_mode,
    filters: {
      asset_type: filters.asset_types.length ? filters.asset_types : undefined,
      favorite: filters.favorite,
      rating_gte: filters.rating_gte,
      tags_any: filters.tags_any.length ? filters.tags_any : undefined,
    },
    sort: filters.sort,
    cursor,
    limit: 50,
  };
}

export const TYPE_META: Record<number, { label: string; Icon: React.ElementType; hue: number }> = {
  1: { label: "图片", Icon: ImageIcon, hue: 295 },
  2: { label: "视频", Icon: Video, hue: 195 },
  3: { label: "音频", Icon: Music, hue: 75 },
  4: { label: "字幕", Icon: FileText, hue: 155 },
  9: { label: "AI", Icon: SparkleIcon, hue: 235 },
  10: { label: "成片", Icon: Film, hue: 12 },
};

export const SEARCH_MODES: { value: SearchMode; label: string; sub: string }[] = [
  { value: "hybrid", label: "混合", sub: "语义+关键词" },
  { value: "semantic", label: "语义", sub: "向量相似度" },
  { value: "keyword", label: "关键词", sub: "模糊匹配" },
];

export const TAG_HUES = [12, 35, 75, 130, 175, 210, 245, 280, 320];
