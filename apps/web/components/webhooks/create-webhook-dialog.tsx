"use client";

import * as React from "react";
import { Check, Copy, Webhook, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  WEBHOOK_EVENTS,
  type WebhookEvent,
  type WebhookSubscription,
  type WebhookSubscriptionWithSecret,
  type ProductSummary,
} from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field } from "../ui/field";
import { Alert } from "../ui/alert";
import { useI18n } from "../../lib/i18n/context";
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";

export interface CreateWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: string;
  products: ProductSummary[];
  onWebhookCreated: (subscription: WebhookSubscription) => void;
}

const EVENT_I18N_KEYS: Record<Exclude<WebhookEvent, "*">, any> = {
  "post.created": "webhooks.eventPostCreated",
  "post.updated": "webhooks.eventPostUpdated",
  "post.status_changed": "webhooks.eventPostStatusChanged",
  "post.deleted": "webhooks.eventPostDeleted",
  "post.merged": "webhooks.eventPostMerged",
  "post.restored": "webhooks.eventPostRestored",
  "comment.restored": "webhooks.eventCommentRestored",
  "comment.created": "webhooks.eventCommentCreated",
  "comment.deleted": "webhooks.eventCommentDeleted",
  "changelog.published": "webhooks.eventChangelogPublished",
};

