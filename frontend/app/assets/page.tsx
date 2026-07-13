"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Upload, Sparkles, Search, X, Image as ImageIcon,
  Video, Music, FileText, Sparkles as SparkleIcon, Film,
  Heart, Star, Folder, Tag as TagIcon, Check, Clock, Flame,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { AssetGrid } from "../../components/assets/AssetGrid";
import { BackfillCoversButton } from "../../components/assets/BackfillCoversButton";
import { BulkActionBar } from "../../components/assets/BulkActionBar";
import { AICollectDialog } from "../../components/collections/AICollectDialog";
import { getAssetFacets, searchAssets } from "../../lib/api/assets";
import { listTags, type TagOut } from "../../lib/api/tags";
import { listCollections, type Collection } from "../../lib/api/collections";
import { api } from "../../lib/api";
import { useDebounce } from "../../hooks/useDebounce";
import { useAssetSelection } from "../../hooks/useAssetSelection";
import type { AssetListItem, AssetSearchRequest } from "../../lib/types/asset";

// ── Filter state ───────────────────────────────────────────────

export type SearchMode = "keyword" | "semantic" | "hybrid";

interface FilterState {
  search: string;
  search_mode: SearchMode;
  asset_types: number[];
  favorite: boolean | null;
  rating_gte: number | null;
  tags_any: string[];
  sort: string;
}

const DEFAULT_FILTERS: FilterState = {
  search: "",
  search_mode: "hybrid",
  asset_types: [],
  favorite: null,
  rating_gte: null,
  tags_any: [],
  sort: "recency",
};

