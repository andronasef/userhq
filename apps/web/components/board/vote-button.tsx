"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { VoteResultSchema, type VoteResult } from "@userhq/types";
import { QueryProvider } from "@/lib/query-client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
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

function VoteButtonInner({
  ws,
  product,
  number,
  title,
  voteCount,
  voted,
  signedIn = false,
  className,
}: VoteButtonProps): React.JSX.Element {
  const [optimistic, setOptimistic] = React.useState({
    voted,
    count: voteCount,
  });

  React.useEffect(() => {
    setOptimistic({ voted, count: voteCount });
  }, [voted, voteCount]);

  const desiredVotedRef = React.useRef<boolean | null>(null);
  const stateRef = React.useRef(optimistic);
  stateRef.current = optimistic;

  const mutation = useMutation({
    mutationFn: async (targetVoted: boolean) => {
      const method = targetVoted ? "PUT" : "DELETE";
      return apiFetch<VoteResult>(
        `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/posts/${number}/vote`,
        {
          method,
          schema: VoteResultSchema,
        }
      );
    },
    onMutate: async (targetVoted: boolean) => {
      const previous = { ...stateRef.current };
      const nextCount = targetVoted
        ? previous.count + 1
        : Math.max(0, previous.count - 1);
      setOptimistic({ voted: targetVoted, count: nextCount });
      return { previous };
    },
    onSuccess: (data) => {
      setOptimistic({ voted: data.voted, count: data.voteCount });
    },
    onError: (err: unknown, _targetVoted, context) => {
      if (context?.previous) {
        setOptimistic(context.previous);
      }
      if (err instanceof ApiClientError && err.code === "rate_limited") {
        toast.error("You're doing that too often. Wait a minute and try again.");
      } else {
        toast.error("Couldn't save your vote. Try again.");
      }
    },
    onSettled: (data) => {
      if (desiredVotedRef.current !== null) {
        const nextTarget = desiredVotedRef.current;
        desiredVotedRef.current = null;
        const currentServerVoted = data ? data.voted : stateRef.current.voted;
        if (nextTarget !== currentServerVoted) {
          mutation.mutate(nextTarget);
        }
      }
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!signedIn) {
      const nextUrl = window.location.pathname + window.location.search;
      window.location.assign("/login?next=" + encodeURIComponent(nextUrl));
      return;
    }

    const nextVoted = !stateRef.current.voted;

    if (mutation.isPending) {
      desiredVotedRef.current = nextVoted;
      const nextCount = nextVoted
        ? stateRef.current.count + 1
        : Math.max(0, stateRef.current.count - 1);
      setOptimistic({ voted: nextVoted, count: nextCount });
    } else {
      mutation.mutate(nextVoted);
    }
  };

  const formattedCount =
    optimistic.count >= 1000
      ? new Intl.NumberFormat("en", { notation: "compact" }).format(
          optimistic.count
        )
      : String(optimistic.count);

  const voteLabel =
    optimistic.count === 1 ? "1 vote" : `${optimistic.count} votes`;
  const ariaLabel = title ? `Upvote ${title}, ${voteLabel}` : voteLabel;

  return (
    <button
      type="button"
      aria-pressed={optimistic.voted}
      aria-label={ariaLabel}
      onClick={handleClick}
      className={cn(
        "w-12 h-14 rounded-md border flex flex-col items-center justify-center gap-1 shrink-0 transition-colors select-none",
        optimistic.voted
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

export function VoteButton(props: VoteButtonProps): React.JSX.Element {
  return (
    <QueryProvider>
      <VoteButtonInner {...props} />
    </QueryProvider>
  );
}
