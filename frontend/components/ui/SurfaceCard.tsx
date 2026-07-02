import { cn } from "@/lib/utils";

interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Slightly higher elevation — more visible border */
  raised?: boolean;
  /** Remove padding for full-bleed content */
  noPad?: boolean;
}

export function SurfaceCard({ className, raised, noPad, ...props }: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        raised
          ? "border-white/[0.10] bg-white/[0.04]"
          : "border-white/[0.06] bg-card",
        !noPad && "p-5",
        className
      )}
      {...props}
    />
  );
}
