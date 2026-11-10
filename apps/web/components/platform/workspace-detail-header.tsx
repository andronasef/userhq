"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/context";
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
  deleted?: boolean;
}

export function WorkspaceDetailHeader({
  id,
  name,
  slug,
  logoUrl,
  suspended,
  deleted,
}: WorkspaceDetailHeaderProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleSuspend = async () => {
    try {
      await apiFetch(`/api/v1/platform/workspaces/${id}/suspend`, {
        method: "POST",
      });
      toast.success(t("platform.workspaceSuspendedToast", { name }));
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error(t("platform.suspendFailedToast"));
    }
  };

  const handleLift = async () => {
    try {
      await apiFetch(`/api/v1/platform/workspaces/${id}/suspend`, {
        method: "DELETE",
      });
      toast.success(t("platform.suspensionLiftedToast"));
      router.refresh();
    } catch {
      toast.error(t("platform.liftSuspensionFailedToast"));
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
      <div className="flex items-center gap-4">
        <EntityLogo src={logoUrl} name={name} size={40} />
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
            {deleted && <Badge variant="danger">{t("platform.stateDeleted")}</Badge>}
            {suspended ? (
              <Badge variant="danger">{t("platform.statusSuspended")}</Badge>
            ) : (
              <Badge variant="outline">{t("platform.statusActive")}</Badge>
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
            {t("platform.liftSuspension")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`${t("platform.suspendWorkspace")} ${name}`}
            onClick={() => setConfirmOpen(true)}
          >
            {t("platform.suspendWorkspace")}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("platform.suspendWorkspaceDialogTitle", { name })}
        description={t("platform.suspendWorkspaceDialogDesc")}
        dismissLabel={t("platform.keepWorkspaceActive")}
        confirmLabel={t("platform.suspendWorkspace")}
        pendingLabel={t("platform.suspending")}
        onConfirm={handleSuspend}
      />
    </div>
  );
}
