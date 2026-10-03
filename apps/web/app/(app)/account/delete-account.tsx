"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { flash } from "@/components/ui/toaster";
import { apiFetch } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

const PLATFORM_OWNER_COPY =
  "This is the platform owner account. It's set in server configuration and can't be deleted here.";

export interface DeleteAccountProps {
  isPlatformOwner: boolean;
}

export function DeleteAccount({
  isPlatformOwner,
}: DeleteAccountProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");

  const onConfirm = async () => {
    await apiFetch("/api/v1/account/delete", {
      method: "POST",
      body: { workspaces: [] },
    });
    // Sessions are already revoked server-side; signOut clears the client state.
    await authClient.signOut().catch(() => {});
    flash("Your account was deleted");
    window.location.assign("/");
  };

  return (
    <div className="rounded-lg border border-destructive/40 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-2">
        Danger zone
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {isPlatformOwner
          ? PLATFORM_OWNER_COPY
          : 'Deleting your account removes your name, avatar, and email. Your posts and comments stay up as "Deleted user".'}
      </p>
      <Button
        type="button"
        variant="outline"
        className="text-destructive border-destructive/30"
        disabled={isPlatformOwner}
        onClick={() => {
          setTyped("");
          setOpen(true);
        }}
      >
        Delete account
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description={
          'Your posts and comments stay up, shown as "Deleted user". Your name, avatar, and email are removed, and you\'ll stop getting emails. This can\'t be undone.'
        }
        dismissLabel="Keep my account"
        confirmLabel="Delete account"
        pendingLabel="Deleting…"
        onConfirm={onConfirm}
        confirmDisabled={typed.trim() !== "DELETE"}
      >
        <label
          htmlFor="delete-account-confirm"
          className="text-sm font-medium text-foreground block mb-1.5"
        >
          Type DELETE to confirm
        </label>
        <Input
          id="delete-account-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </ConfirmDialog>
    </div>
  );
}
