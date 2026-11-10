"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PlatformWorkspaceRow } from "@userhq/types";
import { useI18n } from "@/lib/i18n/context";
import { Table, THead, TBody, TR, TH, TD } from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { EntityLogo } from "../entity-logo";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { portalHref } from "@/lib/tenant";

export interface WorkspacesTableProps {
  rows: PlatformWorkspaceRow[];
}

export function WorkspacesTable({ rows }: WorkspacesTableProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [suspendingWs, setSuspendingWs] = React.useState<PlatformWorkspaceRow | null>(null);

  const handleSuspend = async () => {
    if (!suspendingWs) return;
    try {
      await apiFetch(`/api/v1/platform/workspaces/${suspendingWs.id}/suspend`, {
        method: "POST",
      });
      toast.success(t("platform.workspaceSuspendedToast", { name: suspendingWs.name }));
      setSuspendingWs(null);
      router.refresh();
    } catch {
      toast.error(t("platform.suspendFailedToast"));
    }
  };

  const handleLift = async (row: PlatformWorkspaceRow) => {
    try {
      await apiFetch(`/api/v1/platform/workspaces/${row.id}/suspend`, {
        method: "DELETE",
      });
      toast.success(t("platform.suspensionLiftedToast"));
      router.refresh();
    } catch {
      toast.error(t("platform.liftSuspensionFailedToast"));
    }
  };

  return (
    <>
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>{t("platform.colWorkspace")}</TH>
              <TH>{t("platform.colUrl")}</TH>
              <TH className="text-right">{t("platform.colProducts")}</TH>
              <TH className="text-right">{t("platform.colMembers")}</TH>
              <TH className="text-right">{t("platform.colPosts")}</TH>
              <TH className="text-right">{t("platform.colVotes")}</TH>
              <TH>{t("platform.colStatus")}</TH>
              <TH className="text-right">{t("platform.colActions")}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link
                    href={`/platform/workspaces/${row.id}`}
                    className="inline-flex items-center gap-2.5 font-medium text-foreground hover:underline"
                  >
                    <EntityLogo src={row.logoUrl} name={row.name} size={24} />
                    <span>{row.name}</span>
                    {row.deleted && <Badge variant="danger">{t("platform.stateDeleted")}</Badge>}
                  </Link>
                </TD>
                <TD>
                  <Link
                    href={portalHref(row.slug)}
                    className="font-mono text-sm text-muted-foreground hover:underline"
                  >
                    /{row.slug}
                  </Link>
                </TD>
                <TD className="text-right tabular-nums text-muted-foreground">
                  {row.productCount}
                </TD>
                <TD className="text-right tabular-nums text-muted-foreground">
                  {row.memberCount}
                </TD>
                <TD className="text-right tabular-nums text-muted-foreground">
                  {row.postCount}
                </TD>
                <TD className="text-right tabular-nums text-muted-foreground">
                  {row.voteCount}
                </TD>
                <TD>
                  {row.suspended ? (
                    <Badge variant="danger">{t("platform.statusSuspended")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("platform.statusActive")}</Badge>
                  )}
                </TD>
                <TD className="text-right">
                  {row.suspended ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLift(row)}
                    >
                      {t("platform.liftSuspension")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={`${t("platform.suspendWorkspace")} ${row.name}`}
                      onClick={() => setSuspendingWs(row)}
                    >
                      {t("platform.suspendWorkspace")}
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!suspendingWs}
        onOpenChange={(open) => {
          if (!open) setSuspendingWs(null);
        }}
        title={suspendingWs ? t("platform.suspendWorkspaceDialogTitle", { name: suspendingWs.name }) : ""}
        description={t("platform.suspendWorkspaceDialogDesc")}
        dismissLabel={t("platform.keepWorkspaceActive")}
        confirmLabel={t("platform.suspendWorkspace")}
        pendingLabel={t("platform.suspending")}
        onConfirm={handleSuspend}
      />
    </>
  );
}
