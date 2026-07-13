"use client";

import { useRef, useState } from "react";
import { Plus, Tag, X } from "lucide-react";

// Backend UploadCompleteRequest caps tags at 20 items × 64 chars.
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 64;

interface TagChipInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
}

/** Chip-style tag editor shared by the local-upload and URL-import panels. */
export function TagChipInput({ tags, onChange, label = "追加到本批的标签" }: TagChipInputProps) {
  const [tagInput, setTagInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const atLimit = tags.length >= MAX_TAGS;

  function addTag() {
    const trimmed = tagInput.trim().slice(0, MAX_TAG_LENGTH);
    if (trimmed && !tags.includes(trimmed) && !atLimit) {
      onChange([...tags, trimmed]);
    }
    setTagInput("");
    inputRef.current?.focus();
  }

  function removeTag(t: string) {
    onChange(tags.filter((x) => x !== t));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter during IME composition confirms the candidate, not the tag.
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/40">
        <Tag className="h-3 w-3" /> {label}
        <span className="text-white/20">（回车或逗号添加）</span>
      </label>
      <div className="flex min-h-[42px] flex-wrap gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 focus-within:ring-1 focus-within:ring-violet-500/50">
        {tags.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs text-violet-300"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="transition-colors hover:text-violet-100"
              aria-label={`移除标签 ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => tagInput.trim() && addTag()}
          disabled={atLimit}
          placeholder={atLimit ? `最多 ${MAX_TAGS} 个标签` : tags.length === 0 ? "输入标签…" : ""}
          className="min-w-[80px] flex-1 bg-transparent text-sm text-white/70 outline-none placeholder:text-white/20"
        />
        {tagInput.trim() && (
          <button
            type="button"
            onClick={addTag}
            className="flex items-center gap-0.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-white/40 transition-colors hover:text-white/60"
          >
            <Plus className="h-3 w-3" /> 添加
          </button>
        )}
      </div>
    </div>
  );
}
