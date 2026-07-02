"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";

// ── Page metadata ──────────────────────────────────────────────

const PAGE_META: Record<string, { zh: string; en: string }> = {
  "/":                { zh: "总览",     en: "OVERVIEW" },
  "/assets":          { zh: "素材库",   en: "LIBRARY" },
  "/productions":     { zh: "成片库",   en: "PRODUCTIONS" },
  "/upload":          { zh: "上传素材", en: "UPLOAD" },
  "/tags":            { zh: "标签",     en: "TAGS" },
  "/collections":     { zh: "集合",     en: "COLLECTIONS" },
  "/ai/one-click":    { zh: "一键成片", en: "ONE-CLICK" },
  "/ai/script":       { zh: "AI 脚本", en: "SCRIPT" },
  "/ai/image":        { zh: "AI 图片", en: "IMAGE" },
  "/ai/video":        { zh: "AI 视频", en: "VIDEO" },
  "/ai/analyzer":     { zh: "爆款解析", en: "ANALYZER" },
  "/templates":       { zh: "模板中心", en: "TEMPLATES" },
  "/stats":           { zh: "数据看板", en: "STATS" },
  "/blogger-manager": { zh: "红人管理", en: "BLOGGERS" },
  "/projects":        { zh: "项目",     en: "PROJECTS" },
  "/skus":            { zh: "商品",     en: "SKUS" },
  "/brands":          { zh: "品牌",     en: "BRANDS" },
  "/settings":        { zh: "设置",     en: "SETTINGS" },
};

function resolvePageMeta(pathname: string) {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  // dynamic routes: /assets/123 etc.
  const base = "/" + pathname.split("/").slice(1, 3).join("/");
  return PAGE_META[base] ?? { zh: pathname, en: pathname.toUpperCase() };
}

// ── Search dialog ──────────────────────────────────────────────

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/assets?q=${encodeURIComponent(q.trim())}`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: "18vh" }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          borderRadius: 16,
          border: "1px solid var(--line-hi)",
          background: "var(--surface-2)",
          boxShadow: "0 24px 64px oklch(0% 0 0 / 0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={submit} className="flex items-center gap-3 px-4 py-3">
          <Search size={14} style={{ color: "var(--ink-lo)", flexShrink: 0 }} />
          <input
            ref={ref}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索素材、标签、成片…"
            style={{
              flex: 1, background: "transparent",
              border: "none", outline: "none",
              fontSize: 14, color: "var(--ink)",
              fontFamily: "var(--font-cn)",
            }}
          />
          {q && (
            <button type="button" onClick={() => setQ("")}>
              <X size={13} style={{ color: "var(--ink-lo)" }} />
            </button>
          )}
        </form>
        <div style={{ borderTop: "1px solid var(--line)", padding: "8px 16px" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-lo)" }}>
            回车 → 素材库 · Esc 关闭
            <span style={{ marginLeft: 20, opacity: 0.6 }}>混合 · 语义 · 视觉 · 标签</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Topbar ─────────────────────────────────────────────────────

async function fetchHealth() {
  const res = await api.get<Record<string, string>>("/healthz");
  return res.data;
}

async function fetchOverview() {
  try {
    const res = await api.get<{ ai_calls?: { total_cost_usd?: number } }>("/api/stats/overview");
    return res.data;
  } catch {
    return null;
  }
}

export function Topbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  // null on server, set client-side to avoid SSR ↔ hydration mismatch
  const [now, setNow] = useState<Date | null>(null);
  const pathname = usePathname();

  const openSearch  = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Live clock — initialised + updated only on the client
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ⌘K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") closeSearch();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeSearch]);

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: overview } = useQuery({
    queryKey: ["stats-overview"],
    queryFn: fetchOverview,
    staleTime: 60_000,
  });

  const isOk = health?.status === "ok";
  const cost = overview?.ai_calls?.total_cost_usd;
  const meta = resolvePageMeta(pathname);

  const hh = now ? String(now.getHours()).padStart(2, "0") : "--";
  const mm = now ? String(now.getMinutes()).padStart(2, "0") : "--";

  return (
    <>
      <header
        style={{
          height: 56, flexShrink: 0,
          borderBottom: "1px solid var(--line)",
          background: "var(--surface-0)",
          display: "flex", alignItems: "center",
          padding: "0 24px", gap: 18,
        }}
      >
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10, color: "var(--ink-lo)",
              letterSpacing: "0.18em",
            }}
          >
            / &nbsp; {meta.en}
          </span>
        </div>

        {/* Search */}
        <button
          onClick={openSearch}
          style={{
            flex: 1, maxWidth: 480,
            display: "flex", alignItems: "center", gap: 10,
            height: 34, padding: "0 12px",
            background: "oklch(100% 0 0 / 0.03)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            color: "var(--ink-lo)",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "var(--font-cn)",
            textAlign: "left",
            transition: "border-color 0.12s, color 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line-hi)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-mid)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-lo)";
          }}
        >
          <Search size={13} />
          <span style={{ flex: 1 }}>搜索素材、标签、成片…</span>
          <span style={{ opacity: 0.45, fontSize: 11 }}>语义 / 视觉 / 标签</span>
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Right indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* AI cost */}
          {cost != null && (
            <>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11, color: "var(--ink-mid)",
                  display: "flex", gap: 5, alignItems: "baseline",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span style={{ color: "var(--ink-lo)", fontSize: 9, letterSpacing: "0.15em" }}>AI</span>
                <span>${cost.toFixed(3)}</span>
              </div>
              <Divider />
            </>
          )}

          {/* System status */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-mid)" }}>
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: health ? (isOk ? "var(--good)" : "var(--warn)") : "var(--ink-faint)",
                boxShadow: health && isOk ? "0 0 8px var(--good)" : undefined,
              }}
            />
            <span style={{ color: "var(--ink-lo)", fontSize: 11 }}>
              {!health ? "连接中" : isOk ? "All systems" : "降级"}
            </span>
          </div>

          <Divider />

          {/* Clock */}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11, color: "var(--ink-mid)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {hh}:{mm}
          </span>
        </div>
      </header>

      {searchOpen && <SearchDialog onClose={closeSearch} />}
    </>
  );
}

function Divider() {
  return (
    <span
      style={{ width: 1, height: 18, background: "var(--line)", display: "block", flexShrink: 0 }}
    />
  );
}
