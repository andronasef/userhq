import * as React from "react";
import { Laptop, Smartphone, Tablet } from "lucide-react";
import type { DeviceInfo } from "@userhq/types";

export interface DeviceBadgeProps {
  deviceInfo?: DeviceInfo | null;
  className?: string;
}

export function DeviceBadge({
  deviceInfo,
  className,
}: DeviceBadgeProps): React.JSX.Element | null {
  if (!deviceInfo) return null;

  const { browser, os, device } = deviceInfo;
  if (!browser && !os && !device) return null;

  const Icon =
    device === "Mobile"
      ? Smartphone
      : device === "Tablet"
        ? Tablet
        : Laptop;

  const details = [os, browser].filter(Boolean).join(" · ") || device;
  const fullTooltip = [device, os, browser].filter(Boolean).join(" • ");

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground bg-muted/60 border border-border/60 shrink-0 ${className ?? ""}`}
      title={fullTooltip}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate max-w-[160px] sm:max-w-[200px]">{details}</span>
    </span>
  );
}
