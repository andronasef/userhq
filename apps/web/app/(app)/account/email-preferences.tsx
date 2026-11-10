"use client";

import * as React from "react";
import { toast } from "sonner";
import { AccountSchema, type Account } from "@userhq/types";
import { apiFetch } from "@/lib/api-client";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n/context";

export interface EmailPreferencesProps {
  initialCommentEmails: boolean;
}

export function EmailPreferences({
  initialCommentEmails,
}: EmailPreferencesProps): React.JSX.Element {
  const { t } = useI18n();
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
        toast.success(t("account.commentEmailsOn"));
      } else {
        toast.success(t("account.commentEmailsOff"));
      }
    } catch {
      // Revert on failure
      setAlertError(t("account.preferencesError"));
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
            {t("account.commentEmailsLabel")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("account.commentEmailsDesc")}
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
