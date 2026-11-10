"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VoterList } from "@/components/post/voter-list";
import { useI18n } from "@/lib/i18n/context";

export interface VotersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: string;
  product: string;
  postNumber: number;
  voteCount: number;
}

export function VotersDialog({
  open,
  onOpenChange,
  ws,
  product,
  postNumber,
  voteCount,
}: VotersDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{t("postDetail.votersTitle")} ({voteCount})</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto px-2">
          {open && (
            <VoterList
              ws={ws}
              product={product}
              postNumber={postNumber}
            />
          )}
        </div>
        <DialogFooter className="p-4 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
