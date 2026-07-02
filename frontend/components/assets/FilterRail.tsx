"use client";

import { useQuery } from "@tanstack/react-query";
import { Image as ImageIcon, Film, Music, Subtitles, Sparkles, Clapperboard, Star } from "lucide-react";
import { listTags, type TagOut } from "../../lib/api/tags";
import type { FilterState } from "./AssetFilters";

interface FilterRailProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

interface TypeOption {
  value: number;
  label: string;
  hue: number;
  Icon: typeof ImageIcon;
}

const TYPE_OPTIONS: TypeOption[] = [
  { value: 1, label: "图片", hue: 295, Icon: ImageIcon },
  { value: 2, label: "视频", hue: 195, Icon: Film },
  { value: 3, label: "音频", hue: 75, Icon: Music },
  { value: 4, label: "字幕", hue: 155, Icon: Subtitles },
  { value: 9, label: "AI", hue: 235, Icon: Sparkles },
  { value: 10, label: "成片", hue: 12, Icon: Clapperboard },
];

interface TagCountResponse extends TagOut {
  count?: number;
}

export function FilterRail({ filters, onChange }: FilterRailProps) {
  const { data: tags = [] } = useQuery({
    queryKey: ["filter-rail-tags"],
    queryFn: () => listTags({ limit: 12 }),
    staleTime: 60_000,
  });

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

  function pickRating(r: number) {
    setField("rating_gte", filters.rating_gte === r ? null : r);
  }

  return (
    <aside
      style={{
        width: 224,
        borderRight: "1px solid var(--line)",
        background: "var(--surface-1)",
        overflowY: "auto",
        flexShrink: 0,
      }}
      className="flex flex-col"
    >
      {/* Types */}
      <section style={{ padding: "20px 16px", borderBottom: "1px solid var(--line-lo)" }}>
        <div className="eyebrow mb-3">类型 TYPE</div>
        <div className="flex flex-col gap-1">
          {TYPE_OPTIONS.map(({ value, label, hue, Icon }) => {
            const active = filters.asset_types.includes(value);
            return (
              <button
                key={value}
                onClick={() => toggleType(value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: `1px solid ${active ? "var(--line-hi)" : "transparent"}`,
                  background: active ? "oklch(100% 0 0 / 0.04)" : "transparent",
                  color: active ? "var(--ink-hi)" : "var(--ink-mid)",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.12s, color 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "oklch(100% 0 0 / 0.02)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: `oklch(72% 0.18 ${hue})` }}
                />
                <span className="flex-1">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Rating */}
      <section style={{ padding: "20px 16px", borderBottom: "1px solid var(--line-lo)" }}>
        <div className="eyebrow mb-3">评分 RATING</div>
        <div className="flex items-center gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((r) => {
            const active = filters.rating_gte !== null && r <= filters.rating_gte;
            return (
              <button
                key={r}
                onClick={() => pickRating(r)}
                style={{
                  width: 26,
                  height: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: active ? "var(--warn)" : "var(--ink-faint)",
                  transition: "color 0.12s",
                }}
                aria-label={`至少 ${r} 星`}
              >
                <Star
                  className="h-4 w-4"
                  fill={active ? "currentColor" : "none"}
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
          {filters.rating_gte === null ? (
            <span
              style={{
                marginLeft: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-faint)",
              }}
            >
              —
            </span>
          ) : null}
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: filters.favorite ? "var(--ink-hi)" : "var(--ink-mid)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={!!filters.favorite}
            onChange={(e) => setField("favorite", e.target.checked ? true : null)}
            style={{ accentColor: "var(--accent)" }}
          />
          仅收藏
        </label>
      </section>

      {/* Tags */}
      <section style={{ padding: "20px 16px" }}>
        <div className="eyebrow mb-3">标签 TAGS</div>
        <div className="flex flex-wrap gap-1.5">
          {tags.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>暂无标签</span>
          )}
          {tags.map((tag: TagCountResponse, i: number) => {
            const active = filters.tags_any.includes(tag.name);
            const hue = (i * 47) % 360;
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.name)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  border: `1px solid ${
                    active ? `oklch(70% 0.18 ${hue} / 0.4)` : "var(--line)"
                  }`,
                  background: active
                    ? `oklch(70% 0.18 ${hue} / 0.18)`
                    : "var(--surface-2)",
                  color: active ? `oklch(85% 0.12 ${hue})` : "var(--ink-mid)",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  fontFamily: "var(--font-cn)",
                }}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
