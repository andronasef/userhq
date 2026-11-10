"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, MessageSquare, ArrowBigUp } from "lucide-react";
import type {
  PublicRoadmapItem,
  PublicRoadmapPostRef,
  PostStatus,
} from "@userhq/types";
import { isRtl } from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { StatusBadge } from "../status-badge";
import { PlainText } from "../plain-text";
import { postHref } from "../../lib/tenant";
import { apiFetch } from "../../lib/api-client";
import { useI18n } from "../../lib/i18n/context";

export interface PublicRoadmapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PublicRoadmapItem | null;
  status?: PostStatus | null;
  ws: string;
  product: string;
}

export function PublicRoadmapModal({
  open,
  onOpenChange,
  item,
  status,
  ws,
  product,
}: PublicRoadmapModalProps): React.JSX.Element | null {
  const { contentDefaultLocale, t } = useI18n();
  const [loadingPosts, setLoadingPosts] = React.useState(false);
  const [linkedPosts, setLinkedPosts] = React.useState<PublicRoadmapPostRef[]>([]);

  const displayTitle = item?.title ?? "";
  const displayDescription = item?.description;
  const isFallback = Boolean(("isFallback" in (item ?? {})) && (item as { isFallback?: boolean }).isFallback);
  const textDir = isRtl((item as { resolvedLocale?: string } | undefined)?.resolvedLocale ?? contentDefaultLocale) ? "rtl" : "ltr";

  React.useEffect(() => {
    if (!open || !item) {
      setLinkedPosts([]);
      return;
    }

    if (item.postCount > 0) {
      setLoadingPosts(true);
      apiFetch<{ item: PublicRoadmapItem; posts: PublicRoadmapPostRef[] }>(
        `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/roadmap/${encodeURIComponent(item.id)}`
      )
        .then((res) => {
          setLinkedPosts(res.posts ?? []);
        })
        .catch(() => {
          setLinkedPosts([]);
        })
        .finally(() => {
          setLoadingPosts(false);
        });
    } else {
      setLinkedPosts([]);
    }
  }, [open, item, ws, product]);

  if (!item) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-5 overflow-hidden">
        <DialogHeader className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            {status && <StatusBadge name={status.name} color={status.color} />}
            {isFallback && (
              <span className="text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-normal shrink-0">
                {t("ui.original")}
              </span>
            )}
          </div>
          <DialogTitle dir={textDir} className="text-xl font-semibold text-foreground text-left">
            {displayTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("roadmap.itemDetails", { title: displayTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-5" dir={textDir}>
          {displayDescription ? (
            <div className="text-sm text-foreground leading-relaxed">
              <PlainText text={displayDescription} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {t("ui.noDescription")}
            </p>
          )}

          {(item.postCount > 0 || linkedPosts.length > 0) && (
            <div className="border-t border-border pt-4 flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="size-3.5" aria-hidden="true" />
                <span>{t("ui.relatedFeedback")}</span>
              </h4>

              {loadingPosts ? (
                <div className="text-xs text-muted-foreground py-2">
                  {t("ui.loadingRelated")}
                </div>
              ) : linkedPosts.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">
                  {t("roadmap.linkedFeedbackCount", { count: item.postCount })}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {linkedPosts.map((post) => (
                    <Link
                      key={post.number}
                      href={postHref(ws, product, post.number, post.slug)}
                      className="group flex items-center justify-between gap-3 p-2.5 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-6 rounded bg-muted flex items-center justify-center text-xs font-semibold text-foreground shrink-0 gap-0.5">
                          <ArrowBigUp className="size-3.5 text-muted-foreground" />
                          <span>{post.voteCount}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground truncate group-hover:text-[var(--primary-text)] transition-colors">
                          {post.title}
                        </span>
                      </div>
                      <ArrowUpRight
                        className="size-4 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors"
                        aria-hidden="true"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
