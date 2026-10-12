"use client";

import * as React from "react";
import type { AdminChangelogEntry, PublicChangelogEntry } from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { ChangelogArticle } from "./changelog-article";

export interface ChangelogPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: string;
  product: string;
  productName: string;
  productLogoUrl?: string | null;
  entry: AdminChangelogEntry | PublicChangelogEntry;
}

export function ChangelogPreviewModal({
  open,
  onOpenChange,
  ws,
  product,
  productName,
  productLogoUrl,
  entry,
}: ChangelogPreviewModalProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="border-b border-border pb-3 mb-2">
          <DialogTitle className="text-base sm:text-lg">
            Changelog Preview
          </DialogTitle>
          <DialogDescription className="text-xs">
            This is a preview of how this release note will appear to public readers.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <ChangelogArticle
            ws={ws}
            product={product}
            productName={productName}
            productLogoUrl={productLogoUrl}
            entry={entry}
            className="py-2 max-w-none"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
