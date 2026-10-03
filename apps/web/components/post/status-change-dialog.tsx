"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { PostStatus, StatusChangeResult } from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { errorCopy } from "@/lib/api-errors";

export interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: string;
  product: string;
  postNumber: number;
  currentStatusId: string;
  version: number;
  statuses: PostStatus[];
}

export function StatusChangeDialog({
  open,
  onOpenChange,
  ws,
  product,
  postNumber,
  currentStatusId,
  version,
  statuses,
}: StatusChangeDialogProps): React.JSX.Element {
  const router = useRouter();
  const [selectedStatusId, setSelectedStatusId] = React.useState(currentStatusId);
  const [note, setNote] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [alertError, setAlertError] = React.useState<string | null>(null);
  const [isConflict, setIsConflict] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSelectedStatusId(currentStatusId);
      setNote("");
      setAlertError(null);
      setIsConflict(false);
    }
  }, [open, currentStatusId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStatusId === currentStatusId || isSaving) return;

    setIsSaving(true);
    setAlertError(null);
    setIsConflict(false);

    try {
      const res = await apiFetch<StatusChangeResult>(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/posts/${postNumber}/status`,
        {
          method: "PUT",
          body: {
            statusId: selectedStatusId,
            note: note.trim() || undefined,
            version,
          },
        }
      );

      const targetStatus = statuses.find((s) => s.id === selectedStatusId);
      toast.success(`Status changed to ${targetStatus?.name ?? res.status.name}`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "edit_conflict") {
        setIsConflict(true);
        setAlertError(
          "Someone else changed this while you were editing. Reload to see their version, then try again."
        );
      } else if (err instanceof ApiClientError && err.code === "post_not_found") {
        setAlertError("This post was removed or merged. Go back to the board.");
      } else if (err instanceof ApiClientError) {
        setAlertError(errorCopy(err));
      } else {
        setAlertError("Something went wrong on our end. Try again in a moment.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isChanged = selectedStatusId !== currentStatusId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
          </DialogHeader>

          {alertError && (
            <Alert variant="destructive">
              <div className="flex items-center justify-between gap-2">
                <p>{alertError}</p>
                {isConflict && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.refresh()}
                  >
                    Reload
                  </Button>
                )}
              </div>
            </Alert>
          )}

          <div className="flex flex-col gap-4">
            <Field id="status-select" label="Status">
              <NativeSelect
                value={selectedStatusId}
                onChange={(e) => setSelectedStatusId(e.target.value)}
                disabled={isSaving}
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field
              id="status-note"
              label="Public note (optional)"
              helper="Shown on the post with your name."
            >
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isSaving}
                maxLength={1000}
                placeholder="Share context on why the status changed…"
              />
            </Field>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Discard changes
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={!isChanged || isSaving}
            >
              {isSaving ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  <span>Saving…</span>
                </>
              ) : (
                "Change status"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
