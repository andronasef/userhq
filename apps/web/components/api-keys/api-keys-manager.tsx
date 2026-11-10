"use client";

import * as React from "react";
import { KeyRound, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import type { ApiKeyMetadata, ProductSummary } from "@userhq/types";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { useI18n } from "../../lib/i18n/context";
import { apiFetch } from "../../lib/api-client";

export interface WorkspaceApiKeysManagerProps {
  ws: string;
  initialKeys: ApiKeyMetadata[];
  products: ProductSummary[];
}

export function WorkspaceApiKeysManager({
  ws,
  initialKeys,
  products,
}: WorkspaceApiKeysManagerProps): React.JSX.Element {
  const { t, locale } = useI18n();
  const [keys, setKeys] = React.useState<ApiKeyMetadata[]>(initialKeys);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  // Revoke state
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKeyMetadata | null>(
    null,
  );

  const productMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.id) map.set(p.id, p.name);
    }
    return map;
  }, [products]);

  const handleKeyCreated = (newKey: ApiKeyMetadata) => {
    setKeys((prev) => [newKey, ...prev]);
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;

    await apiFetch(`/api/v1/workspaces/${ws}/api-keys/${revokeTarget.id}`, {
      method: "DELETE",
    });

    const now = new Date().toISOString();
    setKeys((prev) =>
      prev.map((k) =>
        k.id === revokeTarget.id ? { ...k, revokedAt: now } : k,
      ),
    );
    toast.success(t("apiKeys.keyRevoked"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span>{t("apiKeys.title")}</span>
            <Badge variant="neutral" className="text-xs">
              {keys.filter((k) => !k.revokedAt).length}
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("apiKeys.description")}
          </p>
        </div>

        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2 shrink-0"
          data-testid="create-api-key-btn"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>{t("apiKeys.createKey")}</span>
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="size-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground">
              {t("apiKeys.emptyTitle")}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {t("apiKeys.emptyDesc")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="mt-2"
          >
            {t("apiKeys.createKey")}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table
              className="w-full text-left text-sm"
              data-testid="api-keys-table"
            >
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    {t("apiKeys.colName")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("apiKeys.colPrefix")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("apiKeys.colScopes")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("apiKeys.colProductScope")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("apiKeys.colLastUsed")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("apiKeys.colStatus")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    {t("apiKeys.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map((k) => {
                  const isRevoked = Boolean(k.revokedAt);
                  const isExpired =
                    !isRevoked &&
                    k.expiresAt &&
                    new Date(k.expiresAt).getTime() < Date.now();

                  return (
                    <tr
                      key={k.id}
                      className={
                        isRevoked
                          ? "opacity-60 bg-muted/10"
                          : "hover:bg-muted/20 transition-colors"
                      }
                      data-testid={`api-key-row-${k.id}`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div>{k.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(k.createdAt).toLocaleDateString(locale)}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        <span className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                          {k.keyPrefix}••••••••
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {k.scopes.includes("admin") ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] border-primary/40 text-[var(--primary-text)]"
                            >
                              admin
                            </Badge>
                          ) : (
                            k.scopes.slice(0, 3).map((scope) => (
                              <Badge
                                key={scope}
                                variant="neutral"
                                className="text-[11px]"
                              >
                                {scope}
                              </Badge>
                            ))
                          )}
                          {!k.scopes.includes("admin") &&
                            k.scopes.length > 3 && (
                              <Badge variant="outline" className="text-[11px]">
                                +{k.scopes.length - 3}
                              </Badge>
                            )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {k.productRestrictions &&
                        k.productRestrictions.length > 0 ? (
                          <span
                            title={k.productRestrictions
                              .map((id) => productMap.get(id) || id)
                              .join(", ")}
                          >
                            {k.productRestrictions.length === 1
                              ? productMap.get(k.productRestrictions[0]) ||
                                t("apiKeys.oneProduct")
                              : t("apiKeys.multipleProducts", {
                                  count: k.productRestrictions.length,
                                })}
                          </span>
                        ) : (
                          <span className="text-foreground">
                            {t("apiKeys.allProducts")}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {k.lastUsedAt
                          ? new Date(k.lastUsedAt).toLocaleDateString(locale)
                          : t("apiKeys.neverUsed")}
                      </td>

                      <td className="px-4 py-3">
                        {isRevoked ? (
                          <Badge variant="danger" className="text-[11px] gap-1">
                            <XCircle className="size-3" aria-hidden="true" />
                            <span>{t("apiKeys.statusRevoked")}</span>
                          </Badge>
                        ) : isExpired ? (
                          <Badge
                            variant="outline"
                            className="text-[11px] gap-1 text-amber-500 border-amber-500/40"
                          >
                            <Clock className="size-3" aria-hidden="true" />
                            <span>{t("apiKeys.statusExpired")}</span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="neutral"
                            className="text-[11px] gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          >
                            <CheckCircle2
                              className="size-3"
                              aria-hidden="true"
                            />
                            <span>{t("apiKeys.statusActive")}</span>
                          </Badge>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {!isRevoked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRevokeTarget(k)}
                            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2.5"
                            data-testid={`revoke-api-key-btn-${k.id}`}
                          >
                            {t("apiKeys.revokeAction")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Key Dialog */}
      <CreateApiKeyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        ws={ws}
        products={products}
        onKeyCreated={handleKeyCreated}
      />

      {/* Revoke Key Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title={t("apiKeys.revokeTitle", { name: revokeTarget?.name ?? "" })}
        description={t("apiKeys.revokeDialogDesc")}
        dismissLabel={t("common.cancel")}
        confirmLabel={t("apiKeys.revokeAction")}
        confirmVariant="destructive"
        pendingLabel={t("common.deleting")}
        onConfirm={handleConfirmRevoke}
      />
    </div>
  );
}
