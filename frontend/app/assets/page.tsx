"use client";

import { useState, useEffect, useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Sparkles, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { AssetGrid } from "../../components/assets/AssetGrid";
import { BulkActionBar } from "../../components/assets/BulkActionBar";
import { FilterRail } from "../../components/assets/FilterRail";
import { LibraryHeader } from "../../components/assets/LibraryHeader";
import { AICollectDialog } from "../../components/collections/AICollectDialog";
import { getAssetFacets, searchAssets } from "../../lib/api/assets";
import { api } from "../../lib/api";
import { useDebounce } from "../../hooks/useDebounce";
import { useAssetSelection } from "../../hooks/useAssetSelection";
import type { AssetListItem } from "../../lib/types/asset";
import { DEFAULT_FILTERS, buildSearchRequest, type FilterState } from "../../components/assets/libraryFilters";

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
