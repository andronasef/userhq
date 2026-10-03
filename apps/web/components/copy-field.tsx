"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export interface CopyFieldProps {
  value: string;
  buttonLabel?: string;
  className?: string;
}

export function CopyField({
  value,
  buttonLabel = "Copy link",
  className,
}: CopyFieldProps) {
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
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-4" />
              <span>{buttonLabel}</span>
            </>
          )}
        </Button>
      </div>
      {fallbackHelp && (
        <p className="text-xs text-muted-foreground">
          Press Ctrl+C or ⌘C to copy.
        </p>
      )}
    </div>
  );
}
