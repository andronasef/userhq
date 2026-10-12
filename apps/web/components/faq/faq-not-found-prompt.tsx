import * as React from "react";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export interface FaqNotFoundPromptProps {
  ws: string;
  product: string;
  query?: string;
  className?: string;
}

export function FaqNotFoundPrompt({
  ws,
  product,
  query,
  className,
}: FaqNotFoundPromptProps): React.JSX.Element {
  const trimmed = query?.trim() ?? "";
  const href = trimmed
    ? `/${ws}/${product}?new=true&title=${encodeURIComponent(trimmed)}`
    : `/${ws}/${product}?new=true`;

  return (
    <div
      className={cn(
        "p-6 rounded-lg border border-border bg-muted/30 text-center flex flex-col items-center gap-3 w-full",
        className
      )}
    >
      <MessageSquarePlus className="size-8 text-primary" aria-hidden="true" />
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Didn&apos;t find what you were looking for?
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Submit a question or idea to our community feedback board.
        </p>
      </div>
      <Button asChild variant="default">
        <Link href={href}>Post to feedback board</Link>
      </Button>
    </div>
  );
}
