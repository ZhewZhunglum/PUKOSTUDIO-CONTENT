"use client";

import { useRef, useState, useEffect } from "react";
import { Search, X, Clock, Flame, Upload as UploadIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export interface FilterState {
  search: string;
  search_mode: "keyword" | "semantic" | "hybrid";
  asset_types: number[];
  favorite: boolean | null;
  rating_gte: number | null;
  tags_any: string[];
  sort: string;
}

interface AssetFiltersProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onVisualSearch?: (file: File) => void;
}

interface ModeDef {
  value: FilterState["search_mode"] | "visual";
  label: string;
  sub: string;
  title: string;
}

const MODES: ModeDef[] = [
  { value: "hybrid", label: "混合", sub: "HYBRID", title: "融合关键词 + 语义向量（推荐）" },
  { value: "semantic", label: "语义", sub: "SEMANTIC", title: "纯向量语义搜索" },
  { value: "visual", label: "视觉", sub: "VISUAL", title: "以图搜图 — 上传图片找相似素材" },
  { value: "keyword", label: "标签", sub: "TAG", title: "模糊匹配名称、标签、OCR文字" },
];

const SORT_OPTIONS = [
  { label: "最新", value: "recency" },
  { label: "最多使用", value: "use_count" },
  { label: "评分", value: "rating" },
  { label: "名称", value: "name" },
];

interface HistoryItem {
  query: string;
  search_mode: string;
  searched_at: string;
}

interface HotItem {
  query: string;
  count: number;
}

async function fetchHistory(): Promise<HistoryItem[]> {
  const { data } = await api.get<HistoryItem[]>("/api/search/history?limit=8");
  return data;
}

async function fetchHot(): Promise<HotItem[]> {
  const { data } = await api.get<HotItem[]>("/api/search/hot?limit=6");
  return data;
}

export function AssetFilters({ filters, onChange, onVisualSearch }: AssetFiltersProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const visualInputRef = useRef<HTMLInputElement>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["search-history"],
    queryFn: fetchHistory,
    enabled: showDropdown,
    staleTime: 10_000,
  });
  const { data: hot = [] } = useQuery({
    queryKey: ["search-hot"],
    queryFn: fetchHot,
    enabled: showDropdown,
    staleTime: 30_000,
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current && !searchRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function setField<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function applyHistoryQuery(q: string) {
    setField("search", q);
    setShowDropdown(false);
    searchRef.current?.focus();
  }

  function handleVisualFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onVisualSearch) {
      onVisualSearch(file);
      e.target.value = "";
    }
  }

  function handleModeClick(m: ModeDef) {
    if (m.value === "visual") {
      visualInputRef.current?.click();
      return;
    }
    setField("search_mode", m.value);
  }

  const hasDropdownContent = history.length > 0 || hot.length > 0;

  return (
    <div className="flex items-stretch gap-2">
      {/* Search input */}
      <div className="relative flex-1">
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            height: 44,
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            transition: "border-color 0.12s",
          }}
        >
          <Search
            className="h-4 w-4"
            style={{
              position: "absolute",
              left: 14,
              color: "var(--ink-faint)",
              pointerEvents: "none",
            }}
          />
          <input
            ref={searchRef}
            type="search"
            placeholder="搜索素材… 名称、标签、OCR、语义"
            value={filters.search}
            onChange={(e) => setField("search", e.target.value)}
            onFocus={() => setShowDropdown(true)}
            style={{
              flex: 1,
              height: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "0 40px 0 40px",
              color: "var(--ink-hi)",
              fontSize: 14,
              fontFamily: "var(--font-cn)",
            }}
          />
          {filters.search && (
            <button
              onClick={() => setField("search", "")}
              style={{
                position: "absolute",
                right: 12,
                background: "transparent",
                border: "none",
                color: "var(--ink-faint)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="清空搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* History / hot dropdown */}
        {showDropdown && hasDropdownContent && (
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              borderRadius: 12,
              border: "1px solid var(--line-hi)",
              background: "var(--surface-2)",
              boxShadow: "0 20px 50px -10px oklch(0% 0 0 / 0.6)",
              zIndex: 50,
              overflow: "hidden",
            }}
          >
            {history.length > 0 && (
              <div style={{ borderBottom: "1px solid var(--line-lo)", padding: 8 }}>
                <p
                  className="eyebrow"
                  style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Clock className="h-3 w-3" />最近搜索
                </p>
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => applyHistoryQuery(h.query)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "none",
                      background: "transparent",
                      color: "var(--ink-mid)",
                      fontSize: 13,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "oklch(100% 0 0 / 0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Clock className="h-3 w-3 shrink-0" style={{ color: "var(--ink-faint)" }} />
                    <span className="truncate">{h.query}</span>
                  </button>
                ))}
              </div>
            )}
            {hot.length > 0 && (
              <div style={{ padding: 8 }}>
                <p
                  className="eyebrow"
                  style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Flame className="h-3 w-3" />热门搜索
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "0 8px" }}>
                  {hot.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => applyHistoryQuery(h.query)}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--accent-line)",
                        background: "var(--accent-soft)",
                        color: "var(--accent-2)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {h.query}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mode segment */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          padding: 3,
          background: "var(--surface-1)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          height: 44,
        }}
      >
        {MODES.map((m) => {
          const active =
            m.value === "visual"
              ? false
              : filters.search_mode === m.value;
          return (
            <button
              key={m.value}
              title={m.title}
              onClick={() => handleModeClick(m)}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: "0 14px",
                borderRadius: 9,
                border: "none",
                background: active ? "var(--surface-3)" : "transparent",
                color: active ? "var(--ink-hi)" : "var(--ink-mid)",
                cursor: "pointer",
                transition: "background 0.12s, color 0.12s",
                lineHeight: 1.1,
                minWidth: 56,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {m.value === "visual" && <UploadIcon className="h-3 w-3" />}
                {m.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: active ? "var(--ink-lo)" : "var(--ink-faint)",
                  marginTop: 2,
                }}
              >
                {m.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Hidden file input for visual search */}
      {onVisualSearch && (
        <input
          ref={visualInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleVisualFile}
        />
      )}

      {/* Sort */}
      <select
        value={filters.sort}
        onChange={(e) => setField("sort", e.target.value)}
        style={{
          height: 44,
          padding: "0 12px",
          borderRadius: 12,
          border: "1px solid var(--line)",
          background: "var(--surface-1)",
          color: "var(--ink-mid)",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
