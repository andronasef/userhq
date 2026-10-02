import * as React from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "../../lib/utils.js";

export interface AlertProps {
  variant: "destructive" | "success";
  title?: string;
  className?: string;
  children: React.ReactNode;
}

export function Alert({
  variant,
  title,
  className,
  children,
}: AlertProps): React.JSX.Element {
  const isDestructive = variant === "destructive";
  const Icon = isDestructive ? CircleAlert : CircleCheck;

  return (
    <div
      role={isDestructive ? "alert" : "status"}
      aria-live={isDestructive ? undefined : "polite"}
      className={cn(
        "rounded-lg p-4 flex gap-2 text-sm",
        isDestructive
          ? "border border-destructive/30 bg-destructive/5 text-destructive"
          : "border border-border bg-muted text-foreground",
        className
      )}
    >
      <Icon className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-1 w-full text-left">
        {title && <div className="font-semibold leading-tight">{title}</div>}
        <div className="text-sm font-normal">{children}</div>
      </div>
    </div>
  );
}
