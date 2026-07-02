"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AssetListItem } from "../../lib/types/asset";
import { AssetCard } from "./AssetCard";

interface AssetGridProps {
  items: AssetListItem[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  selected?: Set<number>;
  onToggleSelect?: (id: number) => void;
  selectionActive?: boolean;
}

export function AssetGrid({
  items,
  onLoadMore,
  hasMore,
  selected,
  onToggleSelect,
  selectionActive,
}: AssetGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(5);
  // Track locally-deleted IDs so deleted cards disappear immediately
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const update = () => {
      const width = root.clientWidth;
      if (width >= 1440) setColumns(6);
      else if (width >= 1160) setColumns(5);
      else if (width >= 900) setColumns(4);
      else if (width >= 640) setColumns(3);
      else setColumns(2);
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const visible = items.filter((a) => !deletedIds.has(a.id));
  const rows = useMemo(() => {
    const out: AssetListItem[][] = [];
    for (let i = 0; i < visible.length; i += columns) {
      out.push(visible.slice(i, i + columns));
    }
    return out;
  }, [columns, visible]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 280,
    overscan: 4,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (!hasMore || !onLoadMore || virtualRows.length === 0) return;
    const last = virtualRows[virtualRows.length - 1];
    if (last.index >= rows.length - 3) onLoadMore();
  }, [hasMore, onLoadMore, rows.length, virtualRows]);

  return (
    <div ref={scrollRef} className="h-full overflow-auto" style={{ paddingRight: 4 }}>
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: "relative",
        }}
      >
        {virtualRows.map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={(node) => {
              if (node) rowVirtualizer.measureElement(node);
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${row.start}px)`,
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: 12,
              paddingBottom: 12,
            }}
          >
            {rows[row.index]?.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={selected?.has(asset.id)}
                onToggleSelect={onToggleSelect}
                selectionActive={selectionActive}
                onDeleted={(id) => setDeletedIds((prev) => new Set(prev).add(id))}
              />
            ))}
          </div>
        ))}
      </div>
      {hasMore && (
        <div
          style={{
            padding: "16px 0", textAlign: "center",
            fontSize: 12, color: "var(--ink-faint)",
            fontFamily: "var(--font-mono)",
          }}
        >
          加载中…
        </div>
      )}
    </div>
  );
}
