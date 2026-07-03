"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Library, Upload, Tag, FolderOpen, Film,
  Briefcase, ShoppingBag, Building2,
  FileText, Image, Video, Zap, TrendingUp,
  LayoutTemplate, BarChart2, Settings, Users2,
  LogOut, LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  sub?: string;          // English sub-label / path key
  count?: number;
  pill?: string;         // model badge text
  live?: boolean;        // animated dot
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

// ── Nav definition ─────────────────────────────────────────────

const NAV: NavGroup[] = [
  {
    group: "WORKFLOW",
    items: [
      { href: "/dashboard",   icon: LayoutDashboard, label: "仪表盘",  sub: "Dashboard" },
      { href: "/upload",      icon: Upload,        label: "上传素材", sub: "Upload" },
      { href: "/assets",      icon: Library,       label: "素材库",   sub: "Library",     count: undefined },
      { href: "/tags",        icon: Tag,           label: "标签体系", sub: "Taxonomy" },
      { href: "/collections", icon: FolderOpen,    label: "集合",     sub: "Collections" },
    ],
  },
  {
    group: "PRODUCTION",
    items: [
      { href: "/ai/one-click", icon: Zap,        label: "一键成片", live: true },
      { href: "/productions",  icon: Film,       label: "成片库",   sub: "Productions" },
      { href: "/ai/video",     icon: Video,      label: "AI 视频",  pill: "Seedance" },
      { href: "/ai/script",    icon: FileText,   label: "AI 脚本",  pill: "Claude" },
      { href: "/ai/image",     icon: Image,      label: "AI 图片",  pill: "gpt-image-1" },
      { href: "/ai/analyzer",  icon: TrendingUp, label: "爆款解析" },
    ],
  },
  {
    group: "OPERATIONS",
    items: [
      { href: "/projects",  icon: Briefcase,      label: "项目",     sub: "Projects" },
      { href: "/brands",    icon: Building2,      label: "品牌",     sub: "Brands" },
      { href: "/skus",      icon: ShoppingBag,    label: "商品",     sub: "SKUs" },
      { href: "/templates", icon: LayoutTemplate, label: "模板中心" },
    ],
  },
  {
    group: "SYSTEM",
    items: [
      { href: "/stats",           icon: BarChart2,      label: "数据看板" },
      { href: "/blogger-manager", icon: Users2,         label: "红人管理" },
      { href: "/settings",        icon: Settings,       label: "设置" },
    ],
  },
];

// ── Sidebar ────────────────────────────────────────────────────

export function Sidebar({ onLogout }: { onLogout?: () => void }) {
  const pathname = usePathname();
  const [day, setDay] = useState(0);
  useEffect(() => {
    setDay(daysSinceStart());
  }, []);

  return (
    <aside
      style={{
        width: "var(--sidebar-w, 232px)",
        background: "oklch(7.5% 0.022 278 / 0.84)",
        borderRight: "1px solid var(--line)",
        backdropFilter: "blur(18px)",
      }}
      className="flex h-full shrink-0 flex-col shadow-[18px_0_80px_oklch(0%_0_0_/_0.22)]"
    >
      {/* ── Wordmark ── */}
      <div
        style={{ height: 56, borderBottom: "1px solid var(--line)" }}
        className="flex items-center gap-2.5 px-[18px]"
      >
        <div
          style={{
            width: 22, height: 22, borderRadius: 6,
            background: "var(--accent)",
            color: "oklch(15% 0 0)",
            fontFamily: "var(--font-display)",
            fontSize: 13, fontWeight: 700, letterSpacing: "-0.04em",
          }}
          className="grid place-items-center shrink-0"
        >
          CF
        </div>
        <div className="flex flex-col" style={{ lineHeight: 1.05 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14, fontWeight: 600,
              color: "var(--ink-hi)",
              letterSpacing: "-0.025em",
            }}
          >
            ContentForge
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9, color: "var(--ink-lo)",
              letterSpacing: "0.10em",
            }}
          >
            STUDIO BUILD
          </span>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: "10px 0 14px" }}>
        {NAV.map((group) => (
          <div key={group.group} style={{ marginBottom: 14 }}>
            {/* Group label */}
            <div
              style={{
                padding: "6px 18px 5px",
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                fontWeight: 500,
                letterSpacing: "0.22em",
                color: "var(--ink-lo)",
              }}
            >
              {group.group}
            </div>

            {/* Items */}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <NavLink key={item.href} item={item} isActive={isActive} Icon={Icon} />
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div
        style={{ borderTop: "1px solid var(--line)", padding: "10px 14px 12px" }}
        className="flex items-center gap-2.5"
      >
        {/* Avatar */}
        <div
          style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, oklch(60% 0.18 295), oklch(48% 0.15 235))",
            fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 11,
            color: "oklch(98% 0 0)",
          }}
          className="grid place-items-center"
        >
          S
        </div>
        <div className="flex-1 min-w-0" style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 11.5, color: "var(--ink)", fontWeight: 500 }}>
            sam
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-lo)" }}>
            solo · day {day}
          </div>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            title="退出登录"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 4, borderRadius: 6, flexShrink: 0,
              color: "var(--ink-lo)", display: "flex", alignItems: "center",
            }}
          >
            <LogOut size={13} />
          </button>
        )}
      </div>
    </aside>
  );
}

// ── NavLink ────────────────────────────────────────────────────

function NavLink({
  item,
  isActive,
  Icon,
}: {
  item: NavItem;
  isActive: boolean;
  Icon: React.ElementType;
}) {
  return (
    <Link
      href={item.href}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 18px",
        background: isActive ? "linear-gradient(90deg, oklch(100% 0 0 / 0.07), transparent)" : "transparent",
        color: isActive ? "var(--ink-hi)" : "var(--ink-mid)",
        fontFamily: "var(--font-cn)",
        fontSize: 12.5,
        fontWeight: isActive ? 500 : 400,
        transition: "background 0.16s, color 0.16s, transform 0.16s",
        transform: isActive ? "translateX(2px)" : "translateX(0)",
        textDecoration: "none",
      }}
      className={cn(
        "group",
        !isActive && "hover:bg-white/[0.035] hover:!text-ink hover:translate-x-0.5"
      )}
    >
      {/* Active bar */}
      {isActive && (
        <span
          style={{
            position: "absolute",
            left: 0, top: 6, bottom: 6,
            width: 2,
            background: "linear-gradient(180deg, var(--accent), var(--info), var(--good))",
            borderRadius: "0 2px 2px 0",
            boxShadow: "0 0 18px var(--accent-soft)",
          }}
        />
      )}

      <Icon
        size={14}
        style={{ color: isActive ? "var(--accent)" : "currentColor", flexShrink: 0 }}
      />

      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {item.label}
      </span>

      {/* Count badge */}
      {item.count != null && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10, color: "var(--ink-lo)",
            letterSpacing: 0, fontVariantNumeric: "tabular-nums",
          }}
        >
          {item.count.toLocaleString()}
        </span>
      )}

      {/* Live dot */}
      {item.live && (
        <span
          style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: "0 0 0 3px var(--accent-soft)",
            animation: "pulse-glow 1.6s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
      )}

      {/* Model pill */}
      {item.pill && !item.live && !item.count && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9, color: "var(--ink-lo)",
            letterSpacing: 0, flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {item.pill}
        </span>
      )}
    </Link>
  );
}

// ── Helpers ────────────────────────────────────────────────────

/** Project start date — adjust if needed */
const PROJECT_START = new Date("2024-01-01");

function daysSinceStart(): number {
  const now = new Date();
  const diff = now.getTime() - PROJECT_START.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
