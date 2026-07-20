"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, Sparkles, Search, X, Image as ImageIcon, Clock, Flame } from "lucide-react";
import Link from "next/link";
import { api } from "../../lib/api";
import { BackfillCoversButton } from "./BackfillCoversButton";
import { SEARCH_MODES, type FilterState } from "./libraryFilters";

interface LibraryHeaderProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  totalHint: number | null | undefined;
  isVisualMode: boolean;
  onAICollect: () => void;
  onVisualSearch: (file: File) => void;
  onClearVisual: () => void;
}

/** Asset library page header: title, upload/AI-collect actions, and the
 * search bar (keyword/semantic/hybrid + visual search + history/hot dropdown). */
export function LibraryHeader({
  filters, onChange, totalHint, isVisualMode,
  onAICollect, onVisualSearch, onClearVisual,
}: LibraryHeaderProps) {
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
