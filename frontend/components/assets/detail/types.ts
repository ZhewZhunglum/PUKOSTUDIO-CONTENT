import { Image as ImageIcon, Film, Volume2, FileText } from "lucide-react";

// Backend stores {name, source, confidence} — not {label, score}
export interface AITag {
  name: string;
  source: string;
  confidence: number;
}

export interface AssetDetail {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  asset_type: number;
  asset_subtype: string | null;
  mime_type: string | null;
  file_format: string | null;
  file_size: number | null;
  storage_key: string;
  thumbnail_key: string | null;
  thumbnail_url: string | null;
  cdn_url: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  user_tags: string[];
  ai_tags: AITag[] | null;
  ai_description: string | null;
  source: number;
  source_url: string | null;
  source_platform: string | null;
  source_extractor: string | null;
  source_model: string | null;
  source_prompt: string | null;
  favorite: boolean;
  rating: number;
  use_count: number;
  view_count: number;
  ai_processing_status: number;
  imported_at: string;
  updated_at: string;
  captured_at: string | null;
}

export interface AssetRelation {
  id: number;
  source_asset_id: number;
  target_asset_id: number;
  relation_type: string;
  metadata: Record<string, unknown> | null;
}

export const ASSET_TYPE_META: Record<number, { label: string; icon: React.ElementType; color: string }> = {
  1: { label: "图片", icon: ImageIcon, color: "text-blue-400" },
  2: { label: "视频", icon: Film, color: "text-violet-400" },
  3: { label: "音频", icon: Volume2, color: "text-green-400" },
  4: { label: "字幕", icon: FileText, color: "text-yellow-400" },
  5: { label: "脚本", icon: FileText, color: "text-cyan-400" },
  10: { label: "输出", icon: Film, color: "text-orange-400" },
  11: { label: "分析报告", icon: FileText, color: "text-pink-400" },
};

export const SOURCE_LABEL: Record<number, string> = {
  1: "用户上传", 2: "AI 生成", 3: "URL 导入", 5: "渲染输出",
};

// Size/duration formatting lives in lib/types/asset.ts — re-export so detail
// components share one implementation (GB and hour handling included).
export { formatFileSize, formatDuration } from "../../../lib/types/asset";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function compactName(name: string): string {
  if (name.length <= 44) return name;
  return `${name.slice(0, 22)}…${name.slice(-10)}`;
}
