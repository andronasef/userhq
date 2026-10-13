"use client";

import * as React from "react";
import { Bell, BellOff, CheckCheck, LoaderCircle } from "lucide-react";
import type {
  NotificationItem as NotificationItemType,
  NotificationListResponse,
  UnreadNotificationCountResponse,
} from "@userhq/types";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { apiFetch } from "../../lib/api-client";
import { NotificationItem } from "./notification-item";

export function NotificationBell(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState<number>(0);
  const [notifications, setNotifications] = React.useState<NotificationItemType[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // Fetch unread count on mount
  React.useEffect(() => {
    let mounted = true;
    apiFetch<UnreadNotificationCountResponse>("/api/v1/notifications/unread-count")
      .then((res) => {
        if (mounted) {
          setUnreadCount(res.unreadCount);
        }
      })
      .catch(() => {
        // Silently ignore if not signed in or network unavailable
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch notification list when opened
  React.useEffect(() => {
    if (!open) return;

    let mounted = true;
    setLoading(true);
    apiFetch<NotificationListResponse>("/api/v1/notifications")
      .then((res) => {
        if (mounted) {
          setNotifications(res.notifications ?? []);
          setUnreadCount(res.unreadCount);
          setNextCursor(res.nextCursor);
        }
      })
      .catch(() => {
        if (mounted) {
          setNotifications([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [open]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiFetch<NotificationListResponse>(
        `/api/v1/notifications?cursor=${encodeURIComponent(nextCursor)}`
      );
      // A status change while scrolling moves a row to the top; skip ids we already have.
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...res.notifications.filter((n) => !seen.has(n.id))];
      });
      setUnreadCount(res.unreadCount);
      setNextCursor(res.nextCursor);
    } catch {
      // Keep the button so the user can retry
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiFetch<{ success: boolean }>("/api/v1/notifications/mark-read", {
        method: "POST",
      });
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
      );
    } catch {
      // Ignore
    }
  };

  const handleItemRead = async (item: NotificationItemType) => {
    if (!item.readAt) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      try {
        // The read endpoint is keyed by post: one notification row per (user, post).
        await apiFetch<{ success: boolean }>(`/api/v1/notifications/${item.post.id}/read`, {
          method: "POST",
        });
      } catch {
        // Ignore
      }
    }
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full relative size-9 text-muted-foreground hover:text-foreground"
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread notifications`
              : "Notifications"
          }
        >
          <Bell className="size-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              className="absolute top-2 right-2 size-2 rounded-full bg-destructive ring-2 ring-background"
              aria-hidden="true"
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <BellOff className="size-8 text-muted-foreground/50 mb-2" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                You'll be notified when feedback you're following gets updated.
              </p>
            </div>
          ) : (
            <>
              {notifications.map((item) => (
                <NotificationItem
                  key={item.id}
                  notification={item}
                  onRead={handleItemRead}
                />
              ))}
              {nextCursor && (
                <div className="p-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
