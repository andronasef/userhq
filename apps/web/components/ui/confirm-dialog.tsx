"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { LoaderCircle } from "lucide-react";
import { Button } from "./button";
import { Alert } from "./alert";
import { errorCopy } from "@/lib/api-errors";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  dismissLabel: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<void>;
  children?: React.ReactNode;
  confirmDisabled?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  dismissLabel,
  confirmLabel,
  pendingLabel,
  onConfirm,
  children,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const dismissRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (open) {
      setError(undefined);
      setPending(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setPending(true);
    setError(undefined);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err: any) {
      setError(errorCopy(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(next) => {
      if (!pending) {
        onOpenChange(next);
      }
    }}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialogPrimitive.Content
          onEscapeKeyDown={(e) => {
            if (pending) {
              e.preventDefault();
            }
          }}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            dismissRef.current?.focus();
          }}
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-[calc(100%-32px)] max-w-md bg-background border border-border rounded-lg p-6 shadow-lg",
            "flex flex-col gap-4",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <div className="flex flex-col gap-1.5">
            <AlertDialogPrimitive.Title className="text-base font-semibold leading-none text-foreground">
              {title}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
              {description}
            </AlertDialogPrimitive.Description>
          </div>

          {children && <div className="py-1">{children}</div>}

          {error && <Alert variant="destructive">{error}</Alert>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              ref={dismissRef}
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {dismissLabel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || confirmDisabled}
              onClick={handleConfirm}
            >
              {pending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>{pendingLabel}</span>
                </>
              ) : (
                <span>{confirmLabel}</span>
              )}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
