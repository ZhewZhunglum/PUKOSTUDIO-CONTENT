import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type BtnVariant = "primary" | "ghost" | "outline" | "destructive";
type BtnSize = "sm" | "md" | "lg";

const VARIANTS: Record<BtnVariant, string> = {
  primary:     "bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-50",
  ghost:       "text-white/50 hover:text-white/80 hover:bg-white/[0.06] disabled:opacity-40",
  outline:     "border border-white/[0.12] text-white/60 hover:border-white/[0.22] hover:text-white/80 disabled:opacity-40",
  destructive: "bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-40",
};

const SIZES: Record<BtnSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-sm gap-2 rounded-xl",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
};

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Btn({
  variant = "outline",
  size = "md",
  loading,
  icon,
  children,
  className,
  disabled,
  ...props
}: BtnProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium transition-colors",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
