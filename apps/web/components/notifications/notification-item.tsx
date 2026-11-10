"use client";

import * as React from "react";
import Link from "next/link";
import type { NotificationItem as NotificationItemType } from "@userhq/types";
import { useI18n } from "../../lib/i18n/context";
import { cn } from "../../lib/utils";
import { postHref } from "../../lib/tenant";

export interface NotificationItemProps {
  notification: NotificationItemType;
  onRead: (notification: NotificationItemType) => void;
}

function formatRelativeTime(
  dateString: string,
  t: ReturnType<typeof useI18n>["t"],
): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return t("common.justNow");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t("common.minutesAgo", { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t("common.hoursAgo", { count: diffHr });
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return t("common.daysAgo", { count: diffDays });
  return new Date(dateString).toLocaleDateString();
}

export function NotificationItem({
  notification,
  onRead,
}: NotificationItemProps): React.JSX.Element {
  const { t } = useI18n();
  const isUnread = !notification.readAt;
  const { post, activity } = notification;

  // Resolve target link
  const targetHref =
    post.workspaceSlug && post.productSlug
      ? postHref(post.workspaceSlug, post.productSlug, post.number)
      : `/`;

  const toStatus = activity.toStatus ?? post.status;

  return (
    <Link
      href={targetHref}
      onClick={() => onRead(notification)}
      className={cn(
        "flex items-start gap-3 p-3.5 transition-colors text-left group hover:bg-muted/50",
        isUnread ? "bg-muted/20" : "bg-transparent"
      )}
    >
      <div className="pt-1.5 shrink-0">
        <span
          className={cn(
            "size-2 rounded-full block transition-colors",
            isUnread ? "bg-primary" : "bg-transparent"
          )}
          aria-hidden="true"
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground truncate group-hover:text-[var(--primary-text)] transition-colors">
            {post.title}
          </span>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {formatRelativeTime(activity.createdAt || notification.createdAt, t)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{t("notifications.statusChangedTo")}</span>
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ backgroundColor: toStatus.color }}
              aria-hidden="true"
            />
            <span>{toStatus.name}</span>
          </span>
        </div>

        {activity.note && (
          <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 p-1.5 rounded border border-border/50 mt-0.5">
            {activity.note}
          </p>
        )}
      </div>
    </Link>
  );
}
