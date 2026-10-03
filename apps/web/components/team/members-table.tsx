"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type MemberRow } from "@userhq/types";
import { Table, THead, TBody, TR, TH, TD } from "../ui/table";
import { Avatar } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export interface MembersTableProps {
  ws: string;
  workspaceName: string;
  rows: MemberRow[];
  viewerId: string;
  viewerRole?: "owner" | "admin";
}

export function MembersTable({
  ws,
  workspaceName,
  rows,
  viewerId,
}: MembersTableProps) {
  const router = useRouter();
  const [memberToRemove, setMemberToRemove] = React.useState<MemberRow | null>(
    null
  );
  const [confirmLeave, setConfirmLeave] = React.useState(false);

  const handleRemove = async () => {
    if (!memberToRemove) return;
    await apiFetch(`/api/v1/workspaces/${ws}/members/${memberToRemove.userId}`, {
      method: "DELETE",
    });
    toast.success(`${memberToRemove.name} removed`);
    router.refresh();
    const h1 = document.querySelector("h1");
    if (h1) {
      if (!h1.hasAttribute("tabIndex")) {
        h1.setAttribute("tabIndex", "-1");
      }
      h1.focus();
    }
  };

  const handleLeave = async () => {
    await apiFetch(`/api/v1/workspaces/${ws}/leave`, {
      method: "POST",
    });
    window.location.assign("/");
  };

  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Role</TH>
            <TH>Joined</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => {
            const isViewer = row.userId === viewerId;
            const isOwner = row.role === "owner";

            return (
              <TR key={row.userId}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar src={row.image} name={row.name} size="sm" />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {row.name}
                        </span>
                        {isViewer && <Badge variant="outline">You</Badge>}
                      </div>
                      <span
                        className="text-sm text-muted-foreground truncate"
                        title={row.email}
                      >
                        {row.email}
                      </span>
                    </div>
                  </div>
                </TD>
                <TD>
                  <Badge variant="neutral">
                    {row.role === "owner" ? "Owner" : "Admin"}
                  </Badge>
                </TD>
                <TD className="text-muted-foreground">
                  {formatDate(row.joinedAt)}
                </TD>
                <TD className="text-right">
                  {!isOwner && !isViewer && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Remove ${row.name}`}
                      onClick={() => setMemberToRemove(row)}
                    >
                      Remove teammate
                    </Button>
                  )}
                  {!isOwner && isViewer && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label="Leave workspace"
                      onClick={() => setConfirmLeave(true)}
                    >
                      Leave workspace
                    </Button>
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <ConfirmDialog
        open={!!memberToRemove}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
        title={memberToRemove ? `Remove ${memberToRemove.name}?` : ""}
        description={`They'll lose access to ${workspaceName} right away. Anything they created stays.`}
        dismissLabel="Keep teammate"
        confirmLabel="Remove teammate"
        pendingLabel="Removing…"
        onConfirm={handleRemove}
      />

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={(open) => {
          if (!open) setConfirmLeave(false);
        }}
        title={`Leave ${workspaceName}?`}
        description="You'll lose access to its dashboard. To come back, an admin has to send you a new invite link."
        dismissLabel="Stay in workspace"
        confirmLabel="Leave workspace"
        pendingLabel="Leaving…"
        onConfirm={handleLeave}
      />
    </>
  );
}
