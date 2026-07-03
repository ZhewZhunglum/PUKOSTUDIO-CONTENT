import Link from "next/link";
import {
  ArrowRight,
  BarChart2,
  Boxes,
  Clapperboard,
  Compass,
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
  { href: "/upload", label: "上传素材", sub: "INGEST", note: "拖拽、URL、批量入库", icon: Upload, hue: 155 },
  { href: "/assets", label: "素材库", sub: "LIBRARY", note: "检索、筛选、预览、收藏", icon: Library, hue: 205 },
  { href: "/tags", label: "标签体系", sub: "TAXONOMY", note: "一级、二级、三级自由整理", icon: Layers3, hue: 38 },
  { href: "/ai/one-click", label: "一键成片", sub: "FORGE", note: "脚本、分镜、生成流水线", icon: Wand2, hue: 295 },
];

const SECONDARY = [
  { href: "/dashboard", label: "仪表盘", icon: BarChart2 },
  { href: "/collections", label: "集合", icon: FolderOpen },
  { href: "/productions", label: "成片库", icon: Clapperboard },
  { href: "/blogger-manager", label: "红人系统", icon: Send },
  { href: "/settings", label: "设置", icon: Settings },
];

const RAIL = ["ASSET", "TAG", "SCRIPT", "STORYBOARD", "RENDER", "PUBLISH"];

export default function Portal() {
  return (
    <main className="studio-shell min-h-screen overflow-hidden text-white">
      <div className="studio-backdrop" />
      <div className="studio-noise" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-6">
        <header className="z-10 flex h-14 items-center justify-between border-b border-white/[0.07]">
          <Link href="/" className="flex items-center gap-3 text-white no-underline">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white text-sm font-bold text-black">
              CF
            </div>
            <div>
              <h1 className="font-display text-base font-semibold text-white/92">ContentForge</h1>
              <p className="font-mono text-[10px] uppercase text-white/35">Motion Studio OS</p>
            </div>
          </Link>
          <Link
            href="/dashboard"
            className="studio-card flex h-9 items-center gap-2 rounded-lg border border-white/12 bg-white/[0.055] px-3 text-sm text-white/68 transition-colors hover:text-white"
          >
            进入工作台
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <section className="relative grid flex-1 gap-8 py-7 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div className="z-10 min-w-0">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-300/8 px-3 py-1 text-xs text-emerald-100/82">
              <Sparkles className="h-3.5 w-3.5" />
              从素材到成片的实时生产舞台
            </div>
            <h2 className="max-w-4xl font-display text-5xl font-semibold leading-none text-white/95 sm:text-6xl lg:text-7xl">
              让素材库动起来，
              <span className="block text-white/46">让内容生产有节奏。</span>
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/54 sm:text-base">
              ContentForge 把上传、标签、检索、AI 分镜和成片流水线放在同一个控制台里。界面保持暗色 studio 气质，但操作路径更清楚、更快、更像一个可持续运转的创意系统。
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PRIMARY.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="studio-card group min-h-48 rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 text-white no-underline"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className="grid h-11 w-11 place-items-center rounded-lg border"
                        style={{
                          color: `oklch(76% 0.17 ${item.hue})`,
                          background: `oklch(76% 0.17 ${item.hue} / 0.10)`,
                          borderColor: `oklch(76% 0.17 ${item.hue} / 0.24)`,
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 text-white/25 transition-transform group-hover:translate-x-1" />
                    </div>
                    <p className="mt-7 font-mono text-[10px] text-white/30">{item.sub}</p>
                    <h3 className="mt-1 text-lg font-semibold text-white/88">{item.label}</h3>
                    <p className="mt-3 text-xs leading-5 text-white/42">{item.note}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          <aside className="z-10 flex flex-col gap-3">
            <VisualStage />
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04]">
              <div className="studio-marquee py-3">
                {[...RAIL, ...RAIL].map((item, index) => (
                  <span key={`${item}-${index}`} className="mx-5 font-mono text-[10px] text-white/35">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {SECONDARY.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="studio-card flex h-11 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-sm text-white/62 no-underline"
                  >
                    <Icon className="h-4 w-4 text-white/34" />
                    <span className="flex-1">{item.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-white/20" />
                  </Link>
                );
              })}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function VisualStage() {
  const shards = [
    { x: "8%", y: "18%", w: 82, h: 28, hue: 205, delay: "0s" },
    { x: "58%", y: "12%", w: 116, h: 34, hue: 295, delay: "-2s" },
    { x: "22%", y: "54%", w: 132, h: 42, hue: 155, delay: "-4s" },
    { x: "66%", y: "62%", w: 76, h: 76, hue: 38, delay: "-1s" },
  ];

  return (
    <div className="studio-scanline relative min-h-[420px] overflow-hidden rounded-xl border border-white/[0.08] bg-black/24">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,oklch(100%_0_0_/_0.06),transparent_34%,oklch(100%_0_0_/_0.035)_64%,transparent)]" />
      <div className="absolute inset-x-6 top-7 flex items-center justify-between">
        <span className="font-mono text-[10px] text-white/36">LIVE CONTENT MAP</span>
        <Compass className="h-4 w-4 text-white/34" />
      </div>
      <div className="absolute left-8 top-20">
        <Boxes className="h-7 w-7 text-emerald-200/78" />
      </div>
      {shards.map((shard, index) => (
        <div
          key={index}
          className="studio-shard absolute border backdrop-blur-md"
          style={{
            left: shard.x,
            top: shard.y,
            width: shard.w,
            height: shard.h,
            animationDelay: shard.delay,
            borderRadius: index === 3 ? 18 : 10,
            borderColor: `oklch(76% 0.15 ${shard.hue} / 0.26)`,
            background: `linear-gradient(135deg, oklch(76% 0.15 ${shard.hue} / 0.18), oklch(100% 0 0 / 0.035))`,
            boxShadow: `0 18px 80px oklch(0% 0 0 / 0.26)`,
          }}
        />
      ))}
      <div className="absolute bottom-8 left-6 right-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] text-white/34">PIPELINE ENERGY</p>
            <p className="mt-1 text-3xl font-semibold text-white/90">87%</p>
          </div>
          <p className="max-w-36 text-right text-xs leading-5 text-white/42">上传、标签、分镜和成片在同一条节奏线上推进。</p>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {[54, 72, 61, 88, 76, 94].map((height, index) => (
            <span
              key={index}
              className="rounded-sm bg-white/18"
              style={{
                height,
                background: index > 3 ? "var(--accent)" : index > 1 ? "var(--info)" : "var(--good)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
