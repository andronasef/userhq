"use client";

import * as React from "react";
import { Check, Copy, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  API_KEY_SCOPES,
  type ApiKeyScope,
  type ApiKeyMetadata,
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
import { apiFetch } from "../../lib/api-client";
import { errorCopy } from "../../lib/api-errors";

export interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: string;
  products: ProductSummary[];
  onKeyCreated: (key: ApiKeyMetadata) => void;
}

const SCOPE_LABELS: Record<ApiKeyScope, { title: string; description: string }> = {
  admin: {
    title: "Full Admin (admin)",
    description: "Unrestricted access to all workspace admin resources and operations",
  },
  "export:read": {
    title: "Export Feedback (export:read)",
    description: "Export all posts, feedback items, and comments in bulk",
  },
  "requests:read": {
    title: "Read Requests (requests:read)",
    description: "View feedback requests, votes, and status",
  },
  "requests:write": {
    title: "Manage Requests (requests:write)",
    description: "Create posts headlessly, update status, and manage requests",
  },
  "comments:read": {
    title: "Read Comments (comments:read)",
    description: "View discussions and comments across all posts",
  },
  "comments:write": {
    title: "Post Comments (comments:write)",
    description: "Post comments and admin replies to customer feedback",
  },
  "roadmap:read": {
    title: "Read Roadmap (roadmap:read)",
    description: "View roadmap columns, ranks, and planned items",
  },
  "roadmap:write": {
    title: "Manage Roadmap (roadmap:write)",
    description: "Create, move, and edit roadmap cards and links",
  },
  "changelog:read": {
    title: "Read Changelog (changelog:read)",
    description: "View published and draft changelog posts",
  },
  "changelog:write": {
    title: "Manage Changelog (changelog:write)",
    description: "Publish, update, and categorize changelog releases",
  },
  "webhooks:read": {
    title: "Read Webhooks (webhooks:read)",
    description: "View webhook subscriptions and delivery logs",
  },
  "webhooks:write": {
    title: "Manage Webhooks (webhooks:write)",
    description: "Create, update, and delete webhook subscriptions and redeliver events",
  },
  "settings:read": {
    title: "Read Settings (settings:read)",
    description: "View product settings, statuses, and categories",
  },
  "settings:write": {
    title: "Manage Settings (settings:write)",
    description: "Update product settings and feature switches, and manage statuses and categories",
  },
  "faq:read": {
    title: "Read FAQ (faq:read)",
    description: "View FAQ categories and questions, including those of a hidden FAQ module",
  },
  "faq:write": {
    title: "Manage FAQ (faq:write)",
    description: "Create, edit, reorder, and delete FAQ categories and questions",
  },
};

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  ws,
  products,
  onKeyCreated,
}: CreateApiKeyDialogProps): React.JSX.Element {
  const [name, setName] = React.useState("");
  const [selectedScopes, setSelectedScopes] = React.useState<ApiKeyScope[]>([
    "requests:read",
    "export:read",
  ]);
  const [restrictProducts, setRestrictProducts] = React.useState(false);
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = React.useState<string>("never");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Result state: displayed when key is generated
  const [generatedToken, setGeneratedToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setName("");
      setSelectedScopes(["requests:read", "export:read"]);
      setRestrictProducts(false);
      setSelectedProductIds([]);
      setExpiresInDays("never");
      setError(null);
      setGeneratedToken(null);
      setCopied(false);
    }
  }, [open]);

  const toggleScope = (scope: ApiKeyScope) => {
    if (scope === "admin") {
      if (selectedScopes.includes("admin")) {
        setSelectedScopes(selectedScopes.filter((s) => s !== "admin"));
      } else {
        setSelectedScopes(["admin"]);
      }
      return;
    }

    // Unselect admin if selecting another scope
    const withoutAdmin = selectedScopes.filter((s) => s !== "admin");
    if (withoutAdmin.includes(scope)) {
      setSelectedScopes(withoutAdmin.filter((s) => s !== scope));
    } else {
      setSelectedScopes([...withoutAdmin, scope]);
    }
  };

  const toggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== productId));
    } else {
      setSelectedProductIds([...selectedProductIds, productId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please provide a name for this API key.");
      return;
    }

    if (selectedScopes.length === 0) {
      setError("Please select at least one permission scope.");
      return;
    }

    if (restrictProducts && selectedProductIds.length === 0) {
      setError("Please select at least one product or allow all products.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        scopes: selectedScopes,
        productRestrictions: restrictProducts ? selectedProductIds : null,
        expiresInDays: expiresInDays === "never" ? null : parseInt(expiresInDays, 10),
      };

      const res = await apiFetch<{ key: ApiKeyMetadata; token: string }>(
        `/api/v1/workspaces/${ws}/api-keys`,
        {
          method: "POST",
          body: payload,
        }
      );

      setGeneratedToken(res.token);
      onKeyCreated(res.key);
      toast.success("API key generated successfully");
    } catch (err: any) {
      setError(errorCopy(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedToken) return;
    try {
      await navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      toast.success("API key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy API key");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" aria-hidden="true" />
            <span>{generatedToken ? "Save your API key" : "Create workspace API key"}</span>
          </DialogTitle>
          <DialogDescription>
            {generatedToken
              ? "Copy this secret token now. You will never be able to view it again."
              : "Generate a cryptographically secure token for automated tools, scripts, and webhook receivers."}
          </DialogDescription>
        </DialogHeader>

        {generatedToken ? (
          <div className="space-y-6 pt-2">
            <Alert variant="neutral" className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold">Store this secret securely</p>
                  <p>
                    For security reasons, we do not store plaintext tokens in our database. If you lose this key, you will have to revoke it and generate a new one.
                  </p>
                </div>
              </div>
            </Alert>

            <div className="space-y-2">
              <label htmlFor="generated-token-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Secret Token
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="generated-token-input"
                  readOnly
                  value={generatedToken}
                  className="font-mono text-xs select-all bg-muted/50"
                  data-testid="generated-api-key-token"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0 gap-1.5"
                  data-testid="copy-api-key-btn"
                >
                  {copied ? (
                    <>
                      <Check className="size-4 text-emerald-500" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border p-4 bg-muted/20 text-xs space-y-2">
              <p className="font-semibold text-foreground">Using your API key</p>
              <p className="text-muted-foreground">
                Pass your key in the <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">Authorization</code> HTTP header:
              </p>
              <pre className="bg-muted p-2 rounded text-[11px] font-mono overflow-x-auto">
                {`curl -H "Authorization: Bearer ${generatedToken.slice(0, 15)}..." \\\n  https://api.userhq.com/api/v1/workspaces/${ws}/export/feedback`}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                data-testid="api-key-done-btn"
              >
                I have saved this key
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            {error && <Alert variant="destructive">{error}</Alert>}

            <Field
              label="Key Name"
              id="api-key-name"
              helper="A friendly label describing which service or script uses this key."
            >
              <Input
                id="api-key-name"
                type="text"
                placeholder="e.g. Zapier Feedback Ingest, CI/CD Exporter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                data-testid="api-key-name-input"
              />
            </Field>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Permissions & Scopes</label>
              <p className="text-xs text-muted-foreground">
                Select only the minimal permissions required for this integration.
              </p>
              <div className="space-y-2 border border-border rounded-md p-3 max-h-56 overflow-y-auto bg-muted/10">
                {API_KEY_SCOPES.map((scope) => {
                  const info = SCOPE_LABELS[scope];
                  const isChecked = selectedScopes.includes(scope);
                  return (
                    <label
                      key={scope}
                      className="flex items-start gap-2.5 p-1.5 rounded hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleScope(scope)}
                        className="size-4 mt-0.5 rounded border-border accent-primary cursor-pointer"
                        data-testid={`scope-checkbox-${scope}`}
                      />
                      <div className="flex flex-col text-xs">
                        <span className="font-semibold text-foreground">{info.title}</span>
                        <span className="text-muted-foreground">{info.description}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {products.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Product Scope</label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="product-scope-type"
                      checked={!restrictProducts}
                      onChange={() => setRestrictProducts(false)}
                      className="accent-primary"
                    />
                    <span>All products in workspace</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="product-scope-type"
                      checked={restrictProducts}
                      onChange={() => setRestrictProducts(true)}
                      className="accent-primary"
                    />
                    <span>Restrict to specific products</span>
                  </label>
                </div>

                {restrictProducts && (
                  <div className="space-y-1.5 pl-2 pt-1 border-l-2 border-border">
                    {products.map((p) => {
                      if (!p.id) return null;
                      const prodId = p.id;
                      return (
                        <label key={prodId} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.includes(prodId)}
                            onChange={() => toggleProduct(prodId)}
                            className="size-3.5 rounded border-border accent-primary"
                          />
                          <span>{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <Field label="Expiration" id="api-key-expiration">
              <select
                id="api-key-expiration"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="never">No expiration (Never)</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year (365 days)</option>
              </select>
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                data-testid="submit-create-api-key-btn"
              >
                {isSubmitting ? "Generating..." : "Generate key"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
