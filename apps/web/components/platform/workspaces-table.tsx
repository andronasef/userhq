"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PlatformWorkspaceRow } from "@userhq/types";
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
  const [suspendingWs, setSuspendingWs] = React.useState<PlatformWorkspaceRow | null>(null);

  const handleSuspend = async () => {
    if (!suspendingWs) return;
    try {
      await apiFetch(`/api/v1/platform/workspaces/${suspendingWs.id}/suspend`, {
        method: "POST",
      });
      toast.success(`${suspendingWs.name} suspended`);
      setSuspendingWs(null);
      router.refresh();
    } catch {
      toast.error("Failed to suspend workspace");
    }
  };

  const handleLift = async (row: PlatformWorkspaceRow) => {
    try {
      await apiFetch(`/api/v1/platform/workspaces/${row.id}/suspend`, {
        method: "DELETE",
      });
      toast.success("Suspension lifted");
      router.refresh();
    } catch {
      toast.error("Failed to lift suspension");
    }
  };

  return (
    <>
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Workspace</TH>
              <TH>URL</TH>
              <TH className="text-right">Products</TH>
              <TH className="text-right">Members</TH>
              <TH className="text-right">Posts</TH>
              <TH className="text-right">Votes</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
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
                    <Badge variant="danger">Suspended</Badge>
                  ) : (
                    <Badge variant="outline">Active</Badge>
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
                      Lift suspension
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Suspend ${row.name}`}
                      onClick={() => setSuspendingWs(row)}
                    >
                      Suspend workspace
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
        title={suspendingWs ? `Suspend ${suspendingWs.name}?` : ""}
        description="Its portals will show an unavailable page and its admins lose dashboard access. No data is deleted, and you can lift the suspension at any time."
        dismissLabel="Keep workspace active"
        confirmLabel="Suspend workspace"
        pendingLabel="Suspending…"
        onConfirm={handleSuspend}
      />
    </>
  );
}
