"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmButtonProps {
  onConfirm: () => void;
  loading?: boolean;
  label?: string;
  confirmLabel?: string;
  className?: string;
  size?: "sm" | "md";
}

export function ConfirmButton({
  onConfirm,
  loading,
  label = "删除",
  confirmLabel = "确认删除",
  className,
  size = "md",
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);

  function handleClick() {
    if (!confirming) { setConfirming(true); return; }
    onConfirm();
  }

  const sizeClass = size === "sm"
    ? "h-7 px-2.5 text-xs gap-1.5 rounded-lg"
    : "h-9 px-3.5 text-sm gap-2 rounded-xl";

  return (
    <button
      onClick={handleClick}
      onBlur={() => setConfirming(false)}
      disabled={loading}
      className={cn(
        "inline-flex items-center font-medium transition-colors disabled:opacity-50",
        confirming
          ? "bg-red-500/25 text-red-300 hover:bg-red-500/35"
          : "bg-white/[0.04] text-white/40 hover:bg-red-500/15 hover:text-red-300",
        sizeClass,
        className
      )}
    >
      {confirming ? <AlertTriangle className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
      {confirming ? confirmLabel : label}
    </button>
  );
}
