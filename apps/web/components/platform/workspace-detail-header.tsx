"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EntityLogo } from "../entity-logo";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { portalHref } from "@/lib/tenant";

export interface WorkspaceDetailHeaderProps {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  suspended: boolean;
}

export function WorkspaceDetailHeader({
  id,
  name,
  slug,
  logoUrl,
  suspended,
}: WorkspaceDetailHeaderProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleSuspend = async () => {
    try {
      await apiFetch(`/api/v1/platform/workspaces/${id}/suspend`, {
        method: "POST",
      });
      toast.success(`${name} suspended`);
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to suspend workspace");
    }
  };

  const handleLift = async () => {
    try {
      await apiFetch(`/api/v1/platform/workspaces/${id}/suspend`, {
        method: "DELETE",
      });
      toast.success("Suspension lifted");
      router.refresh();
    } catch {
      toast.error("Failed to lift suspension");
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
      <div className="flex items-center gap-4">
        <EntityLogo src={logoUrl} name={name} size={40} />
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
            {suspended ? (
              <Badge variant="danger">Suspended</Badge>
            ) : (
              <Badge variant="outline">Active</Badge>
            )}
          </div>
          <Link
            href={portalHref(slug)}
            className="font-mono text-sm text-muted-foreground hover:underline"
          >
            /{slug}
          </Link>
        </div>
      </div>

      <div>
        {suspended ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLift}
          >
            Lift suspension
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Suspend ${name}`}
            onClick={() => setConfirmOpen(true)}
          >
            Suspend workspace
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Suspend ${name}?`}
        description="Its portals will show an unavailable page and its admins lose dashboard access. No data is deleted, and you can lift the suspension at any time."
        dismissLabel="Keep workspace active"
        confirmLabel="Suspend workspace"
        pendingLabel="Suspending…"
        onConfirm={handleSuspend}
      />
    </div>
  );
}
