import * as React from "react";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export interface FaqNotFoundPromptProps {
  ws: string;
  product: string;
  boardEnabled: boolean;
  query?: string;
  className?: string;
}

export function FaqNotFoundPrompt({
  ws,
  product,
  boardEnabled,
  query,
  className,
}: FaqNotFoundPromptProps): React.JSX.Element | null {
  const trimmed = query?.trim() ?? "";
  if (!boardEnabled) {
    if (!trimmed) return null;
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
        <h3 className="text-base font-semibold text-foreground">No answers match your search</h3>
        <p className="mt-2 text-sm text-muted-foreground">Try different words or clear the search.</p>
      </div>
    );
  }
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
