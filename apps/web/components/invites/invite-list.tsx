"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type InviteRow } from "@userhq/types";
import { Table, THead, TBody, TR, TH, TD } from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { EmptyState } from "../empty-state";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export interface InviteListProps {
  kind: "platform" | "workspace";
  rows: InviteRow[];
  workspaceSlug?: string;
}

export function InviteList({ kind, rows, workspaceSlug }: InviteListProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [selectedInvite, setSelectedInvite] = React.useState<InviteRow | null>(
    null,
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        title={t("team.noInvitesTitle")}
        body={
          kind === "platform"
            ? "Create an invite link above to let a company set up a workspace."
            : t("team.noInvitesDesc")
        }
      />
    );
  }

  const renderStateBadge = (state: InviteRow["state"]) => {
    switch (state) {
      case "pending":
        return <Badge variant="outline">{t("team.statePending")}</Badge>;
      case "used":
        return <Badge variant="neutral">{t("team.stateUsed")}</Badge>;
      case "expired":
        return <Badge variant="neutral">{t("team.stateExpired")}</Badge>;
      case "revoked":
        return <Badge variant="neutral">{t("team.stateRevoked")}</Badge>;
    }
  };

  const renderDetails = (row: InviteRow) => {
    switch (row.state) {
      case "pending":
        return `Expires ${formatDate(row.expiresAt)}`;
      case "used":
        if (kind === "platform") {
          return `Used by ${row.usedByName ?? "Unknown"} · ${row.workspaceName ?? "Workspace"}`;
        }
        return `Used by ${row.usedByName ?? "Unknown"} on ${formatDate(row.usedAt ?? row.createdAt)}`;
      case "expired":
        return `Expired ${formatDate(row.expiresAt)}`;
      case "revoked":
        return `Revoked ${formatDate(row.revokedAt ?? row.createdAt)}`;
    }
  };

  const handleRevoke = async () => {
    if (!selectedInvite) return;
    const endpoint =
      kind === "platform"
        ? `/api/v1/platform/invites/${selectedInvite.id}`
        : `/api/v1/workspaces/${workspaceSlug}/invites/${selectedInvite.id}`;
    await apiFetch(endpoint, {
      method: "DELETE",
    });
    toast.success(t("team.inviteRevokedToast"));
    router.refresh();
  };

  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>{t("team.emailLabel")}</TH>
            <TH>{t("apiKeys.colStatus")}</TH>
            <TH>Details</TH>
            <TH className="text-right">{t("team.colActions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id}>
              <TD className="max-w-xs truncate" title={row.email}>
                <span className="font-medium text-foreground">{row.email}</span>
              </TD>
              <TD>{renderStateBadge(row.state)}</TD>
              <TD className="text-muted-foreground">{renderDetails(row)}</TD>
              <TD className="text-right">
                {row.state === "pending" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={`${t("team.revokeInvite")} ${row.email}`}
                    onClick={() => setSelectedInvite(row)}
                  >
                    {t("team.revokeInvite")}
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <ConfirmDialog
        open={!!selectedInvite}
        onOpenChange={(open) => {
          if (!open) setSelectedInvite(null);
        }}
        title={t("team.revokeDialogTitle")}
        description={
          selectedInvite
            ? `The link for ${selectedInvite.email} stops working right away. You can create a new one at any time.`
            : ""
        }
        dismissLabel={t("common.cancel")}
        confirmLabel={t("team.revokeInvite")}
        pendingLabel={t("common.deleting")}
        onConfirm={handleRevoke}
      />
    </>
  );
}
