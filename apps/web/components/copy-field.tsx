"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

export interface CopyFieldProps {
  value: string;
  buttonLabel?: string;
  className?: string;
}

export function CopyField({
  value,
  buttonLabel,
  className,
}: CopyFieldProps) {
  const { t } = useI18n();
  const [copied, setCopied] = React.useState(false);
  const [fallbackHelp, setFallbackHelp] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFallbackHelp(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      inputRef.current?.select();
      setFallbackHelp(true);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1 w-full", className)}>
      <div className="flex gap-2 items-center w-full">
        <Input
          ref={inputRef}
          readOnly
          value={value}
          className="font-mono text-sm"
          onClick={() => inputRef.current?.select()}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleCopy}
          className="shrink-0"
        >
          {copied ? (
            <>
              <Check className="size-4" />
              <span>{t("common.copied")}</span>
            </>
          ) : (
            <>
              <Copy className="size-4" />
              <span>{buttonLabel ?? t("common.copyLink")}</span>
            </>
          )}
        </Button>
      </div>
      {fallbackHelp && (
        <p className="text-xs text-muted-foreground">
          {t("common.pressToCopy")}
        </p>
      )}
    </div>
  );
}
