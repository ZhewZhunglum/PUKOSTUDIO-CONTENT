import { cn } from "@/lib/utils";

type PillVariant = "neutral" | "violet" | "green" | "amber" | "red" | "blue";

const VARIANTS: Record<PillVariant, string> = {
  neutral: "bg-white/[0.06] text-white/50",
  violet:  "bg-violet-500/15 text-violet-300",
  green:   "bg-green-500/15 text-green-300",
  amber:   "bg-amber-500/15 text-amber-300",
  red:     "bg-red-500/15 text-red-300",
  blue:    "bg-blue-500/15 text-blue-300",
};

interface StatusPillProps {
  label: string;
  variant?: PillVariant;
  dot?: boolean;
  className?: string;
}

export function StatusPill({ label, variant = "neutral", dot, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className
      )}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {label}
    </span>
  );
}
