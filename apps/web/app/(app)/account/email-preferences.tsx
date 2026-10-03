"use client";

import * as React from "react";
import { toast } from "sonner";
import { AccountSchema, type Account } from "@userhq/types";
import { apiFetch } from "@/lib/api-client";
import { Alert } from "@/components/ui/alert";

export interface EmailPreferencesProps {
  initialCommentEmails: boolean;
}

export function EmailPreferences({
  initialCommentEmails,
}: EmailPreferencesProps): React.JSX.Element {
  const [commentEmails, setCommentEmails] = React.useState(initialCommentEmails);
  const [isPending, setIsPending] = React.useState(false);
  const [alertError, setAlertError] = React.useState<string | null>(null);

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.checked;
    setIsPending(true);
    setAlertError(null);

    try {
      const res = await apiFetch<Account>("/api/v1/account/preferences", {
        method: "PATCH",
        body: { commentEmails: nextValue },
        schema: AccountSchema,
      });
      setCommentEmails(res.commentEmails);
      if (res.commentEmails) {
        toast.success("Comment emails turned on");
      } else {
        toast.success("Comment emails turned off");
      }
    } catch {
      // Revert on failure
      setAlertError("Something went wrong on our end. Try again in a moment.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <input
          id="comment-emails-toggle"
          type="checkbox"
          checked={commentEmails}
          onChange={handleToggle}
          disabled={isPending}
          className="size-4 mt-1 rounded border-border accent-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex flex-col gap-1">
          <label
            htmlFor="comment-emails-toggle"
            className="text-sm font-medium text-foreground cursor-pointer"
          >
            {"Email me about new comments on posts I'm part of"}
          </label>
          <p className="text-xs text-muted-foreground">
            {"At most one email a day per company, grouped by post. Posts you've muted are skipped."}
          </p>
        </div>
      </div>

      {alertError && (
        <Alert variant="destructive">
          <div>{alertError}</div>
        </Alert>
      )}
    </div>
  );
}
