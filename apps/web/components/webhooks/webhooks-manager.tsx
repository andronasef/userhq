"use client";

import * as React from "react";
import {
  Webhook,
  Plus,
  Send,
  History,
  Trash2,
  Power,
  Copy,
  Check,
  Eye,
  EyeOff,
  Activity,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import type { WebhookSubscription, ProductSummary } from "@userhq/types";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { CreateWebhookDialog } from "./create-webhook-dialog";
import { WebhookDeliveriesDialog } from "./webhook-deliveries-dialog";
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";

export interface WorkspaceWebhooksManagerProps {
  ws: string;
  initialSubscriptions: WebhookSubscription[];
  products: ProductSummary[];
}

export function WorkspaceWebhooksManager({
  ws,
  initialSubscriptions,
  products,
}: WorkspaceWebhooksManagerProps): React.JSX.Element {
  const [subscriptions, setSubscriptions] =
    React.useState<WebhookSubscription[]>(initialSubscriptions);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  // Deliveries modal state
  const [deliveriesTarget, setDeliveriesTarget] =
    React.useState<WebhookSubscription | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] =
    React.useState<WebhookSubscription | null>(null);

  // Revealed secrets state map
  const [revealedSecrets, setRevealedSecrets] = React.useState<Record<string, boolean>>({});
  const [copiedMap, setCopiedMap] = React.useState<Record<string, boolean>>({});

  // Ping loading state map
  const [pingingMap, setPingingMap] = React.useState<Record<string, boolean>>({});

  const productMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.id) map.set(p.id, p.name);
    }
    return map;
  }, [products]);

  const handleWebhookCreated = (newSub: WebhookSubscription) => {
    setSubscriptions((prev) => [newSub, ...prev]);
  };

  const handleToggleActive = async (sub: WebhookSubscription) => {
    const updatedStatus = !sub.isActive;
    try {
      await apiFetch<WebhookSubscription>(
        `/api/v1/workspaces/${ws}/webhooks/${sub.id}`,
        {
          method: "PATCH",
          body: { isActive: updatedStatus },
        }
      );

      setSubscriptions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, isActive: updatedStatus } : s))
      );
      toast.success(
        updatedStatus
          ? "Webhook subscription activated"
          : "Webhook subscription paused"
      );
    } catch (err: any) {
      toast.error(errorCopy(err));
    }
  };

  const handleSendPing = async (sub: WebhookSubscription) => {
    try {
      setPingingMap((prev) => ({ ...prev, [sub.id]: true }));
      await apiFetch<{ enqueued: boolean; deliveryId: string }>(
        `/api/v1/workspaces/${ws}/webhooks/${sub.id}/ping`,
        { method: "POST" }
      );
      toast.success("Test ping event enqueued for delivery");
    } catch (err: any) {
      toast.error(errorCopy(err));
    } finally {
      setPingingMap((prev) => ({ ...prev, [sub.id]: false }));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await apiFetch(`/api/v1/workspaces/${ws}/webhooks/${deleteTarget.id}`, {
        method: "DELETE",
      });

      setSubscriptions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success("Webhook subscription deleted");
    } catch (err: any) {
      toast.error(errorCopy(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleRevealSecret = (id: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopySecret = async (sub: WebhookSubscription) => {
    try {
      await navigator.clipboard.writeText(sub.secret);
      setCopiedMap((prev) => ({ ...prev, [sub.id]: true }));
      toast.success("Signing secret copied");
      setTimeout(() => {
        setCopiedMap((prev) => ({ ...prev, [sub.id]: false }));
      }, 2000);
    } catch {
      toast.error("Failed to copy secret");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span>Webhook Endpoints</span>
            <Badge variant="neutral" className="text-xs">
              {subscriptions.length}
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Receive signed HMAC-SHA256 HTTP POST notifications when workspace resources change.
          </p>
        </div>

        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2 shrink-0"
          data-testid="create-webhook-btn"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Add Webhook</span>
        </Button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="size-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
            <Webhook className="size-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground">No webhooks configured yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Connect external services, Slack bots, or internal event buses by adding a webhook endpoint.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="mt-2"
          >
            Add Webhook
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub) => {
            const isRevealed = Boolean(revealedSecrets[sub.id]);
            const isCopied = Boolean(copiedMap[sub.id]);
            const isPinging = Boolean(pingingMap[sub.id]);

            return (
              <div
                key={sub.id}
                className={`rounded-lg border bg-card p-5 transition-colors ${
                  sub.isActive ? "border-border" : "border-border/60 opacity-80"
                }`}
                data-testid={`webhook-row-${sub.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-foreground break-all">
                        {sub.url}
                      </span>
                      {sub.isActive ? (
                        <Badge variant="neutral" className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="neutral" className="text-xs">
                          Paused
                        </Badge>
                      )}
                    </div>

                    {sub.description && (
                      <p className="text-xs text-muted-foreground">{sub.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {sub.events.map((ev) => (
                        <Badge
                          key={ev}
                          variant="neutral"
                          className="font-mono text-[11px] px-2 py-0.5 bg-muted/50 text-foreground"
                        >
                          {ev}
                        </Badge>
                      ))}

                      {sub.productRestrictions && sub.productRestrictions.length > 0 ? (
                        sub.productRestrictions.map((prodId) => (
                          <Badge
                            key={prodId}
                            variant="outline"
                            className="text-[11px] px-2 py-0.5 gap-1"
                          >
                            <Layers className="size-3" />
                            <span>{productMap.get(prodId) || "Product"}</span>
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="neutral" className="text-[11px] px-2 py-0.5 text-muted-foreground">
                          All Products
                        </Badge>
                      )}
                    </div>

                    {/* Signing Secret Box */}
                    <div className="flex items-center gap-2 pt-2 text-xs">
                      <span className="text-muted-foreground shrink-0 font-medium">Secret:</span>
                      <div className="flex items-center gap-1.5 bg-muted/40 border border-border/80 rounded px-2 py-1 max-w-sm">
                        <span className="font-mono text-[11px] text-muted-foreground truncate select-all">
                          {isRevealed
                            ? sub.secret
                            : `${sub.secret.slice(0, 10)}••••••••••••••••••••••••`}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleRevealSecret(sub.id)}
                          className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
                          title={isRevealed ? "Hide secret" : "Reveal secret"}
                        >
                          {isRevealed ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopySecret(sub)}
                          className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
                          title="Copy secret"
                        >
                          {isCopied ? (
                            <Check className="size-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendPing(sub)}
                      disabled={isPinging}
                      className="gap-1.5 h-8 text-xs"
                      data-testid={`ping-webhook-${sub.id}`}
                    >
                      <Send className={`size-3.5 ${isPinging ? "animate-spin" : ""}`} />
                      <span>Send Ping</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeliveriesTarget(sub)}
                      className="gap-1.5 h-8 text-xs"
                      data-testid={`deliveries-webhook-${sub.id}`}
                    >
                      <History className="size-3.5" />
                      <span>Deliveries</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(sub)}
                      className="h-8 px-2 text-xs"
                      title={sub.isActive ? "Pause webhook" : "Activate webhook"}
                    >
                      <Power
                        className={`size-4 ${
                          sub.isActive
                            ? "text-emerald-500 hover:text-emerald-600"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(sub)}
                      className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                      title="Delete webhook"
                      data-testid={`delete-webhook-${sub.id}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <CreateWebhookDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        ws={ws}
        products={products}
        onWebhookCreated={handleWebhookCreated}
      />

      {/* Deliveries Logs Dialog */}
      <WebhookDeliveriesDialog
        open={Boolean(deliveriesTarget)}
        onOpenChange={(open) => !open && setDeliveriesTarget(null)}
        ws={ws}
        subscription={deliveriesTarget}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Webhook Subscription"
        description={
          deleteTarget
            ? `Are you sure you want to delete the webhook for ${deleteTarget.url}? Existing delivery logs will also be permanently deleted.`
            : ""
        }
        dismissLabel="Cancel"
        confirmLabel="Delete Webhook"
        confirmVariant="destructive"
        pendingLabel="Deleting..."
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
