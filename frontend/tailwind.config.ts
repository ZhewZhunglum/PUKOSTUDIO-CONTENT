import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
        cn:      ["Inter", "PingFang SC", "Noto Sans SC", "sans-serif"],
      },
      colors: {
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent-hsl))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        sidebar: {
          DEFAULT:    "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border:     "hsl(var(--sidebar-border))",
          accent:     "hsl(var(--sidebar-accent))",
        },
        /* ── Design system tokens ── */
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
          4: "var(--surface-4)",
        },
        ink: {
          hi:    "var(--ink-hi)",
          mid:   "var(--ink-mid)",
          lo:    "var(--ink-lo)",
          faint: "var(--ink-faint)",
          DEFAULT: "var(--ink)",
        },
        cf: {
          accent:  "var(--accent)",
          good:    "var(--good)",
          warn:    "var(--warn)",
          bad:     "var(--bad)",
          info:    "var(--info)",
        },
      },
      borderRadius: {
        lg:  "var(--radius)",
        md:  "calc(var(--radius) - 2px)",
        sm:  "calc(var(--radius) - 4px)",
        xl:  "14px",
        "2xl": "20px",
      },
      boxShadow: {
        card:  "0 2px 16px oklch(0% 0 0 / 0.45)",
        popup: "0 8px 32px oklch(0% 0 0 / 0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
