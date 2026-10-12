"use client";

import * as React from "react";
import Link from "next/link";
import type { NotificationItem as NotificationItemType } from "@userhq/types";
import { cn } from "../../lib/utils";
import { postHref } from "../../lib/tenant";

export interface NotificationItemProps {
  notification: NotificationItemType;
  onRead: (notification: NotificationItemType) => void;
}

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export function NotificationItem({
  notification,
  onRead,
}: NotificationItemProps): React.JSX.Element {
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
          <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {post.title}
          </span>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {formatRelativeTime(activity.createdAt || notification.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Status changed to</span>
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
