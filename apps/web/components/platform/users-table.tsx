"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PlatformUserRow } from "@userhq/types";
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
  const [banningUser, setBanningUser] = React.useState<PlatformUserRow | null>(null);

  const handleBan = async () => {
    if (!banningUser) return;
    try {
      await apiFetch(`/api/v1/platform/users/${banningUser.id}/ban`, {
        method: "POST",
      });
      toast.success(`${banningUser.name} banned`);
      setBanningUser(null);
      router.refresh();
    } catch {
      toast.error("Failed to ban user");
    }
  };

  const handleLift = async (row: PlatformUserRow) => {
    try {
      await apiFetch(`/api/v1/platform/users/${row.id}/ban`, {
        method: "DELETE",
      });
      toast.success("Ban lifted");
      router.refresh();
    } catch {
      toast.error("Failed to lift ban");
    }
  };

  return (
    <>
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>User</TH>
              <TH className="text-right">Workspaces</TH>
              <TH className="text-right">Posts</TH>
              <TH className="text-right">Votes</TH>
              <TH>Joined</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
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
                    <Badge variant="danger">Banned</Badge>
                  ) : (
                    <Badge variant="outline">Active</Badge>
                  )}
                </TD>
                <TD className="text-right">
                  {row.isPlatformOwner ? (
                    <Badge variant="outline">You</Badge>
                  ) : row.banned ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLift(row)}
                    >
                      Lift ban
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Ban ${row.name}`}
                      onClick={() => setBanningUser(row)}
                    >
                      Ban user
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
        title={banningUser ? `Ban ${banningUser.name}?` : ""}
        description="They'll be signed out everywhere and can't sign in until you lift the ban. Their posts and comments stay."
        dismissLabel="Don't ban"
        confirmLabel="Ban user"
        pendingLabel="Banning…"
        onConfirm={handleBan}
      />
    </>
  );
}
