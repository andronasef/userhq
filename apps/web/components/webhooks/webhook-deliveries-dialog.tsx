"use client";

import * as React from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  ChevronRight,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type {
  WebhookSubscription,
  WebhookDelivery,
  WebhookDeliveryListResponse,
} from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useI18n } from "../../lib/i18n/context";
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";

export interface WebhookDeliveriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: string;
  subscription: WebhookSubscription | null;
}

export function WebhookDeliveriesDialog({
  open,
  onOpenChange,
  ws,
  subscription,
}: WebhookDeliveriesDialogProps): React.JSX.Element {
  const { t, locale } = useI18n();
  const [deliveries, setDeliveries] = React.useState<WebhookDelivery[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [expandedDeliveryId, setExpandedDeliveryId] = React.useState<
    string | null
  >(null);
  const [redeliveringId, setRedeliveringId] = React.useState<string | null>(
    null,
  );

  const fetchDeliveries = React.useCallback(async () => {
    if (!subscription) return;
    try {
      setLoading(true);
      const res = await apiFetch<WebhookDeliveryListResponse>(
        `/api/v1/workspaces/${ws}/webhooks/${subscription.id}/deliveries?page=1&limit=50`,
      );
      setDeliveries(res.deliveries);
      setTotal(res.total);
    } catch (err: any) {
      toast.error(errorCopy(err));
    } finally {
      setLoading(false);
    }
  }, [subscription, ws]);

  React.useEffect(() => {
    if (open && subscription) {
      fetchDeliveries();
      setExpandedDeliveryId(null);
    }
  }, [open, subscription, fetchDeliveries]);

  const handleRedeliver = async (deliveryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!subscription) return;

    try {
      setRedeliveringId(deliveryId);
      await apiFetch<WebhookDelivery>(
        `/api/v1/workspaces/${ws}/webhooks/${subscription.id}/deliveries/${deliveryId}/redeliver`,
        { method: "POST" },
      );
      toast.success(t("webhooks.redeliverSuccess"));
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === deliveryId ? { ...d, status: "pending" } : d,
        ),
      );
    } catch (err: any) {
      toast.error(errorCopy(err));
    } finally {
      setRedeliveringId(null);
    }
  };

  const getStatusBadge = (
    status: WebhookDelivery["status"],
    statusCode?: number | null,
  ) => {
    switch (status) {
      case "delivered":
        return (
          <Badge
            variant="neutral"
            className="gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
          >
            <CheckCircle2 className="size-3" />
            <span>
              {statusCode
                ? t("webhooks.statusOk", { statusCode })
                : t("webhooks.deliveryDelivered")}
            </span>
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="danger" className="gap-1 text-xs">
            <XCircle className="size-3" />
            <span>
              {statusCode
                ? t("webhooks.statusError", { statusCode })
                : t("webhooks.deliveryFailed")}
            </span>
          </Badge>
        );
      case "sending":
        return (
          <Badge
            variant="neutral"
            className="gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
          >
            <RotateCw className="size-3 animate-spin" />
            <span>{t("webhooks.deliverySending")}</span>
          </Badge>
        );
      case "suppressed":
        return (
          <Badge variant="neutral" className="gap-1 text-xs">
            <XCircle className="size-3" />
            <span>{t("webhooks.deliverySuppressed")}</span>
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge variant="neutral" className="gap-1 text-xs">
            <Clock className="size-3" />
            <span>{t("webhooks.deliveryPending")}</span>
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <span>{t("webhooks.deliveriesTitle")}</span>
                <Badge variant="neutral" className="text-xs">
                  {total}
                </Badge>
              </DialogTitle>
              <DialogDescription className="font-mono text-xs truncate max-w-lg mt-0.5">
                {subscription?.url}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDeliveries}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span>{t("webhooks.refresh")}</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-2">
          {loading && deliveries.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("webhooks.loadingLogs")}
            </div>
          ) : deliveries.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-border rounded-lg text-sm text-muted-foreground">
              {t("webhooks.emptyLogs")}
            </div>
          ) : (
            deliveries.map((delivery) => {
              const isExpanded = expandedDeliveryId === delivery.id;
              const formattedDate = new Date(delivery.createdAt).toLocaleString(
                locale,
                {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                },
              );

              return (
                <div
                  key={delivery.id}
                  className="rounded-lg border border-border bg-card transition-colors hover:border-foreground/20"
                >
                  <div
                    onClick={() =>
                      setExpandedDeliveryId(isExpanded ? null : delivery.id)
                    }
                    className="flex items-center justify-between p-3.5 cursor-pointer text-sm gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                      )}
                      {getStatusBadge(
                        delivery.status,
                        delivery.responseStatusCode,
                      )}
                      <span className="font-mono text-xs font-semibold text-foreground truncate">
                        {delivery.eventType}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formattedDate}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleRedeliver(delivery.id, e)}
                        disabled={redeliveringId === delivery.id}
                        className="h-7 px-2 text-xs gap-1"
                        title={t("webhooks.redeliverTooltip")}
                      >
                        <RotateCw
                          className={`size-3 ${
                            redeliveringId === delivery.id ? "animate-spin" : ""
                          }`}
                        />
                        <span>{t("webhooks.redeliverAction")}</span>
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3.5 pt-0 border-t border-border/50 text-xs space-y-3 bg-muted/20 rounded-b-lg">
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-3">
                        <div>
                          <span className="font-medium text-foreground">
                            {t("webhooks.deliveryIdLabel")}{" "}
                          </span>
                          <span className="font-mono">{delivery.id}</span>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">
                            {t("webhooks.attemptsLabel")}{" "}
                          </span>
                          <span>{delivery.attempts}</span>
                        </div>
                        {delivery.deliveredAt && (
                          <div>
                            <span className="font-medium text-foreground">
                              {t("webhooks.deliveredAtLabel")}{" "}
                            </span>
                            <span>
                              {new Date(delivery.deliveredAt).toLocaleString(locale)}
                            </span>
                          </div>
                        )}
                        {(delivery as any).lastAttemptAt && (
                          <div>
                            <span className="font-medium text-foreground">
                              {t("webhooks.lastAttemptLabel")}{" "}
                            </span>
                            <span>
                              {new Date(
                                (delivery as any).lastAttemptAt,
                              ).toLocaleString(locale)}
                            </span>
                          </div>
                        )}
                      </div>

                      {delivery.responseBody && (
                        <div className="space-y-1">
                          <span className="font-medium text-foreground">
                            {t("webhooks.responseBodyLabel")}
                          </span>
                          <pre className="p-2.5 rounded bg-background border border-border font-mono text-[11px] max-h-32 overflow-y-auto whitespace-pre-wrap">
                            {delivery.responseBody}
                          </pre>
                        </div>
                      )}

                      <div className="space-y-1">
                        <span className="font-medium text-foreground">
                          {t("webhooks.dispatchedPayloadLabel")}
                        </span>
                        <pre className="p-2.5 rounded bg-background border border-border font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {JSON.stringify(delivery.payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
