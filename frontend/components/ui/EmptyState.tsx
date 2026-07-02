import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-white/20">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-white/50">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-white/25">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
