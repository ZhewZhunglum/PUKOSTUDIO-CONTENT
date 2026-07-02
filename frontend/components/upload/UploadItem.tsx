"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, XCircle, X, AlertCircle } from "lucide-react";
import type { UploadFile } from "../../hooks/useUpload";
import { formatFileSize } from "../../lib/types/asset";
import { cn } from "../../lib/utils";

interface UploadItemProps {
  item: UploadFile;
  onRemove: (id: string) => void;
}

const STATUS_ICON = {
  idle: null,
  uploading: <Loader2 className="h-4 w-4 animate-spin text-violet-400" />,
  done: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  duplicate: <Copy className="h-4 w-4 text-amber-400" />,
  error: <XCircle className="h-4 w-4 text-red-400" />,
};

const STATUS_LABEL = {
  idle: "",
  uploading: "",
  done: "完成",
  duplicate: "秒传（已存在）",
  error: "失败",
};

const PHASE_LABEL: Record<string, string> = {
  init: "初始化…",
  uploading: "上传中…",
  completing: "处理中…",
  done: "",
  "": "",
};

export function UploadItem({ item, onRemove }: UploadItemProps) {
  const { file, status, progress, phase, error } = item;

  // Keep progress bar visible briefly after done for visual confirmation
  const [showBar, setShowBar] = useState(true);
  useEffect(() => {
    if (status === "done") {
      const t = setTimeout(() => setShowBar(false), 1800);
      return () => clearTimeout(t);
    }
    setShowBar(true);
  }, [status]);

  const barColor =
    status === "done" ? "bg-emerald-500"
    : status === "error" ? "bg-red-500"
    : "bg-violet-500";

  const phaseLabel =
    status === "uploading" ? (PHASE_LABEL[phase ?? ""] || "上传中…")
    : STATUS_LABEL[status];

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-white/80">{file.name}</span>
          <span className="shrink-0 text-white/30 text-xs">
            {formatFileSize(file.size)}
          </span>
          {(status === "uploading" || status === "done") && (
            <span
              className={cn(
                "shrink-0 text-xs tabular-nums transition-colors duration-300",
                status === "done" ? "text-emerald-400" : "text-violet-300"
              )}
            >
              {progress}%
            </span>
          )}
        </div>

        {(status === "uploading" || (status === "done" && showBar)) && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                barColor,
                status === "done" && "transition-opacity duration-700"
              )}
              style={{
                width: `${progress}%`,
                opacity: status === "done" && !showBar ? 0 : 1,
              }}
            />
          </div>
        )}

        {status === "error" && error && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn("text-xs", {
            "text-emerald-400": status === "done",
            "text-amber-400": status === "duplicate",
            "text-violet-400": status === "uploading",
            "text-red-400": status === "error",
            "text-white/40": status === "idle",
          })}
        >
          {phaseLabel}
        </span>
        {STATUS_ICON[status]}
        {(status === "done" || status === "duplicate" || status === "error") && (
          <button
            aria-label="Remove"
            onClick={() => onRemove(item.id)}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