function buildSearchRequest(filters: FilterState, cursor?: number): AssetSearchRequest {
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

// ── Type meta ──────────────────────────────────────────────────

const TYPE_META: Record<number, { label: string; Icon: React.ElementType; hue: number }> = {
  1: { label: "图片",  Icon: ImageIcon,  hue: 295 },
  2: { label: "视频",  Icon: Video,      hue: 195 },
  3: { label: "音频",  Icon: Music,      hue: 75 },
  4: { label: "字幕",  Icon: FileText,   hue: 155 },
  9: { label: "AI",   Icon: SparkleIcon, hue: 235 },
  10: { label: "成片", Icon: Film,        hue: 12 },
};

const SEARCH_MODES: { value: SearchMode; label: string; sub: string }[] = [
  { value: "hybrid",   label: "混合",   sub: "语义+关键词" },
  { value: "semantic", label: "语义",   sub: "向量相似度" },
  { value: "keyword",  label: "关键词", sub: "模糊匹配" },
];

const TAG_HUES = [12, 35, 75, 130, 175, 210, 245, 280, 320];

// ── Filter rail ────────────────────────────────────────────────

function FilterRail({
  filters, onChange,
  typesCount,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  typesCount: Record<number, number>;
}) {
  const { data: tags = [] } = useQuery({
    queryKey: ["tags-rail"],
    queryFn: () => listTags({ limit: 14 }),
    staleTime: 60_000,
  });
  const { data: collections = [] } = useQuery({
    queryKey: ["collections-rail"],
    queryFn: () => listCollections(8, 0),
    staleTime: 60_000,
  });

  const topTags = useMemo(
    () => tags.slice().sort((a, b) => b.use_count - a.use_count).slice(0, 12),
    [tags]
  );

  function setField<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }
  function toggleType(t: number) {
    const next = filters.asset_types.includes(t)
      ? filters.asset_types.filter((x) => x !== t)
      : [...filters.asset_types, t];
    setField("asset_types", next);
  }
  function toggleTag(name: string) {
    const next = filters.tags_any.includes(name)
      ? filters.tags_any.filter((x) => x !== name)
      : [...filters.tags_any, name];
    setField("tags_any", next);
  }

  return (
    <aside
      style={{
        width: 240, flexShrink: 0,
        border: "1px solid var(--line)",
        borderRadius: 16,
        background: "oklch(100% 0 0 / 0.035)",
        padding: "24px 16px",
        overflow: "auto",
        height: "100%",
      }}
    >
      {/* Type */}
      <Section title="类型" en="TYPE">
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {Object.entries(TYPE_META).map(([k, v]) => {
            const num = Number(k);
            const sel = filters.asset_types.includes(num);
            const count = typesCount[num] ?? 0;
            const Ic = v.Icon;
            return (
              <button
                key={k}
                onClick={() => toggleType(num)}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "7px 8px", borderRadius: 7,
                  background: sel ? "oklch(100% 0 0 / 0.04)" : "transparent",
                  border: `1px solid ${sel ? "var(--line-hi)" : "transparent"}`,
                  cursor: "pointer",
                  color: sel ? "var(--ink-hi)" : "var(--ink-mid)",
                  fontFamily: "var(--font-cn)", fontSize: 12,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!sel) (e.currentTarget as HTMLButtonElement).style.background = "oklch(100% 0 0 / 0.02)";
                }}
                onMouseLeave={(e) => {
                  if (!sel) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <Ic size={13} style={{ color: `oklch(72% 0.18 ${v.hue})` }} />
                <span style={{ flex: 1 }}>{v.label}</span>
                {count > 0 && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      color: "var(--ink-lo)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Rating + Favorite */}
      <Section title="评分" en="RATING">
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setField("rating_gte", filters.rating_gte === n ? null : n)}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                padding: 3,
                color:
                  (filters.rating_gte ?? 0) >= n
                    ? "oklch(82% 0.16 75)"
                    : "var(--ink-faint)",
                transition: "color 0.12s",
              }}
            >
              <Star
                size={14}
                fill={(filters.rating_gte ?? 0) >= n ? "currentColor" : "none"}
              />
            </button>
          ))}
          <span
            style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--ink-lo)", marginLeft: 4,
            }}
          >
            {filters.rating_gte ? `≥ ${filters.rating_gte}` : "—"}
          </span>
        </div>
        <button
          onClick={() => setField("favorite", filters.favorite ? null : true)}
          style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "7px 4px", marginTop: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 12, fontFamily: "var(--font-cn)",
            color: filters.favorite ? "var(--ink-hi)" : "var(--ink-mid)",
            width: "100%", textAlign: "left",
          }}
        >
          <span
            style={{
              width: 14, height: 14, borderRadius: 4,
              border: `1.5px solid ${filters.favorite ? "var(--accent)" : "var(--line-hi)"}`,
              background: filters.favorite ? "var(--accent)" : "transparent",
              display: "grid", placeItems: "center",
            }}
          >
            {filters.favorite && <Check size={9} strokeWidth={3} style={{ color: "oklch(15% 0 0)" }} />}
          </span>
          仅收藏
        </button>
      </Section>

      {/* Tags */}
      <Section
        title="标签"
        en="TAGS"
        right={
          filters.tags_any.length > 0 ? (
            <button
              onClick={() => setField("tags_any", [])}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: "var(--ink-lo)",
              }}
            >
              {filters.tags_any.length} 已选 ·清除
            </button>
          ) : null
        }
      >
        {topTags.length === 0 ? (
          <p style={{ fontSize: 11, color: "var(--ink-lo)", padding: "0 4px" }}>暂无标签</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {topTags.map((t, i) => {
              const sel = filters.tags_any.includes(t.name);
              const hue = TAG_HUES[(t.id ?? i) % TAG_HUES.length];
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.name)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 9px", borderRadius: 999,
                    background: sel
                      ? `oklch(70% 0.18 ${hue} / 0.18)`
                      : "var(--surface-1)",
                    border: `1px solid ${sel ? `oklch(70% 0.18 ${hue} / 0.4)` : "var(--line)"}`,
                    cursor: "pointer",
                    fontSize: 11,
                    fontFamily: "var(--font-cn)",
                    color: sel ? `oklch(78% 0.16 ${hue})` : "var(--ink-mid)",
                    transition: "all 0.12s",
                  }}
                >
                  <span>{t.name}</span>
                  {t.use_count > 0 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.6 }}>
                      {t.use_count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* Collections */}
      {collections.length > 0 && (
        <Section title="集合" en="COLLECTIONS">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {collections.map((c, i) => {
              const hue = TAG_HUES[c.id % TAG_HUES.length];
              return (
                <Link
                  key={c.id}
                  href={`/collections`}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 4px", fontSize: 12,
                    color: "var(--ink-mid)",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-hi)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-mid)")}
                >
                  <span
                    style={{
                      width: 7, height: 7, borderRadius: 2,
                      background: `oklch(70% 0.18 ${hue})`,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      display: "flex", alignItems: "center", gap: 4,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                  >
                    {c.name}
                    {c.is_smart && <SparkleIcon size={10} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      color: "var(--ink-lo)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {c.asset_count}
                  </span>
                </Link>
              );
            })}
          </div>
        </Section>
      )}
    </aside>
  );
}

