import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  name: string;
  color: string;
  className?: string;
}

export function StatusBadge({
  name,
  color,
  className,
}: StatusBadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-xs font-medium border border-border bg-background text-foreground shrink-0",
        className
      )}
    >
      <span
        className="size-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate max-w-[120px]">{name}</span>
    </span>
  );
}
