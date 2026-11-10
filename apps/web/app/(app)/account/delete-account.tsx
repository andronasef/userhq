"use client";

import * as React from "react";
import type { OwnedWorkspace } from "@userhq/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { flash } from "@/components/ui/toaster";
import { EntityLogo } from "@/components/entity-logo";
import { apiFetch, type ApiClientError } from "@/lib/api-client";
import { errorCopy } from "@/lib/api-errors";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n/context";

type Choice = { action: "transfer" | "delete"; toUserId: string } | undefined;
type Step = "closed" | "workspaces" | "confirm";

export interface DeleteAccountProps {
  isPlatformOwner: boolean;
  ownedWorkspaces: OwnedWorkspace[];
}

export function DeleteAccount({
  isPlatformOwner,
  ownedWorkspaces,
}: DeleteAccountProps): React.JSX.Element {
  const { t } = useI18n();
  const [step, setStep] = React.useState<Step>("closed");
  const [typed, setTyped] = React.useState("");
  const [choices, setChoices] = React.useState<Record<string, Choice>>({});
  const [stepError, setStepError] = React.useState<string | undefined>();
  const bounced = React.useRef(false);

  const resolved = ownedWorkspaces.every((w) => {
    const c = choices[w.slug];
    return c && (c.action === "delete" || c.toUserId !== "");
  });

  const summary = ownedWorkspaces.map((w) => {
    const c = choices[w.slug];
    if (c?.action === "transfer") {
      const to = w.members.find((m) => m.userId === c.toUserId)?.name ?? "";
      return t("account.ownershipGoesTo", { name: w.name, target: to });
    }
    return t("account.deletedWithContent", { name: w.name });
  });

  const onConfirm = async () => {
    try {
      await apiFetch("/api/v1/account/delete", {
        method: "POST",
        body: {
          workspaces: ownedWorkspaces.map((w) => ({
            slug: w.slug,
            action: choices[w.slug]!.action,
            ...(choices[w.slug]!.action === "transfer"
              ? { toUserId: choices[w.slug]!.toUserId }
              : {}),
          })),
        },
      });
    } catch (err) {
      const e = err as ApiClientError;
      if (
        e.code === "owned_workspaces_unresolved" ||
        e.code === "transfer_target_invalid"
      ) {
        // The server message names the workspace for transfer_target_invalid.
        setStepError(
          e.code === "transfer_target_invalid" && e.message
            ? e.message
            : errorCopy(e)
        );
        bounced.current = true;
        setTyped("");
        setStep("workspaces");
        return;
      }
      throw err;
    }
    // Sessions are already revoked server-side; signOut clears the client state.
    await authClient.signOut().catch(() => {});
    flash(t("account.accountDeletedFlash"));
    window.location.assign("/");
  };

  const start = () => {
    setTyped("");
    setStepError(undefined);
    setChoices({});
    setStep(ownedWorkspaces.length > 0 ? "workspaces" : "confirm");
  };

  const setChoice = (slug: string, c: Choice) =>
    setChoices((prev) => ({ ...prev, [slug]: c }));

  return (
    <div className="rounded-lg border border-destructive/40 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-2">
        {t("account.dangerZoneTitle")}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {isPlatformOwner
          ? t("account.platformOwnerCopy")
          : t("account.deleteAccountDesc")}
      </p>
      <Button
        type="button"
        variant="outline"
        className="text-destructive border-destructive/30"
        disabled={isPlatformOwner}
        onClick={start}
      >
        {t("account.deleteAccountBtn")}
      </Button>

      <Dialog
        open={step === "workspaces"}
        onOpenChange={(open) => {
          if (!open) setStep("closed");
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("account.workspacesModalTitle")}</DialogTitle>
            <DialogDescription>
              {t("account.workspacesModalDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto py-1">
            {ownedWorkspaces.map((w) => {
              const choice = choices[w.slug];
              const alone = w.members.length === 0;
              const groupId = `owned-${w.slug}`;
              return (
                <div
                  key={w.slug}
                  className="rounded-md border border-border p-3 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <EntityLogo src={w.logoUrl} name={w.name} size={32} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {w.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("account.productsAndPosts", {
                          products: w.productCount,
                          posts: w.postCount,
                        })}
                      </div>
                    </div>
                  </div>

                  <div
                    role="radiogroup"
                    aria-label={t("account.whatHappensTo", { name: w.name })}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex flex-col gap-1.5">
                      <label
                        className={`flex items-center gap-2 text-sm ${alone ? "text-muted-foreground" : "text-foreground"}`}
                      >
                        <input
                          type="radio"
                          name={groupId}
                          className="size-4 accent-foreground"
                          disabled={alone}
                          checked={choice?.action === "transfer"}
                          onChange={() =>
                            setChoice(w.slug, { action: "transfer", toUserId: "" })
                          }
                        />
                        {t("account.transferOwnershipTo")}
                      </label>
                      {alone ? (
                        <p className="text-xs text-muted-foreground pl-6">
                          {t("account.noOtherMembers")}
                        </p>
                      ) : (
                        <div className="pl-6">
                          <NativeSelect
                            aria-label={t("account.newOwnerAria", { name: w.name })}
                            disabled={choice?.action !== "transfer"}
                            value={choice?.toUserId ?? ""}
                            onChange={(e) =>
                              setChoice(w.slug, {
                                action: "transfer",
                                toUserId: e.target.value,
                              })
                            }
                          >
                            <option value="">{t("account.chooseMember")}</option>
                            {w.members.map((m) => (
                              <option key={m.userId} value={m.userId}>
                                {m.name}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="radio"
                          name={groupId}
                          className="size-4 accent-foreground"
                          checked={choice?.action === "delete"}
                          onChange={() =>
                            setChoice(w.slug, { action: "delete", toUserId: "" })
                          }
                        />
                        {t("account.deleteWorkspaceRadio")}
                      </label>
                      <p className="text-sm text-destructive pl-6">
                        {t("account.deleteWorkspaceWarn")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {stepError && <Alert variant="destructive">{stepError}</Alert>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("closed")}
            >
              {t("account.keepMyAccount")}
            </Button>
            <Button
              type="button"
              disabled={!resolved}
              onClick={() => {
                setStepError(undefined);
                setStep("confirm");
              }}
            >
              {t("account.continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={step === "confirm"}
        onOpenChange={(open) => {
          if (open) return;
          if (bounced.current) {
            bounced.current = false;
            return;
          }
          setStep("closed");
        }}
        title={t("account.confirmDeleteTitle")}
        description={t("account.confirmDeleteDesc")}
        dismissLabel={t("account.keepMyAccount")}
        confirmLabel={t("account.deleteAccountBtn")}
        pendingLabel={t("account.deletingAccount")}
        onConfirm={onConfirm}
        confirmDisabled={typed.trim() !== "DELETE"}
      >
        {summary.length > 0 && (
          <ul className="mb-3 list-disc pl-5 text-sm text-foreground">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <label
          htmlFor="delete-account-confirm"
          className="text-sm font-medium text-foreground block mb-1.5"
        >
          {t("account.typeDeleteToConfirm")}
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
