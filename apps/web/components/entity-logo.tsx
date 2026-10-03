"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { initials } from "../lib/initials";

export interface EntityLogoProps {
  src?: string | null;
  name: string;
  size: 20 | 24 | 32 | 40 | 64;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_CLASSES: Record<EntityLogoProps["size"], { box: string; text: string; rounded: string }> = {
  20: { box: "size-5", text: "text-[12px]", rounded: "rounded-md" },
  24: { box: "size-6", text: "text-[12px]", rounded: "rounded-md" },
  32: { box: "size-8", text: "text-[14px]", rounded: "rounded-md" },
  40: { box: "size-10", text: "text-[16px]", rounded: "rounded-lg" },
  64: { box: "size-16", text: "text-[24px]", rounded: "rounded-lg" },
};

export function EntityLogo({ src, name, size, className, style }: EntityLogoProps) {
  const [hasError, setHasError] = React.useState(false);
  const config = SIZE_CLASSES[size] ?? SIZE_CLASSES[24];

  // Reset error state if src changes
  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  const letter = (initials(name)[0] || name.trim().charAt(0) || "?").toUpperCase();

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setHasError(true)}
        style={style}
        className={cn(
          config.box,
          config.rounded,
          "border border-border bg-background object-contain shrink-0",
          className
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        config.box,
        config.rounded,
        config.text,
        "inline-flex items-center justify-center shrink-0 font-semibold bg-[var(--entity-accent)] text-primary-foreground border border-border select-none",
        className
      )}
    >
      {letter}
    </span>
  );
}

