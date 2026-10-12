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

export interface ActivityFeedProps {
  ws: string;
  product: string;
  activities: ActivityItem[];
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

function engagementLabel(type: string): string {
  switch (type) {
    case "created":
      return "Created by you";
    case "commented":
      return "You commented";
    case "voted":
    default:
      return "You upvoted";
  }
}

export function ActivityFeed({
  ws,
  product,
  activities,
}: ActivityFeedProps): React.JSX.Element {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-card/50">
        <Activity className="size-10 text-muted-foreground/60 mb-3" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground">No activity yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-5">
          Posts you create, upvote, or comment on will appear here with status changes and new comments highlighted.
        </p>
        <Button asChild>
          <Link href={portalHref(ws, product)}>
            <span>Explore feedback</span>
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
                    <span>Status changed</span>
                  </Badge>
                )}
                {item.hasNewComments && (
                  <Badge
                    variant="outline"
                    className="border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 gap-1 text-[11px] font-medium"
                  >
                    <MessageSquare className="size-3" aria-hidden="true" />
                    <span>New comments</span>
                  </Badge>
                )}
              </div>

              <Link
                href={href}
                className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate"
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
                {formatRelativeTime(item.createdAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
