"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PlatformUserRow } from "@userhq/types";
import { useI18n } from "@/lib/i18n/context";
import { Table, THead, TBody, TR, TH, TD } from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Avatar } from "../ui/avatar";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export interface UsersTableProps {
  rows: PlatformUserRow[];
}

export function UsersTable({ rows }: UsersTableProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [banningUser, setBanningUser] = React.useState<PlatformUserRow | null>(null);

  const handleBan = async () => {
    if (!banningUser) return;
    try {
      await apiFetch(`/api/v1/platform/users/${banningUser.id}/ban`, {
        method: "POST",
      });
      toast.success(t("platform.userBannedToast", { name: banningUser.name }));
      setBanningUser(null);
      router.refresh();
    } catch {
      toast.error(t("platform.banFailedToast"));
    }
  };

  const handleLift = async (row: PlatformUserRow) => {
    try {
      await apiFetch(`/api/v1/platform/users/${row.id}/ban`, {
        method: "DELETE",
      });
      toast.success(t("platform.banLiftedToast"));
      router.refresh();
    } catch {
      toast.error(t("platform.liftBanFailedToast"));
    }
  };

  return (
    <>
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>{t("platform.colUser")}</TH>
              <TH className="text-right">{t("platform.colWorkspaces")}</TH>
              <TH className="text-right">{t("platform.colPosts")}</TH>
              <TH className="text-right">{t("platform.colVotes")}</TH>
              <TH>{t("platform.colJoined")}</TH>
              <TH>{t("platform.colStatus")}</TH>
              <TH className="text-right">{t("platform.colActions")}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar src={row.image} name={row.name} size="sm" />
                    <div>
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </div>
                  </div>
                </TD>
                <TD className="text-right tabular-nums text-muted-foreground">
                  {row.workspaceCount}
                </TD>
                <TD className="text-right tabular-nums text-muted-foreground">
                  {row.postCount}
                </TD>
                <TD className="text-right tabular-nums text-muted-foreground">
                  {row.voteCount}
                </TD>
                <TD className="text-muted-foreground">
                  {formatDate(row.createdAt)}
                </TD>
                <TD>
                  {row.banned ? (
                    <Badge variant="danger">{t("platform.statusBanned")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("platform.statusActive")}</Badge>
                  )}
                </TD>
                <TD className="text-right">
                  {row.isPlatformOwner ? (
                    <Badge variant="outline">{t("platform.badgeYou")}</Badge>
                  ) : row.banned ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLift(row)}
                    >
                      {t("platform.liftBan")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={`${t("platform.banUser")} ${row.name}`}
                      onClick={() => setBanningUser(row)}
                    >
                      {t("platform.banUser")}
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!banningUser}
        onOpenChange={(open) => {
          if (!open) setBanningUser(null);
        }}
        title={banningUser ? t("platform.banUserDialogTitle", { name: banningUser.name }) : ""}
        description={t("platform.banUserDialogDesc")}
        dismissLabel={t("platform.dontBan")}
        confirmLabel={t("platform.banUser")}
        pendingLabel={t("platform.banning")}
        onConfirm={handleBan}
      />
    </>
  );
}
