"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { PublicPostRow, PublicBoardPage, MergeResult } from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { errorCopy } from "@/lib/api-errors";
import { postHref } from "@/lib/tenant";

export interface MergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: string;
  product: string;
  post: {
    number: number;
    title: string;
    voteCount: number;
    slug?: string;
  };
  variant?: "portal" | "dashboard";
}

export function MergeDialog({
  open,
  onOpenChange,
  ws,
  product,
  post,
  variant = "portal",
}: MergeDialogProps): React.JSX.Element {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PublicPostRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedTarget, setSelectedTarget] = React.useState<PublicPostRow | null>(null);
  const [isMerging, setIsMerging] = React.useState(false);
  const [alertError, setAlertError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedTarget(null);
      setAlertError(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const trimmed = query.trim();

    const timer = setTimeout(
      () => {
        setLoading(true);
        const url = trimmed
          ? `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/posts?q=${encodeURIComponent(trimmed)}&status=all`
          : `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/posts?sort=top&status=all&limit=8`;

        apiFetch<PublicBoardPage>(url)
          .then((res) => {
            if (!cancelled) {
              setResults(res.posts.filter((p) => p.number !== post.number));
              setLoading(false);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setResults([]);
              setLoading(false);
            }
          });
      },
      trimmed ? 300 : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, ws, product, post.number]);

  const handleMerge = async () => {
    if (!selectedTarget || isMerging) return;
    setIsMerging(true);
    setAlertError(null);

    try {
      const res = await apiFetch<MergeResult>(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/posts/${post.number}/merge`,
        {
          method: "POST",
          body: { targetNumber: selectedTarget.number },
        }
      );

      toast.success("Posts merged");
      onOpenChange(false);

      if (variant === "dashboard") {
        router.push(
          `/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/board/${res.number}`
        );
      } else {
        router.push(postHref(ws, product, res.number, res.slug));
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "merge_target_invalid") {
          setAlertError("Cannot merge into this post. It may be deleted, already merged, or invalid.");
        } else if (err.code === "post_not_found") {
          setAlertError("This post was removed or merged. Go back to the board.");
        } else {
          setAlertError(errorCopy(err));
        }
      } else {
        setAlertError("Something went wrong on our end. Try again in a moment.");
      }
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge into another post</DialogTitle>
        </DialogHeader>

        {alertError && (
          <Alert variant="destructive" className="mb-4">
            {alertError}
          </Alert>
        )}

        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="merge-search-input"
                className="text-sm font-medium text-foreground"
              >
                Find the post to keep
              </label>
              <Input
                id="merge-search-input"
                type="search"
                autoFocus
                placeholder={`Search posts in ${product}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div
              role="status"
              aria-live="polite"
              className="sr-only"
            >
              {`${results.length} posts found`}
            </div>

            <div className="max-h-72 overflow-y-auto flex flex-col gap-2">
              {loading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Searching…
                </div>
              ) : results.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {query.trim()
                    ? `No posts match "${query.trim()}".`
                    : "No posts yet."}
                </div>
              ) : (
                results.map((r) => (
                  <button
                    key={r.number}
                    type="button"
                    onClick={() => {
                      setSelectedTarget(r);
                      setStep(2);
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-md hover:bg-muted text-left border border-border transition-colors cursor-pointer"
                  >
                    <span className="w-12 text-center text-sm font-semibold tabular-nums text-foreground">
                      {r.voteCount}
                    </span>
                    <span className="flex-1 text-sm font-medium line-clamp-2 text-foreground">
                      {r.title}
                    </span>
                    <StatusBadge
                      name={r.status.name}
                      color={r.status.color}
                    />
                  </button>
                ))
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-border p-4">
                <div className="text-sm font-semibold truncate text-foreground">
                  &ldquo;{post.title}&rdquo;
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {post.voteCount} {post.voteCount === 1 ? "vote" : "votes"}
                </div>
              </div>

              <div className="flex justify-center my-1">
                <ArrowDown className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>

              {selectedTarget && (
                <div className="rounded-lg border border-border p-4">
                  <div className="text-sm font-semibold truncate text-foreground">
                    &ldquo;{selectedTarget.title}&rdquo;
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {selectedTarget.voteCount}{" "}
                    {selectedTarget.voteCount === 1 ? "vote" : "votes"}
                  </div>
                </div>
              )}
            </div>

            {selectedTarget && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                Votes and comments move to &ldquo;{selectedTarget.title}&rdquo;.
                People who voted on both are counted once. The link to &ldquo;
                {post.title}&rdquo; will open &ldquo;{selectedTarget.title}
                &rdquo; instead. This can&rsquo;t be undone.
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={isMerging}
              >
                Choose another post
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleMerge}
                disabled={isMerging}
              >
                {isMerging && (
                  <LoaderCircle className="size-4 animate-spin mr-2" />
                )}
                {isMerging ? "Merging…" : "Merge posts"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
