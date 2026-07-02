"use client";

import { ExternalLink, Settings, Users2 } from "lucide-react";

export default function BloggerManagerPage() {
  const ugcUrl = process.env.NEXT_PUBLIC_UGC_URL?.trim() ?? "";
  const configured = ugcUrl.length > 0;

  return (
    <div className="flex flex-1 flex-col items-center justify-center h-full" style={{ minHeight: "60vh" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: "var(--accent-soft)",
          display: "grid", placeItems: "center",
        }}>
          <Users2 size={26} style={{ color: "var(--accent)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700,
            color: "var(--ink-hi)", marginBottom: 8,
          }}>
            UGC 红人建联系统
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-lo)", margin: "0 0 24px", maxWidth: 320, lineHeight: 1.6 }}>
            UGC 建联现在作为独立工作台运行。ContentForge 只保留外部入口，
            内容生产与建联系统各自保持清晰边界。
          </p>
          {configured ? (
            <a
              href={ugcUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 8,
                background: "var(--accent)", color: "oklch(15% 0 0)",
                fontSize: 13.5, fontWeight: 700, textDecoration: "none",
                transition: "opacity 120ms",
              }}
            >
              <ExternalLink size={15} />
              打开 UGC 建联系统
            </a>
          ) : (
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 16px", borderRadius: 8,
                background: "oklch(100% 0 0 / 0.04)",
                border: "1px solid var(--line)",
                color: "var(--ink-mid)",
                fontSize: 13,
              }}
            >
              <Settings size={15} />
              配置 NEXT_PUBLIC_UGC_URL 后启用入口
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-lo)" }}>
            {configured ? ugcUrl : "NEXT_PUBLIC_UGC_URL 未配置"}
          </div>
        </div>
      </div>
    </div>
  );
}