function Section({
  title, en, right, children,
}: {
  title: string; en: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 10, padding: "0 4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-hi)" }}>{title}</span>
          <span className="eyebrow" style={{ fontSize: 9 }}>{en}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ── Library header (title + search) ────────────────────────────

function LibraryHeader({
  filters, onChange, totalHint, isVisualMode,
  onAICollect, onVisualSearch, onClearVisual,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  totalHint: number | null | undefined;
  isVisualMode: boolean;
  onAICollect: () => void;
  onVisualSearch: (file: File) => void;
  onClearVisual: () => void;
}) {
  const visualInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["search-history"],
    queryFn: async () => {
      const { data } = await api.get<{ query: string }[]>("/api/search/history?limit=6");
      return data;
    },
    enabled: showDropdown,
    staleTime: 10_000,
  });
  const { data: hot = [] } = useQuery({
    queryKey: ["search-hot"],
    queryFn: async () => {
      const { data } = await api.get<{ query: string; count: number }[]>("/api/search/hot?limit=6");
      return data;
    },
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

  function handleVisualFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onVisualSearch(file);
      e.target.value = "";
    }
  }

  const hasDropdownContent = history.length > 0 || hot.length > 0;

  return (
    <div
      style={{
        padding: "20px 24px 18px",
        borderBottom: "1px solid var(--line)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 20, gap: 24,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            ASSET LIBRARY
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: 36, fontWeight: 500,
              letterSpacing: "-0.03em",
              color: "var(--ink-hi)", lineHeight: 1,
            }}
          >
            素材库
            {totalHint != null && (
              <span
                style={{
                  color: "var(--ink-lo)",
                  fontFamily: "var(--font-cn)",
                  fontSize: 18, fontWeight: 400,
                  marginLeft: 12,
                }}
              >
                {isVisualMode ? "以图搜图 · " : ""}
                {totalHint.toLocaleString()}
              </span>
            )}
          </h1>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <BackfillCoversButton />
          <button
            onClick={onAICollect}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 34, padding: "0 14px",
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-line)",
              borderRadius: 10,
              color: "var(--accent)",
              fontSize: 13, fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Sparkles size={13} />
            AI 收集
          </button>
          <Link
            href="/upload"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 34, padding: "0 16px",
              background: "var(--accent)",
              color: "oklch(15% 0 0)",
              fontSize: 13, fontWeight: 600,
              borderRadius: 10, textDecoration: "none",
            }}
          >
            <Upload size={13} />
            上传
          </Link>
        </div>
      </div>

      {/* Search + modes */}
      <div style={{ display: "flex", gap: 10, position: "relative" }}>
        <div
          style={{
            flex: 1,
            display: "flex", alignItems: "center", gap: 12,
            height: 44, padding: "0 16px",
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            position: "relative",
          }}
        >
          <Search size={15} style={{ color: "var(--ink-lo)" }} />
          {isVisualMode ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, color: "var(--accent)", fontSize: 13 }}>
              <ImageIcon size={14} />
              <span>以图搜图模式 · 上传图片寻找相似素材</span>
            </div>
          ) : (
            <input
              ref={searchRef}
              value={filters.search}
              onChange={(e) => setField("search", e.target.value)}
              onFocus={() => setShowDropdown(true)}
              placeholder="搜索 · 描述你想要的素材 · 例：氛围感口红特写"
              style={{
                flex: 1, background: "transparent",
                border: "none", outline: "none",
                color: "var(--ink-hi)", fontSize: 13.5,
                fontFamily: "var(--font-cn)",
              }}
            />
          )}
          {isVisualMode ? (
            <button
              onClick={onClearVisual}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--ink-lo)",
                display: "grid", placeItems: "center",
              }}
            >
              <X size={14} />
            </button>
          ) : (
            filters.search && (
              <button
                onClick={() => setField("search", "")}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--ink-lo)", display: "grid", placeItems: "center",
                }}
              >
                <X size={14} />
              </button>
            )
          )}

          {/* Dropdown */}
          {showDropdown && hasDropdownContent && !isVisualMode && (
            <div
              ref={dropdownRef}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)", left: 0, right: 0,
                background: "var(--surface-2)",
                border: "1px solid var(--line-hi)",
                borderRadius: 12,
                boxShadow: "0 16px 48px oklch(0% 0 0 / 0.45)",
                zIndex: 30, overflow: "hidden",
              }}
            >
              {history.length > 0 && (
                <div style={{ borderBottom: "1px solid var(--line)", padding: "10px 14px" }}>
                  <p
                    className="eyebrow"
                    style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 9 }}
                  >
                    <Clock size={9} /> 最近搜索
                  </p>
                  {history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setField("search", h.query);
                        setShowDropdown(false);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", padding: "5px 0",
                        background: "transparent", border: "none",
                        cursor: "pointer", textAlign: "left",
                        fontSize: 12.5, color: "var(--ink)",
                        fontFamily: "var(--font-cn)",
                      }}
                    >
                      <Clock size={11} style={{ color: "var(--ink-faint)", flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.query}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {hot.length > 0 && (
                <div style={{ padding: "10px 14px" }}>
                  <p
                    className="eyebrow"
                    style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 9 }}
                  >
                    <Flame size={9} /> 热门搜索
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {hot.map((h, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setField("search", h.query);
                          setShowDropdown(false);
                        }}
                        style={{
                          padding: "3px 9px", borderRadius: 999,
                          background: "var(--accent-soft)",
                          border: "1px solid var(--accent-line)",
                          color: "var(--accent)",
                          fontSize: 11,
                          fontFamily: "var(--font-cn)",
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

        {/* Mode segmented (3 modes + visual button) */}
        <div
          style={{
            display: "inline-flex",
            padding: 3,
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            height: 44,
          }}
        >
          {SEARCH_MODES.map((m) => {
            const active = filters.search_mode === m.value && !isVisualMode;
            return (
              <button
                key={m.value}
                onClick={() => setField("search_mode", m.value)}
                title={m.sub}
                style={{
                  padding: "0 14px",
                  background: active ? "var(--surface-3)" : "transparent",
                  color: active ? "var(--ink-hi)" : "var(--ink-mid)",
                  border: "none", borderRadius: 9,
                  cursor: "pointer",
                  fontSize: 12, fontWeight: 500,
                  fontFamily: "var(--font-cn)",
                  display: "flex", flexDirection: "column",
                  justifyContent: "center", alignItems: "center",
                  lineHeight: 1.15, gap: 1,
                  transition: "all 0.12s",
                }}
              >
                <span>{m.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--ink-lo)" }}>
                  {m.sub}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => visualInputRef.current?.click()}
            title="以图搜图 — 上传图片寻找相似素材"
            style={{
              padding: "0 14px",
              background: isVisualMode ? "var(--accent-soft)" : "transparent",
              color: isVisualMode ? "var(--accent)" : "var(--ink-mid)",
              border: "none", borderRadius: 9,
              cursor: "pointer",
              fontSize: 12, fontWeight: 500,
              fontFamily: "var(--font-cn)",
              display: "flex", flexDirection: "column",
              justifyContent: "center", alignItems: "center",
              lineHeight: 1.15, gap: 1,
            }}
          >
            <span>视觉</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--ink-lo)" }}>
              拖图上传
            </span>
          </button>
          <input
            ref={visualInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleVisualFile}
          />
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function AssetsPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showAICollect, setShowAICollect] = useState(false);
  const debouncedFilters = useDebounce(filters, 300);
  const [visualResults, setVisualResults] = useState<AssetListItem[] | null>(null);
  const [isVisualSearching, setIsVisualSearching] = useState(false);
  const { selected, toggle, clear, count } = useAssetSelection();
  const selActive = count > 0;
  const qc = useQueryClient();
  const router = useRouter();

  // ── Upload success toast (reads ?uploaded=N from URL on mount) ──
  const [uploadToast, setUploadToast] = useState<{ count: number } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const n = parseInt(params.get("uploaded") ?? "0", 10);
    if (n > 0) {
      setUploadToast({ count: n });
      // Remove the param without a full reload
      params.delete("uploaded");
      const newSearch = params.toString();
      router.replace(window.location.pathname + (newSearch ? `?${newSearch}` : ""), { scroll: false });
      const t = setTimeout(() => setUploadToast(null), 4000);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: ["assets", debouncedFilters],
    queryFn: ({ pageParam }) =>
      searchAssets(buildSearchRequest(debouncedFilters, pageParam as number | undefined)),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    initialPageParam: undefined as number | undefined,
    enabled: visualResults === null,
  });

  const { data: facets } = useQuery({
    queryKey: ["asset-facets"],
    queryFn: getAssetFacets,
    staleTime: 120_000,
  });
  const typesCount = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(facets?.by_type ?? {}).map(([type, total]) => [Number(type), total])
      ) as Record<number, number>,
    [facets]
  );

  async function handleVisualSearch(file: File) {
    setIsVisualSearching(true);
    setVisualResults(null);
    clear();
    try {
      const form = new FormData();
      form.append("file", file);
      const types = filters.asset_types.length ? filters.asset_types.join(",") : undefined;
      const res = await api.post<AssetListItem[]>("/api/search/visual", form, {
        params: types ? { types } : {},
      });
      setVisualResults(res.data);
      qc.invalidateQueries({ queryKey: ["search-history"] });
    } catch {
      setVisualResults([]);
    } finally {
      setIsVisualSearching(false);
    }
  }

  function handleFilterChange(f: FilterState) {
    setFilters(f);
    if (visualResults !== null) setVisualResults(null);
  }

  const regularItems: AssetListItem[] = data?.pages.flatMap((p) => p.items) ?? [];
  const displayItems = visualResults ?? regularItems;
  const isVisualMode = visualResults !== null;
  const totalHint = isVisualMode ? visualResults.length : data?.pages[0]?.total_hint;

  function handleLoadMore() {
    if (!isVisualMode && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "a") {
      e.preventDefault();
      if (selActive) clear();
      else displayItems.forEach((item) => toggle(item.id));
    }
    if (e.key === "Escape") clear();
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{
        display: "flex",
        height: "100%", overflow: "hidden",
        gap: 16,
        position: "relative",
      }}
    >
      {/* Upload success toast */}
      {uploadToast && (
        <div
          style={{
            position: "fixed",
            top: 20, left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 18px",
            borderRadius: 12,
            background: "color-mix(in oklch, var(--good) 16%, oklch(14% 0 0))",
            border: "1px solid color-mix(in oklch, var(--good) 30%, transparent)",
            boxShadow: "0 8px 32px oklch(0% 0 0 / 0.4)",
            backdropFilter: "blur(12px)",
            fontSize: 13, fontWeight: 500,
            color: "var(--good)",
            animation: "slide-in-top 0.25s ease",
            whiteSpace: "nowrap",
          }}
        >
          <CheckCircle2 size={15} />
          已成功上传 {uploadToast.count} 个素材
        </div>
      )}

      <FilterRail
        filters={filters}
        onChange={handleFilterChange}
        typesCount={typesCount}
      />

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--line)", borderRadius: 16, background: "oklch(100% 0 0 / 0.025)" }}>
        <LibraryHeader
          filters={filters}
          onChange={handleFilterChange}
          totalHint={totalHint}
          isVisualMode={isVisualMode}
          onAICollect={() => setShowAICollect(true)}
          onVisualSearch={handleVisualSearch}
          onClearVisual={() => setVisualResults(null)}
        />

        <div style={{ flex: 1, overflow: "hidden", padding: "20px 24px 24px" }}>
          {isVisualSearching ? (
            <div
              style={{
                display: "flex", height: "100%",
                alignItems: "center", justifyContent: "center",
                gap: 10, fontSize: 13, color: "var(--ink-lo)",
              }}
            >
              <Sparkles size={14} className="animate-spin" />
              正在以图搜图…
            </div>
          ) : displayItems.length === 0 && !isFetchingNextPage ? (
            <div
              style={{
                display: "flex", flexDirection: "column",
                height: "100%", alignItems: "center", justifyContent: "center",
                gap: 12, color: "var(--ink-lo)",
              }}
            >
              <p style={{ fontSize: 16, margin: 0 }}>
                {isVisualMode ? "未找到相似素材" : "暂无素材"}
              </p>
              {!isVisualMode && (
                <Link
                  href="/upload"
                  style={{
                    fontSize: 13, color: "var(--accent)",
                    textDecoration: "none",
                  }}
                >
                  立即上传 →
                </Link>
              )}
            </div>
          ) : (
            <AssetGrid
              items={displayItems}
              onLoadMore={handleLoadMore}
              hasMore={!isVisualMode && !!hasNextPage}
              selected={selected}
              onToggleSelect={toggle}
              selectionActive={selActive}
            />
          )}
        </div>
      </main>

      {selActive && (
        <BulkActionBar
          selected={selected}
          onClear={clear}
          onDone={() => {
            clear();
            refetch();
          }}
        />
      )}

      {showAICollect && <AICollectDialog onClose={() => setShowAICollect(false)} />}
    </div>
  );
}
