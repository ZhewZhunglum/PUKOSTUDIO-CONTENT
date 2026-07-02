import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ icon, title, subtitle, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold text-white/90">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-white/40">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
