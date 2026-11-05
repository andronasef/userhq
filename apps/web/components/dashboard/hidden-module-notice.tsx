import * as React from "react";
import Link from "next/link";
import { EyeOff } from "lucide-react";
import type { ProductFeatures } from "@userhq/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

const NOTICE_COPY: Record<keyof ProductFeatures, string> = {
  board: "Customers can't see the feedback board, post ideas, or get notified about feedback. Your posts and comments are kept.",
  roadmap: "Customers can't see your roadmap. Your roadmap items are kept.",
  changelog: "Customers can't see your changelog. Your entries and drafts are kept.",
  faq: "Customers can't see your FAQ. Your categories and questions are kept.",
};

export function HiddenModuleNotice({ ws, product, module }: {
  ws: string;
  product: string;
  module: keyof ProductFeatures;
}): React.JSX.Element {
  return (
    <div role="status" className="mb-6 flex flex-col gap-2 rounded-lg border border-border bg-muted p-4 sm:flex-row sm:items-center sm:gap-4">
      <Badge variant="outline" className="self-start bg-card">
        <EyeOff className="size-3 mr-1" aria-hidden />
        Hidden from customers
      </Badge>
      <p className="text-sm text-foreground sm:flex-1">{NOTICE_COPY[module]}</p>
      <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
        <Link href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/settings#portal-features`}>Turn on in settings</Link>
      </Button>
    </div>
  );
}
