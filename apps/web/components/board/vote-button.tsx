import * as React from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoteButtonProps {
  ws: string;
  product: string;
  number: number;
  title: string;
  voteCount: number;
  voted: boolean;
  signedIn?: boolean;
  className?: string;
}

export function VoteButton({
  title,
  voteCount,
  voted,
  className,
}: VoteButtonProps): React.JSX.Element {
  const formattedCount =
    voteCount >= 1000
      ? new Intl.NumberFormat("en", { notation: "compact" }).format(voteCount)
      : String(voteCount);

  const voteLabel =
    voteCount === 1 ? "1 vote" : `${voteCount} votes`;
  const ariaLabel = title
    ? `Upvote ${title}, ${voteLabel}`
    : voteLabel;

  return (
    <button
      type="button"
      aria-pressed={voted}
      aria-label={ariaLabel}
      className={cn(
        "w-12 h-14 rounded-md border flex flex-col items-center justify-center gap-1 shrink-0 transition-colors select-none",
        voted
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-[var(--primary-text)] hover:bg-muted",
        className
      )}
    >
      <ChevronUp className="size-4 shrink-0" aria-hidden="true" />
      <span className="text-sm font-semibold tabular-nums leading-none">
        {formattedCount}
      </span>
    </button>
  );
}
