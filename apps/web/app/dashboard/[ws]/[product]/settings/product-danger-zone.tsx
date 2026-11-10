"use client";

import * as React from "react";
import type { ProductDetail } from "@userhq/types";
import { Button } from "../../../../../components/ui/button";
import { Field } from "../../../../../components/ui/field";
import { Input } from "../../../../../components/ui/input";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { flash } from "../../../../../components/ui/toaster";
import { useI18n } from "../../../../../lib/i18n/context";
import { apiFetch } from "../../../../../lib/api-client";

export interface ProductDangerZoneProps {
  ws: string;
  product: ProductDetail;
}

export function ProductDangerZone({ ws, product }: ProductDangerZoneProps) {
  const { t } = useI18n();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setConfirmText("");
    }
  };

  const handleDelete = async () => {
    await apiFetch(`/api/v1/workspaces/${ws}/products/${product.slug}`, {
      method: "DELETE",
    });
    flash(t("settings.deletedSuccess", { name: product.name }));
    window.location.assign(`/dashboard/${ws}`);
  };

  const isConfirmed = confirmText.trim() === product.name;

  return (
    <div className="rounded-lg border border-destructive/30 p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-destructive">
          {t("settings.dangerZoneHeading")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settings.dangerZoneDesc")}
        </p>
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDialogOpen(true)}
          className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        >
          {t("settings.deleteProduct")}
        </Button>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        title={t("settings.deleteProductConfirmTitle", { name: product.name })}
        description={t("settings.deleteProductConfirmDesc")}
        dismissLabel={t("settings.keepProduct")}
        confirmLabel={t("settings.deleteProduct")}
        pendingLabel={t("settings.deleting")}
        confirmDisabled={!isConfirmed}
        onConfirm={handleDelete}
      >
        <Field
          id="confirm-delete-product"
          label={t("settings.typeToConfirm", { name: product.name })}
        >
          <Input
            id="confirm-delete-product"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={product.name}
            autoComplete="off"
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
