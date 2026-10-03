"use client";

import * as React from "react";
import type { Voter, VoterPage } from "@userhq/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface VoterListProps {
  ws: string;
  product: string;
  postNumber: number;
  initial?: VoterPage;
}

export function VoterList({
  ws,
  product,
  postNumber,
  initial,
}: VoterListProps) {
  const [voters, setVoters] = React.useState<Voter[]>(initial?.voters ?? []);
  const [nextCursor, setNextCursor] = React.useState<string | null>(
    initial ? (initial.nextCursor ?? null) : null
  );
  const [loading, setLoading] = React.useState(!initial);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initial) {
      setVoters(initial.voters);
      setNextCursor(initial.nextCursor ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch<VoterPage>(
      `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/posts/${postNumber}/voters`
    )
      .then((data) => {
        if (!cancelled) {
          setVoters(data.voters);
          setNextCursor(data.nextCursor ?? null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load voters.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ws, product, postNumber, initial]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<VoterPage>(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/posts/${postNumber}/voters?cursor=${encodeURIComponent(nextCursor)}`
      );
      setVoters((prev) => [...prev, ...data.voters]);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      // ignore or show error
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (voters.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No votes yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="divide-y divide-border">
        {voters.map((voter, index) => {
          const displayName = voter.deleted
            ? "Deleted user"
            : (voter.name ?? "Anonymous");
          return (
            <div
              key={`${voter.votedAt}-${index}`}
              className="flex items-center gap-4 h-12 px-4"
            >
              <Avatar
                src={voter.deleted ? null : voter.image}
                name={displayName}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "text-sm truncate block",
                    voter.deleted
                      ? "text-muted-foreground"
                      : "font-semibold text-foreground"
                  )}
                >
                  {displayName}
                </span>
              </div>
              <time
                dateTime={voter.votedAt}
                className="text-sm text-muted-foreground whitespace-nowrap"
              >
                {formatDate(voter.votedAt)}
              </time>
            </div>
          );
        })}
      </div>

      {nextCursor && (
        <div className="p-4 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
