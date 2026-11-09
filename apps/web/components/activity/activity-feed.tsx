"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  MessageSquare,
  Activity,
  ArrowRight,
} from "lucide-react";
import type { ActivityItem } from "@userhq/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { StatusBadge } from "../status-badge";
import { postHref, portalHref } from "../../lib/tenant";
import { formatRelativeTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n/context";

export interface ActivityFeedProps {
  ws: string;
  product: string;
  activities: ActivityItem[];
}

export function ActivityFeed({
  ws,
  product,
  activities,
}: ActivityFeedProps): React.JSX.Element {
  const { currentLocale, t } = useI18n();

  const engagementLabel = (type: string): string => {
    switch (type) {
      case "created":
        return t("ui.createdByUser");
      case "commented":
        return t("ui.commentedByUser");
      case "voted":
      default:
        return t("ui.upvotedByUser");
    }
  };

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-card/50">
        <Activity className="size-10 text-muted-foreground/60 mb-3" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground">{t("ui.noActivityYet")}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-5">
          {t("ui.noActivityDesc")}
        </p>
        <Button asChild>
          <Link href={portalHref(ws, product)}>
            <span>{t("ui.allFeedback")}</span>
            <ArrowRight className="size-4 ml-1.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activities.map((item) => {
        const post = item.post;
        const currentStatus = item.toStatus ?? post.status;
        const href = postHref(ws, product, post.number);

        return (
          <div
            key={item.id}
            className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:border-foreground/20 hover:shadow-xs transition-all"
          >
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge name={currentStatus.name} color={currentStatus.color} />
                <span className="text-xs text-muted-foreground font-medium">
                  {engagementLabel(item.type)}
                </span>
                {(item.hasNewStatus || item.hasStatusChange) && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 gap-1 text-[11px] font-medium"
                  >
                    <Sparkles className="size-3" aria-hidden="true" />
                    <span>{t("ui.statusChanged")}</span>
                  </Badge>
                )}
                {item.hasNewComments && (
                  <Badge
                    variant="outline"
                    className="border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 gap-1 text-[11px] font-medium"
                  >
                    <MessageSquare className="size-3" aria-hidden="true" />
                    <span>{t("ui.newCommentsBadge")}</span>
                  </Badge>
                )}
              </div>

              <Link
                href={href}
                className="text-base font-semibold text-foreground group-hover:text-[var(--primary-text)] transition-colors truncate"
              >
                {post.title}
              </Link>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0 self-end sm:self-center">
              {item.commentCount > 0 && (
                <div className="flex items-center gap-1">
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  <span>{item.commentCount}</span>
                </div>
              )}
              <span className="text-[11px]">
                {formatRelativeTime(item.createdAt, currentLocale)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
