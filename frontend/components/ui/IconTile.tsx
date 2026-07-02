import { cn } from "@/lib/utils";

type TileColor = "violet" | "amber" | "rose" | "green" | "blue" | "neutral";

const COLORS: Record<TileColor, string> = {
  violet:  "bg-violet-500/15 text-violet-400",
  amber:   "bg-amber-500/15 text-amber-400",
  rose:    "bg-rose-500/15 text-rose-400",
  green:   "bg-green-500/15 text-green-400",
  blue:    "bg-blue-500/15 text-blue-400",
  neutral: "bg-white/[0.06] text-white/50",
};

interface IconTileProps {
  icon: React.ReactNode;
  color?: TileColor;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function IconTile({ icon, color = "violet", size = "md", className }: IconTileProps) {
  const sizeClass = size === "sm" ? "h-7 w-7 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-2xl" : "h-9 w-9 rounded-xl";
  return (
    <div className={cn("flex shrink-0 items-center justify-center", COLORS[color], sizeClass, className)}>
      {icon}
    </div>
  );
}
