import Link from "next/link";
import {
  ArrowRight,
  BarChart2,
  Clapperboard,
  FolderOpen,
  Layers3,
  Library,
  Send,
  Settings,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";

const PRIMARY = [
  { href: "/upload", label: "上传素材", sub: "Import", icon: Upload, hue: 155 },
  { href: "/assets", label: "素材库", sub: "Library", icon: Library, hue: 295 },
  { href: "/tags", label: "标签体系", sub: "Taxonomy", icon: Layers3, hue: 210 },
  { href: "/ai/one-click", label: "一键成片", sub: "Forge", icon: Wand2, hue: 35 },
];

const SECONDARY = [
  { href: "/dashboard", label: "仪表盘", icon: BarChart2 },
  { href: "/collections", label: "集合", icon: FolderOpen },
  { href: "/productions", label: "成片库", icon: Clapperboard },
  { href: "/blogger-manager", label: "红人系统", icon: Send },
  { href: "/settings", label: "设置", icon: Settings },
];

export default function Portal() {
  return (
    <main className="min-h-screen bg-[var(--surface-0)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6">
        <header className="flex h-14 items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] font-display text-sm font-bold text-black">
              CF
            </div>
            <div>
              <h1 className="font-display text-base font-semibold tracking-normal text-white/92">ContentForge</h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Studio Operations</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm text-white/62 transition-colors hover:border-white/16 hover:text-white"
          >
            工作台
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <section className="grid flex-1 gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col justify-center">
            <div className="mb-8 max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-300/18 bg-violet-300/8 px-3 py-1 text-xs text-violet-100/80">
                <Sparkles className="h-3.5 w-3.5" />
                素材到成片的生产台
              </div>
              <h2 className="font-display text-5xl font-semibold leading-[1.05] tracking-normal text-white/95">
                先整理素材，再生产内容。
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PRIMARY.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group min-h-44 rounded-xl border border-white/[0.07] bg-white/[0.035] p-4 transition-colors hover:border-white/14 hover:bg-white/[0.055]"
                  >
                    <div
                      className="mb-8 grid h-11 w-11 place-items-center rounded-lg border"
                      style={{
                        color: `oklch(76% 0.18 ${item.hue})`,
                        background: `oklch(76% 0.18 ${item.hue} / 0.10)`,
                        borderColor: `oklch(76% 0.18 ${item.hue} / 0.22)`,
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">{item.sub}</p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white/88">{item.label}</h3>
                      <ArrowRight className="h-4 w-4 text-white/22 transition-transform group-hover:translate-x-1 group-hover:text-white/55" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <aside className="flex flex-col justify-center gap-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">Next Areas</p>
              <div className="space-y-1">
                {SECONDARY.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex h-10 items-center gap-3 rounded-lg px-2 text-sm text-white/58 transition-colors hover:bg-white/[0.055] hover:text-white/82"
                    >
                      <Icon className="h-4 w-4 text-white/32" />
                      <span className="flex-1">{item.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-white/20" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
