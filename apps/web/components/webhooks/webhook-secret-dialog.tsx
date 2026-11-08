"use client";

import * as React from "react";
import { Check, Copy, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Alert } from "../ui/alert";

export interface WebhookSecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  secret: string;
}

/** One-time display of a rotated signing secret. The API never returns it again. */
export function WebhookSecretDialog({
  open,
  onOpenChange,
  url,
  secret,
}: WebhookSecretDialogProps): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("Signing secret copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy secret");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-[var(--primary-text)]" aria-hidden="true" />
            <span>New signing secret</span>
          </DialogTitle>
          <DialogDescription>
            Copy this secret now. It will not be shown again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <Alert variant="neutral" className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs">
                The previous secret stopped working immediately. Update your receiver now; failed
                deliveries are retried and signed with this secret.
              </p>
            </div>
          </Alert>

          <p className="font-mono text-xs break-all text-muted-foreground">{url}</p>

          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={secret}
              aria-label="Signing secret"
              className="font-mono text-xs select-all bg-muted/50"
              data-testid="rotated-webhook-secret"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="shrink-0 gap-1.5"
              data-testid="copy-rotated-webhook-secret"
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

          <div className="flex justify-end">
            <Button type="button" onClick={() => onOpenChange(false)} data-testid="webhook-secret-done-btn">
              I have saved this secret
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
