"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Check, Sparkles as SparkleIcon } from "lucide-react";
import Link from "next/link";
import { listTags } from "../../lib/api/tags";
import { listCollections } from "../../lib/api/collections";
import { TYPE_META, TAG_HUES, type FilterState } from "./libraryFilters";

interface FilterRailProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  typesCount: Record<number, number>;
}

/** Left rail on the asset library page: type/rating/tag/collection filters. */
export function FilterRail({ filters, onChange, typesCount }: FilterRailProps) {
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
            {collections.map((c) => {
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
