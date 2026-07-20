"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Plus, Tag, X } from "lucide-react";
import { listTags } from "../../lib/api/tags";
import { cn } from "../../lib/utils";

// Backend UploadCompleteRequest caps tags at 20 items × 64 chars.
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 64;
const SUGGESTION_DEBOUNCE_MS = 200;

interface TagChipInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
}

type SuggestionItem = { name: string; useCount: number; isNew: false } | { name: string; isNew: true };

/**
 * Chip-style tag editor shared by the local-upload and URL-import panels.
 *
 * Prefers linking existing tags from the dictionary over free-typed entries:
 * typing opens an autocomplete dropdown of matching tags (or, with an empty
 * box, the most-used tags to browse). Creating a brand-new tag is still
 * possible but is a distinct, explicit row rather than the default action.
 */
export function TagChipInput({ tags, onChange, label = "追加到本批的标签" }: TagChipInputProps) {
  const [tagInput, setTagInput] = useState("");
  const [debouncedInput, setDebouncedInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const atLimit = tags.length >= MAX_TAGS;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedInput(tagInput.trim()), SUGGESTION_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [tagInput]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [debouncedInput]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectedLower = new Set(tags.map((t) => t.toLowerCase()));

  const { data: matches = [], isFetching } = useQuery({
    queryKey: ["tags", "suggest", debouncedInput],
    queryFn: () => listTags({ search: debouncedInput || undefined, limit: 8 }),
    enabled: showDropdown && !atLimit,
    staleTime: 10_000,
  });

  const existingSuggestions: SuggestionItem[] = matches
    .filter((t) => !selectedLower.has(t.name.toLowerCase()))
    .map((t) => ({ name: t.name, useCount: t.use_count, isNew: false }));

  const trimmedInput = tagInput.trim().slice(0, MAX_TAG_LENGTH);
  const hasExactMatch = existingSuggestions.some((s) => s.name.toLowerCase() === trimmedInput.toLowerCase());
  const canCreateNew = trimmedInput.length > 0 && !hasExactMatch && !selectedLower.has(trimmedInput.toLowerCase());

  const items: SuggestionItem[] = canCreateNew
    ? [...existingSuggestions, { name: trimmedInput, isNew: true }]
    : existingSuggestions;

  function addTag(name: string) {
    const trimmed = name.trim().slice(0, MAX_TAG_LENGTH);
    if (trimmed && !selectedLower.has(trimmed.toLowerCase()) && !atLimit) {
      onChange([...tags, trimmed]);
    }
    setTagInput("");
    setShowDropdown(false);
    inputRef.current?.focus();
  }

  function removeTag(t: string) {
    onChange(tags.filter((x) => x !== t));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter during IME composition confirms the candidate, not the tag.
    if (e.nativeEvent.isComposing) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length > 0) setHighlightedIndex((i) => (i + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length > 0) setHighlightedIndex((i) => (i - 1 + items.length) % items.length);
      return;
    }
    if (e.key === "Escape") {
      setShowDropdown(false);
      return;
    }
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const picked = items[highlightedIndex] ?? items[0];
      if (picked) addTag(picked.name);
      else if (e.key === ",") addTag(tagInput);
      return;
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/40">
        <Tag className="h-3 w-3" /> {label}
        <span className="text-white/20">（从现有标签中选择，或输入以新建）</span>
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
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          disabled={atLimit}
          placeholder={atLimit ? `最多 ${MAX_TAGS} 个标签` : tags.length === 0 ? "搜索或输入标签…" : ""}
          className="min-w-[80px] flex-1 bg-transparent text-sm text-white/70 outline-none placeholder:text-white/20"
        />
      </div>

      {showDropdown && !atLimit && (items.length > 0 || isFetching) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#161320] p-1.5 shadow-[0_18px_50px_oklch(0%_0_0_/_0.35)]">
          {isFetching && items.length === 0 && (
            <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-white/30">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 搜索标签中…
            </div>
          )}
          {!debouncedInput && items.length > 0 && (
            <div className="px-2.5 pb-1 pt-0.5 text-[10px] uppercase tracking-wider text-white/25">常用标签</div>
          )}
          {items.map((item, index) => (
            <button
              key={item.isNew ? `__create_${item.name}` : item.name}
              type="button"
              // Prevent input blur before the click handler fires.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(item.name)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                index === highlightedIndex ? "bg-violet-500/20 text-violet-100" : "text-white/65 hover:bg-white/[0.06]"
              )}
            >
              {item.isNew ? (
                <>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  <span className="min-w-0 flex-1 truncate">
                    创建新标签 <span className="font-medium text-white/85">“{item.name}”</span>
                  </span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0 text-white/25" />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.useCount > 0 && (
                    <span className="shrink-0 font-mono text-[10px] text-white/25">{item.useCount}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
