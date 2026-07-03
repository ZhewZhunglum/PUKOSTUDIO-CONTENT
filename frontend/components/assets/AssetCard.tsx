"use client";

import { useRef, useState } from "react";
import { Heart, Play, FileText, Music, Check, ZoomIn, X, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import type { AssetListItem } from "../../lib/types/asset";
import { formatDuration } from "../../lib/types/asset";
import { cn } from "../../lib/utils";
import { toggleFavorite, deleteAsset } from "../../lib/api/assets";

const HUES = [12, 35, 58, 82, 132, 175, 210, 245, 278, 310, 340];

function gradientFor(seed: number): string {
  const h1 = HUES[seed % HUES.length];
  const h2 = HUES[(seed * 7 + 3) % HUES.length];
  const ang = (seed * 47) % 360;
  return `linear-gradient(${ang}deg, oklch(38% 0.16 ${h1}) 0%, oklch(22% 0.09 ${h2}) 100%)`;
}

function patternFor(seed: number): string {
  const t = seed % 4;
  if (t === 0) return `radial-gradient(circle at 20% 80%, oklch(100% 0 0 / 0.14), transparent 50%)`;
  if (t === 1) return `linear-gradient(135deg, oklch(100% 0 0 / 0.10) 0%, transparent 60%)`;
  if (t === 2) return `radial-gradient(ellipse at top, oklch(100% 0 0 / 0.10), transparent 70%)`;
  return `conic-gradient(from ${seed * 30}deg at 70% 30%, oklch(100% 0 0 / 0.12), transparent 50%)`;
}

function aspectFor(asset: AssetListItem): string {
  if (asset.width && asset.height) return `${asset.width}/${asset.height}`;
  if (asset.asset_type === 2) return "9/16";
  if (asset.asset_type === 1) return "4/5";
  return "1/1";
}

const TYPE_ICON: Record<number, React.ReactNode> = {
  2: <Play size={20} />,
  3: <Music size={20} />,
  5: <FileText size={20} />,
};

// ── Lightbox ───────────────────────────────────────────────────

function Lightbox({ asset, onClose }: { asset: AssetListItem; onClose: () => void }) {
  const isImage = asset.asset_type === 1;
  const isVideo = asset.asset_type === 2;
  const url = asset.cdn_url;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "oklch(0% 0 0 / 0.88)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20, right: 20,
          background: "oklch(100% 0 0 / 0.10)",
          border: "1px solid oklch(100% 0 0 / 0.15)",
          borderRadius: 10,
          color: "oklch(80% 0 0)",
          width: 36, height: 36,
          display: "grid", placeItems: "center",
          cursor: "pointer",
        }}
      >
        <X size={16} />
      </button>

      <div
        style={{ maxWidth: "90vw", maxHeight: "90vh", position: "relative" }}
        onClick={(e) => e.stopPropagation()}
      >
        {isImage && url ? (
          <img
            src={url}
            alt={asset.name}
            style={{
              maxWidth: "90vw",
              maxHeight: "86vh",
              objectFit: "contain",
              borderRadius: 12,
              display: "block",
            }}
          />
        ) : isVideo && url ? (
          <video
            src={url}
            controls
            autoPlay
            style={{
              maxWidth: "90vw",
              maxHeight: "86vh",
              borderRadius: 12,
              display: "block",
            }}
          />
        ) : (
          <div style={{ padding: 40, color: "oklch(60% 0 0)", fontSize: 14 }}>
            暂无预览
          </div>
        )}

        {/* Info bar */}
        <div
          style={{
            marginTop: 12,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: "oklch(72% 0 0)", fontWeight: 500 }}>
            {asset.name}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {asset.user_tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "oklch(100% 0 0 / 0.08)",
                  color: "oklch(65% 0 0)",
                  border: "1px solid oklch(100% 0 0 / 0.10)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AssetCard ──────────────────────────────────────────────────

interface AssetCardProps {
  asset: AssetListItem;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  selectionActive?: boolean;
  onDeleted?: (id: number) => void;
}

export function AssetCard({ asset, selected, onToggleSelect, selectionActive, onDeleted }: AssetCardProps) {
  const [favorite, setFavorite] = useState(asset.favorite);
  const [favPending, setFavPending] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isImage = asset.asset_type === 1;
  const isVideo = asset.asset_type === 2;
  const thumbUrl = isVideo ? (asset.thumbnail_url ?? null) : (asset.thumbnail_url ?? asset.cdn_url ?? null);
  const previewUrl = asset.cdn_url ?? null;
  // Fall back to gradient placeholder if the image fails to load
  const hasMedia = !!(thumbUrl && (isImage || isVideo) && !imgError);
  const tags = asset.user_tags.slice(0, 3);
  const aiPending = asset.ai_processing_status === 1;

  async function handleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (favPending) return;
    setFavPending(true);
    try {
      await toggleFavorite(asset.id, !favorite);
      setFavorite((f) => !f);
    } finally {
      setFavPending(false);
    }
  }

  function handleSelectClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onToggleSelect?.(asset.id);
  }

  function handlePreview(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLightboxOpen(true);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (deleting) return;
    if (!confirm(`确认删除「${asset.name}」？此操作不可恢复。`)) return;
    setDeleting(true);
    try {
      await deleteAsset(asset.id);
      onDeleted?.(asset.id);
    } catch {
      alert("删除失败，请重试");
      setDeleting(false);
    }
  }

  function handleMouseEnter() {
    if (isVideo && videoRef.current) videoRef.current.play().catch(() => undefined);
  }

  function handleMouseLeave() {
    if (isVideo && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  return (
    <>
      {lightboxOpen && (
        <Lightbox asset={asset} onClose={() => setLightboxOpen(false)} />
      )}

      <article
        className="group relative overflow-hidden"
        style={{
          aspectRatio: aspectFor(asset),
          borderRadius: 14,
          border: selected
            ? "1px solid var(--accent-line)"
            : "1px solid var(--line)",
          boxShadow: selected ? "0 0 0 1px var(--accent-soft)" : undefined,
          background: hasMedia ? "var(--surface-1)" : gradientFor(asset.id),
          transition: "border-color 0.12s",
          breakInside: "avoid",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Link
          href={`/assets/${asset.id}`}
          className="absolute inset-0 z-10"
          aria-label={`查看素材 ${asset.name}`}
        />

        {/* Media */}
        {hasMedia && isImage ? (
          <img
            src={thumbUrl!}
            alt={asset.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : hasMedia && isVideo ? (
          <>
            <img
              src={thumbUrl!}
              alt={asset.name}
              loading="lazy"
              onError={() => setImgError(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <video
              ref={videoRef}
              src={previewUrl ?? undefined}
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity group-hover:opacity-100"
            />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: patternFor(asset.id) }} />
            <div
              className="absolute"
              style={{
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                color: "oklch(100% 0 0 / 0.22)",
              }}
            >
              {TYPE_ICON[asset.asset_type] ?? null}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 6, right: 8,
                fontFamily: "var(--font-display)",
                fontSize: 96,
                fontWeight: 700,
                fontStyle: "italic",
                letterSpacing: "-0.05em",
                color: "oklch(100% 0 0 / 0.08)",
                lineHeight: 1,
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              {asset.id % 1000}
            </div>
          </>
        )}

        {/* Favorite button */}
        <button
          aria-label={favorite ? "取消收藏" : "收藏"}
          onClick={handleFavorite}
          className={cn(
            "absolute right-2 top-2 z-20 rounded-full p-1.5 backdrop-blur-sm transition-all",
            favorite
              ? "bg-black/40 text-rose-400 opacity-100"
              : "bg-transparent text-transparent opacity-0 group-hover:opacity-100 group-hover:text-white/50"
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", favorite && "fill-current")} />
        </button>

        {/* Quick preview button */}
        {hasMedia && (
          <button
            aria-label="快速预览"
            onClick={handlePreview}
            className="absolute left-2 top-2 z-20 rounded-lg p-1.5 backdrop-blur-sm bg-black/40 text-white/70 opacity-0 transition-all group-hover:opacity-100 hover:text-white hover:bg-black/60"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Delete button — bottom-left, visible on hover */}
        <button
          aria-label="删除素材"
          onClick={handleDelete}
          disabled={deleting}
          className="absolute bottom-2 left-2 z-20 rounded-lg p-1.5 backdrop-blur-sm bg-black/40 text-white/50 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/70 hover:text-white disabled:opacity-30"
        >
          {deleting
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Trash2 className="h-3 w-3" />
          }
        </button>

        {/* AI processing indicator */}
        {aiPending && (
          <div
            style={{
              position: "absolute",
              top: 8, left: hasMedia ? 36 : 8,
              zIndex: 20,
              display: "flex", alignItems: "center", gap: 3,
              padding: "2px 6px",
              borderRadius: 5,
              background: "oklch(0% 0 0 / 0.60)",
              backdropFilter: "blur(4px)",
            }}
          >
            <Loader2
              size={9}
              className="animate-spin"
              style={{ color: "oklch(75% 0.18 295)" }}
            />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "oklch(65% 0 0)" }}>
              AI
            </span>
          </div>
        )}

        {/* Selection checkbox */}
        {(selectionActive || selected) && (
          <button
            aria-label={selected ? "取消选择" : "选择"}
            onClick={handleSelectClick}
            style={{
              position: "absolute",
              left: 8, top: 8,
              zIndex: 20,
              width: 20, height: 20,
              borderRadius: 6,
              border: selected ? "2px solid var(--accent)" : "2px solid rgba(255,255,255,0.4)",
              background: selected ? "var(--accent)" : "rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.12s",
              cursor: "pointer",
            }}
          >
            {selected && <Check className="h-3 w-3 text-white" />}
          </button>
        )}

        {/* Rating dots */}
        {asset.rating > 0 && (
          <div className="absolute bottom-2 left-2 z-20 flex gap-0.5">
            {Array.from({ length: asset.rating }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "oklch(82% 0.16 75)",
                }}
              />
            ))}
          </div>
        )}

        {/* Duration badge */}
        {asset.duration_ms && (
          <span
            style={{
              position: "absolute",
              bottom: 8, right: 8,
              zIndex: 20,
              background: "rgba(0,0,0,0.72)",
              borderRadius: 5,
              padding: "2px 6px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ink-hi)",
              backdropFilter: "blur(4px)",
            }}
          >
            {formatDuration(asset.duration_ms)}
          </span>
        )}

        {/* Hover overlay: name + tags */}
        <div
          className="absolute inset-x-0 bottom-0 z-20 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            background: "linear-gradient(to top, oklch(0% 0 0 / 0.85) 0%, oklch(0% 0 0 / 0.4) 50%, transparent 100%)",
            padding: "32px 10px 10px",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "oklch(95% 0 0)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.3,
              marginBottom: tags.length ? 4 : 0,
            }}
          >
            {asset.name}
          </p>
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 9,
                    padding: "1px 5px",
                    borderRadius: 3,
                    background: "oklch(100% 0 0 / 0.15)",
                    color: "oklch(90% 0 0)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </>
  );
}
