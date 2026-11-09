import * as React from "react";
import type { PublicBadgeChip } from "@userhq/types";
import {
  Crown,
  Sparkles,
  ShieldCheck,
  Star,
  Award,
  Zap,
  Flame,
  Heart,
  Medal,
  CheckCircle2,
  Gem,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BADGE_ICONS: Record<string, LucideIcon> = {
  crown: Crown,
  sparkles: Sparkles,
  shield: ShieldCheck,
  star: Star,
  award: Award,
  zap: Zap,
  flame: Flame,
  heart: Heart,
  medal: Medal,
  verified: CheckCircle2,
  gem: Gem,
  tag: Tag,
};

export interface BadgeChipProps {
  badge: PublicBadgeChip;
  size?: "sm" | "md";
  className?: string;
}

export function BadgeChip({
  badge,
  size = "sm",
  className,
}: BadgeChipProps): React.JSX.Element {
  const iconKey = badge.icon?.toLowerCase();
  const IconComponent =
    iconKey && Object.hasOwn(BADGE_ICONS, iconKey) ? BADGE_ICONS[iconKey] : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium rounded-full shrink-0 select-none shadow-xs border border-black/5 dark:border-white/10",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        className
      )}
      style={{
        backgroundColor: badge.color || "#e2e8f0",
        color: badge.textColor || "#0f172a",
      }}
      title={badge.name}
    >
      {IconComponent && <IconComponent className="size-3 shrink-0" aria-hidden="true" />}
      <span className="truncate max-w-[120px]">{badge.name}</span>
    </span>
  );
}

export { BADGE_ICONS };
