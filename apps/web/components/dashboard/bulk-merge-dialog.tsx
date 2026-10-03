"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { AdminPostRow, MergeResult } from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { errorCopy } from "@/lib/api-errors";
import { cn } from "@/lib/utils";

export interface BulkMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: string;
  product: string;
  posts: AdminPostRow[];
  onSuccess?: () => void;
}

export function BulkMergeDialog({
  open,
  onOpenChange,
  ws,
  product,
  posts,
  onSuccess,
}: BulkMergeDialogProps): React.JSX.Element {
  const router = useRouter();
  const [selectedKeepNumber, setSelectedKeepNumber] = React.useState<number | null>(null);
  const [isMerging, setIsMerging] = React.useState(false);
  const [alertError, setAlertError] = React.useState<string | null>(null);

  // Preselect the post with the most votes
  React.useEffect(() => {
    if (open && posts.length > 0) {
      const sorted = [...posts].sort((a, b) => b.voteCount - a.voteCount);
      setSelectedKeepNumber(sorted[0]?.number ?? null);
      setAlertError(null);
    }
  }, [open, posts]);

  const handleMerge = async () => {
    if (!selectedKeepNumber || isMerging) return;

    const mergeNumbers = posts
      .map((p) => p.number)
      .filter((n) => n !== selectedKeepNumber);
    const keepPost = posts.find((p) => p.number === selectedKeepNumber);

    setIsMerging(true);
    setAlertError(null);

    try {
      const res = await apiFetch<MergeResult>(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/posts/merge`,
        {
          method: "POST",
          body: {
            keepNumber: selectedKeepNumber,
            mergeNumbers,
          },
        }
      );

      const targetTitle = keepPost?.title ?? `post #${res.number}`;
      toast.success(`${posts.length} posts merged into "${targetTitle}"`);
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "merge_target_invalid") {
          setAlertError("Cannot merge into this post. It may be deleted, already merged, or invalid.");
        } else if (err.code === "post_not_found") {
          setAlertError("One or more posts were removed or merged. Refresh the page.");
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
          <DialogTitle>Merge {posts.length} posts</DialogTitle>
        </DialogHeader>

        {alertError && (
          <Alert variant="destructive" className="mb-4">
            {alertError}
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground mb-1">
              Keep this post
            </legend>
            <div
              role="radiogroup"
              aria-label="Keep this post"
              className="flex flex-col gap-2 max-h-60 overflow-y-auto"
            >
              {posts.map((p) => (
                <label
                  key={p.number}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer",
                    selectedKeepNumber === p.number
                      ? "border-primary bg-muted/60"
                      : "border-border hover:bg-muted/30"
                  )}
                >
                  <input
                    type="radio"
                    name="keep-post"
                    value={p.number}
                    checked={selectedKeepNumber === p.number}
                    onChange={() => setSelectedKeepNumber(p.number)}
                    className="size-4 accent-foreground"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-foreground">
                      {p.title}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {p.voteCount} {p.voteCount === 1 ? "vote" : "votes"} ·{" "}
                      {p.commentCount}{" "}
                      {p.commentCount === 1 ? "comment" : "comments"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-sm text-muted-foreground leading-relaxed">
            The other posts&rsquo; votes and comments move to the post you keep,
            and their links will open it. People who voted on more than one are
            counted once. This can&rsquo;t be undone.
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isMerging}
            >
              Keep all posts
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleMerge}
              disabled={isMerging || !selectedKeepNumber}
            >
              {isMerging && (
                <LoaderCircle className="size-4 animate-spin mr-2" />
              )}
              {isMerging ? "Merging…" : "Merge posts"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
