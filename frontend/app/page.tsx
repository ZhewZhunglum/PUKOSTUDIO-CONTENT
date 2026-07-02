import Link from "next/link";
import { Library, Users2, ArrowRight, Sparkles } from "lucide-react";

// ── Panel ──────────────────────────────────────────────────────

interface PanelProps {
  href: string;
  external?: boolean;
  label: string;
  sub: string;
  desc: string;
  tags: string[];
  icon: React.ReactNode;
  accentHue: number;
}

function Panel({ href, external, label, sub, desc, tags, icon, accentHue }: PanelProps) {
  const accent = `oklch(72% 0.20 ${accentHue})`;
  const accentSoft = `oklch(72% 0.20 ${accentHue} / 0.12)`;
  const accentLine = `oklch(72% 0.20 ${accentHue} / 0.28)`;
  const grad = `linear-gradient(155deg, oklch(16% 0.04 ${accentHue}) 0%, oklch(11% 0.015 ${accentHue + 40}) 100%)`;

  const inner = (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        padding: "60px 48px",
        background: grad,
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        transition: "background 0.3s",
      }}
      className="portal-panel"
    >
      {/* Atmospheric glow */}
      <div
        style={{
          position: "absolute",
          top: "30%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 480, height: 480,
          borderRadius: "50%",
          background: `radial-gradient(circle, oklch(72% 0.20 ${accentHue} / 0.08) 0%, transparent 65%)`,
          pointerEvents: "none",
        }}
      />

      {/* Corner watermark */}
      <div
        style={{
          position: "absolute",
          bottom: -20, right: -10,
          fontFamily: "var(--font-display)",
          fontSize: 200,
          fontWeight: 700,
          fontStyle: "italic",
          letterSpacing: "-0.06em",
          color: `oklch(72% 0.20 ${accentHue} / 0.04)`,
          lineHeight: 1,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {accentHue === 295 ? "CF" : "UG"}
      </div>

      {/* Icon */}
      <div
        style={{
          width: 72, height: 72,
          borderRadius: 20,
          background: accentSoft,
          border: `1px solid ${accentLine}`,
          color: accent,
          display: "grid", placeItems: "center",
          marginBottom: 32,
          position: "relative", zIndex: 1,
          transition: "transform 0.25s, box-shadow 0.25s",
        }}
        className="portal-icon"
      >
        {icon}
      </div>

      {/* Eyebrow */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.20em",
          color: accent,
          marginBottom: 10,
          position: "relative", zIndex: 1,
        }}
      >
        {sub}
      </div>

      {/* Title */}
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: 48,
          fontWeight: 500,
          letterSpacing: "-0.035em",
          lineHeight: 1,
          color: "oklch(96% 0 0)",
          marginBottom: 16,
          position: "relative", zIndex: 1,
        }}
      >
        {label}
      </h2>

      {/* Description */}
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "oklch(65% 0 0)",
          lineHeight: 1.7,
          textAlign: "center",
          maxWidth: 280,
          marginBottom: 32,
          position: "relative", zIndex: 1,
        }}
      >
        {desc}
      </p>

      {/* Tags */}
      <div
        style={{
          display: "flex", gap: 8, flexWrap: "wrap",
          justifyContent: "center",
          marginBottom: 40,
          position: "relative", zIndex: 1,
        }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 10.5,
              padding: "4px 10px",
              borderRadius: 999,
              background: accentSoft,
              border: `1px solid ${accentLine}`,
              color: accent,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* CTA */}
      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "12px 24px",
          borderRadius: 12,
          background: accentSoft,
          border: `1px solid ${accentLine}`,
          color: accent,
          fontSize: 13, fontWeight: 500,
          position: "relative", zIndex: 1,
          transition: "background 0.2s",
        }}
      >
        进入 {label} <ArrowRight size={14} />
      </div>
    </div>
  );

  const linkStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    textDecoration: "none",
    minWidth: 0,
  };

  if (external) {
    return (
      <a href={href} style={linkStyle} target="_self">
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} style={linkStyle}>
      {inner}
    </Link>
  );
}

// ── Portal ─────────────────────────────────────────────────────

export default function Portal() {
  return (
    <>
      <style>{`
        .portal-panel:hover .portal-icon {
          transform: scale(1.08);
          box-shadow: 0 0 32px var(--panel-accent-soft, transparent);
        }
        .portal-panel:hover {
          filter: brightness(1.06);
        }
      `}</style>

      <div
        style={{
          display: "flex",
          height: "100vh",
          width: "100vw",
          background: "var(--surface-0)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Top-left wordmark */}
        <div
          style={{
            position: "absolute",
            top: 20, left: 28,
            zIndex: 10,
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <div
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: "var(--accent)",
              color: "oklch(15% 0 0)",
              fontFamily: "var(--font-display)",
              fontSize: 13, fontWeight: 700, letterSpacing: "-0.04em",
              display: "grid", placeItems: "center",
            }}
          >
            CF
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10, letterSpacing: "0.14em",
              color: "var(--ink-lo)",
              textTransform: "uppercase",
            }}
          >
            Studio Suite
          </span>
        </div>

        {/* Hint text at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 20, left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            fontFamily: "var(--font-mono)",
            fontSize: 10, letterSpacing: "0.10em",
            color: "oklch(40% 0 0)",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <Sparkles size={10} />
          选择一个系统进入
        </div>

        {/* Left panel — ContentForge */}
        <Panel
          href="/assets"
          label="素材库"
          sub="CONTENTFORGE"
          desc="AI 内容生产系统。管理素材、生成视频，让每一帧在十年后仍可被找到。"
          tags={["素材管理", "AI 生成", "一键成片", "向量搜索"]}
          icon={<Library size={32} />}
          accentHue={295}
        />

        {/* Divider */}
        <div
          style={{
            width: 1,
            background: "linear-gradient(to bottom, transparent 0%, oklch(30% 0 0) 20%, oklch(30% 0 0) 80%, transparent 100%)",
            flexShrink: 0,
            position: "relative", zIndex: 1,
          }}
        />

        {/* Right panel — UGC Outreach */}
        <Panel
          href="/blogger-manager"
          label="红人系统"
          sub="UGC OUTREACH"
          desc="达人外联建联工具。管理红人、发送邮件、追踪数据，智能化闭环外联流程。"
          tags={["达人管理", "邮件外联", "AI 收件箱", "数据看板"]}
          icon={<Users2 size={32} />}
          accentHue={155}
        />
      </div>
    </>
  );
}
