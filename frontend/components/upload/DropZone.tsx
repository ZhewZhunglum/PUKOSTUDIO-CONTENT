"use client";

import { useRef, useState, DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "../../lib/utils";

interface DropZoneProps {
  onFiles: (files: FileList) => void;
  accept?: string;
}

export function DropZone({ onFiles, accept }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  return (
    <div
      role="button"
      aria-label="Upload area — click or drag files here"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 transition-all cursor-pointer select-none",
        dragging
          ? "border-violet-500 bg-violet-500/5 scale-[1.01]"
          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
      )}
    >
      <div
        className={cn(
          "rounded-full p-4 transition-colors",
          dragging ? "bg-violet-500/20" : "bg-white/5"
        )}
      >
        <UploadCloud
          className={cn(
            "h-8 w-8 transition-colors",
            dragging ? "text-violet-400" : "text-white/40"
          )}
        />
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-white/70">
          {dragging ? "释放以上传" : "拖拽文件到此处，或点击选择"}
        </p>
        <p className="mt-1 text-xs text-white/30">
          支持图片、视频、音频 · 单次最多 50 个文件
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