export function CreateWebhookDialog({
  open,
  onOpenChange,
  ws,
  products,
  onWebhookCreated,
}: CreateWebhookDialogProps): React.JSX.Element {
  const { t } = useI18n();
  const [url, setUrl] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedEvents, setSelectedEvents] = React.useState<WebhookEvent[]>([
    "post.created",
    "post.status_changed",
  ]);
  const [selectedProductId, setSelectedProductId] =
    React.useState<string>("all");
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Success view state showing secret
  const [createdSubscription, setCreatedSubscription] =
    React.useState<WebhookSubscriptionWithSecret | null>(null);
  const [copied, setCopied] = React.useState(false);

  const resetForm = () => {
    setUrl("");
    setDescription("");
    setSelectedEvents(["post.created", "post.status_changed"]);
    setSelectedProductId("all");
    setErrorMessage(null);
    setCreatedSubscription(null);
    setCopied(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const toggleEvent = (event: WebhookEvent) => {
    if (event === "*") {
      if (selectedEvents.includes("*")) {
        setSelectedEvents(["post.created"]);
      } else {
        setSelectedEvents(["*"]);
      }
      return;
    }

    if (selectedEvents.includes("*")) {
      setSelectedEvents([event]);
      return;
    }

    if (selectedEvents.includes(event)) {
      if (selectedEvents.length === 1) return; // Keep at least one
      setSelectedEvents(selectedEvents.filter((e) => e !== event));
    } else {
      setSelectedEvents([...selectedEvents, event]);
    }
  };

  const handleCopySecret = async () => {
    if (!createdSubscription?.secret) return;
    try {
      await navigator.clipboard.writeText(createdSubscription.secret);
      setCopied(true);
      toast.success(t("webhooks.secretCopiedToast"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("webhooks.copySecretFailed"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setErrorMessage(t("webhooks.urlRequired"));
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setErrorMessage(t("webhooks.urlInvalid"));
      return;
    }

    try {
      setLoading(true);
      const payload = {
        url: trimmedUrl,
        description: description.trim() || undefined,
        events: selectedEvents,
        productRestrictions:
          selectedProductId === "all" ? null : [selectedProductId],
      };

      const res = await apiFetch<WebhookSubscriptionWithSecret>(
        `/api/v1/workspaces/${ws}/webhooks`,
        {
          method: "POST",
          body: payload,
        },
      );

      // The secret lives only in this dialog's success view; the list never holds it.
      const { secret: _secret, ...listed } = res;
      setCreatedSubscription(res);
      onWebhookCreated(listed);
      toast.success(t("webhooks.createdTitle"));
    } catch (err: any) {
      setErrorMessage(errorCopy(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-[var(--primary-text)]">
              <Webhook className="size-4" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle>
                {createdSubscription
                  ? t("webhooks.createdTitle")
                  : t("webhooks.createTitle")}
              </DialogTitle>
              <DialogDescription>
                {createdSubscription
                  ? t("webhooks.createdDesc")
                  : t("webhooks.createDesc")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {createdSubscription ? (
          <div className="space-y-6 py-2">
            <Alert
              variant="neutral"
              className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold text-sm mb-1">
                    {t("webhooks.saveSecretWarningTitle")}
                  </p>
                  {t("webhooks.saveSecretWarningDesc")}
                </div>
              </div>
            </Alert>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                {t("webhooks.urlLabel")}
              </label>
              <div className="p-2.5 rounded-md border border-border bg-muted/40 font-mono text-xs break-all">
                {createdSubscription.url}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                {t("webhooks.saveSecretWarningTitle")}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    readOnly
                    value={createdSubscription.secret}
                    className="w-full font-mono text-xs p-2.5 rounded-md border border-border bg-muted/30 select-all focus:outline-none"
                    data-testid="webhook-secret-display"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySecret}
                  className="gap-1.5 shrink-0"
                  data-testid="copy-webhook-secret-btn"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" />
                      <span>{t("common.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>{t("common.copy")}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border p-3 bg-muted/20 text-xs space-y-1 text-muted-foreground">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-[var(--primary-text)]" />
                {t("webhooks.signatureExample")}
              </p>
              <pre className="font-mono text-[11px] p-2 rounded bg-background border border-border overflow-x-auto">
                {`const crypto = require("node:crypto");
const [tPart, v1Part] = req.headers["x-userhq-signature"].split(",");
const timestamp = tPart.split("=")[1];
const signature = v1Part.split("=")[1];
const expected = crypto.createHmac("sha256", secret).update(\`\${timestamp}.\${rawBody}\`).digest("hex");
const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));`}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => handleOpenChange(false)}
                data-testid="webhook-done-btn"
              >
                {t("webhooks.doneBtn")}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 py-2">
            {errorMessage && (
              <Alert variant="destructive">
                <span>{errorMessage}</span>
              </Alert>
            )}

            <Field
              id="webhook-payload-url"
              label={t("webhooks.urlLabel")}
              helper={t("webhooks.urlHelper")}
            >
              <Input
                type="url"
                required
                placeholder="https://api.yourdomain.com/webhooks/userhq"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                data-testid="webhook-url-input"
              />
            </Field>

            <Field
              id="webhook-description"
              label={t("webhooks.descLabel")}
              helper={t("webhooks.descHelper")}
            >
              <Input
                type="text"
                placeholder={t("webhooks.descPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="webhook-description-input"
              />
            </Field>

            {products.length > 0 && (
              <Field
                id="webhook-product-scope"
                label={t("webhooks.productScopeLabel")}
                helper={t("webhooks.productScopeHelper")}
              >
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  data-testid="webhook-product-scope"
                >
                  <option value="all">{t("apiKeys.allProducts")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  {t("webhooks.eventsLabel")}
                </label>
                <button
                  type="button"
                  onClick={() => toggleEvent("*")}
                  className="text-xs text-[var(--primary-text)] hover:underline font-medium"
                >
                  {selectedEvents.includes("*")
                    ? t("webhooks.selectIndividualEvents")
                    : t("webhooks.sendAllEvents")}
                </button>
              </div>

              {selectedEvents.includes("*") ? (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs text-[var(--primary-text)] flex items-center justify-between">
                  <span>{t("webhooks.wildcardDesc")}</span>
                </div>
              ) : (
                <div className="space-y-2 border border-border rounded-lg p-3 max-h-60 overflow-y-auto">
                  {(
                    WEBHOOK_EVENTS.filter((e) => e !== "*") as Array<
                      Exclude<WebhookEvent, "*">
                    >
                  ).map((ev) => {
                    const isChecked = selectedEvents.includes(ev);
                    return (
                      <label
                        key={ev}
                        className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEvent(ev)}
                          className="mt-0.5 rounded border-border text-primary focus:ring-[var(--primary-text)]"
                        />
                        <div className="space-y-0.5 text-xs">
                          <p className="font-mono font-medium text-foreground">
                            {ev}
                          </p>
                          <p className="text-muted-foreground">
                            {t(EVENT_I18N_KEYS[ev])}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                data-testid="submit-webhook-btn"
              >
                {loading ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
