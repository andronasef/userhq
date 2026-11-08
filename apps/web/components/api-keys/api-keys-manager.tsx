"use client";

import * as React from "react";
import { KeyRound, Plus, ShieldAlert, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import type { ApiKeyMetadata, ProductSummary } from "@userhq/types";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";

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
  const [keys, setKeys] = React.useState<ApiKeyMetadata[]>(initialKeys);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  // Revoke state
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKeyMetadata | null>(null);

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
      prev.map((k) => (k.id === revokeTarget.id ? { ...k, revokedAt: now } : k))
    );
    toast.success(`API key "${revokeTarget.name}" revoked`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span>Active API Keys</span>
            <Badge variant="neutral" className="text-xs">
              {keys.filter((k) => !k.revokedAt).length}
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Authenticate automated workflows, external services, and export scripts.
          </p>
        </div>

        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2 shrink-0"
          data-testid="create-api-key-btn"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Create API Key</span>
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="size-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground">No API keys created yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Generate an API key to securely interact with the UserHQ API, trigger headless workflows, or export feedback.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="mt-2"
          >
            Create API Key
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="api-keys-table">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Token Prefix</th>
                  <th scope="col" className="px-4 py-3">Scopes</th>
                  <th scope="col" className="px-4 py-3">Product Scope</th>
                  <th scope="col" className="px-4 py-3">Last Used</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map((k) => {
                  const isRevoked = Boolean(k.revokedAt);
                  const isExpired =
                    !isRevoked && k.expiresAt && new Date(k.expiresAt).getTime() < Date.now();

                  return (
                    <tr
                      key={k.id}
                      className={isRevoked ? "opacity-60 bg-muted/10" : "hover:bg-muted/20 transition-colors"}
                      data-testid={`api-key-row-${k.id}`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div>{k.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Created {new Date(k.createdAt).toLocaleDateString()}
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
                            <Badge variant="outline" className="text-[11px] border-primary/40 text-[var(--primary-text)]">
                              admin
                            </Badge>
                          ) : (
                            k.scopes.slice(0, 3).map((scope) => (
                              <Badge key={scope} variant="neutral" className="text-[11px]">
                                {scope}
                              </Badge>
                            ))
                          )}
                          {!k.scopes.includes("admin") && k.scopes.length > 3 && (
                            <Badge variant="outline" className="text-[11px]">
                              +{k.scopes.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {k.productRestrictions && k.productRestrictions.length > 0 ? (
                          <span title={k.productRestrictions.map((id) => productMap.get(id) || id).join(", ")}>
                            {k.productRestrictions.length === 1
                              ? productMap.get(k.productRestrictions[0]) || "1 product"
                              : `${k.productRestrictions.length} products`}
                          </span>
                        ) : (
                          <span className="text-foreground">All products</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                      </td>

                      <td className="px-4 py-3">
                        {isRevoked ? (
                          <Badge variant="danger" className="text-[11px] gap-1">
                            <XCircle className="size-3" aria-hidden="true" />
                            <span>Revoked</span>
                          </Badge>
                        ) : isExpired ? (
                          <Badge variant="outline" className="text-[11px] gap-1 text-amber-500 border-amber-500/40">
                            <Clock className="size-3" aria-hidden="true" />
                            <span>Expired</span>
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[11px] gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                            <CheckCircle2 className="size-3" aria-hidden="true" />
                            <span>Active</span>
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
                            Revoke
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
        title={`Revoke "${revokeTarget?.name}"?`}
        description="Any integrations, automated scripts, or webhooks using this API key will immediately fail with a 401 Unauthorized error. This action cannot be undone."
        dismissLabel="Cancel"
        confirmLabel="Revoke API Key"
        confirmVariant="destructive"
        pendingLabel="Revoking..."
        onConfirm={handleConfirmRevoke}
      />
    </div>
  );
}
