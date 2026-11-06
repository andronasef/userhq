"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api-client";
import type { PushPreferences, FollowedProductItem } from "@userhq/types";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationPreferences(): React.JSX.Element {
  const [isSupported, setIsSupported] = React.useState<boolean>(true);
  const [permission, setPermission] = React.useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [actionPending, setActionPending] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const [preferences, setPreferences] = React.useState<PushPreferences>({
    enabled: true,
    includePreviews: false,
    notifyReplies: true,
    notifyStatusChanges: true,
    notifyNewPosts: true,
    notifyNewComments: true,
  });

  const [followedProducts, setFollowedProducts] = React.useState<FollowedProductItem[]>([]);

  // Check support, permission, and active subscription on mount
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setIsSupported(false);
      setLoading(false);
      return;
    }

    setPermission(Notification.permission);

    async function init() {
      try {
        // Fetch preferences
        const prefs = await apiFetch<PushPreferences>("/api/v1/push/preferences");
        setPreferences(prefs);

        // Fetch followed products
        const products = await apiFetch<FollowedProductItem[]>("/api/v1/push/followed-products");
        setFollowedProducts(products);

        // Check if existing service worker and subscription exist
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          setIsSubscribed(!!sub);
        }
      } catch (e) {
        console.error("Failed to load push preferences:", e);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const handleEnablePush = async () => {
    setActionPending(true);
    setError(null);

    try {
      // 1. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        toast.error("Notification permission was not granted.");
        setActionPending(false);
        return;
      }

      // 2. Register service worker
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      // 3. Fetch VAPID public key
      const { publicKey } = await apiFetch<{ publicKey: string }>("/api/v1/push/vapid-public-key");
      const appServerKey = urlBase64ToUint8Array(publicKey);

      // 4. Subscribe to PushManager
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey as any,
        });
      }

      const rawSub = sub.toJSON();
      if (!rawSub.endpoint || !rawSub.keys?.p256dh || !rawSub.keys?.auth) {
        throw new Error("Invalid push subscription received from browser.");
      }

      // 5. Register with backend
      await apiFetch("/api/v1/push/subscriptions", {
        method: "POST",
        body: {
          endpoint: rawSub.endpoint,
          keys: {
            p256dh: rawSub.keys.p256dh,
            auth: rawSub.keys.auth,
          },
          userAgent: navigator.userAgent,
        },
      });

      setIsSubscribed(true);
      toast.success("Push notifications enabled!");
    } catch (err) {
      console.error(err);
      setError("Failed to enable push notifications. Please check your browser settings.");
      toast.error("Could not enable push notifications.");
    } finally {
      setActionPending(false);
    }
  };

  const handleDisablePush = async () => {
    setActionPending(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await apiFetch("/api/v1/push/subscriptions", {
            method: "DELETE",
            body: { endpoint: sub.endpoint },
          });
          await sub.unsubscribe();
        }
      }

      setIsSubscribed(false);
      toast.success("Push notifications disabled.");
    } catch (err) {
      console.error(err);
      setError("Failed to disable push notifications.");
      toast.error("Could not disable push notifications.");
    } finally {
      setActionPending(false);
    }
  };

  const handleTogglePref = async (key: keyof PushPreferences) => {
    const nextVal = !preferences[key];
    const prev = { ...preferences };
    setPreferences((p) => ({ ...p, [key]: nextVal }));

    try {
      const updated = await apiFetch<PushPreferences>("/api/v1/push/preferences", {
        method: "PATCH",
        body: { [key]: nextVal },
      });
      setPreferences(updated);
      toast.success("Preferences updated");
    } catch (e) {
      setPreferences(prev);
      toast.error("Failed to update preferences");
    }
  };

  const handleUnfollowProduct = async (productId: string) => {
    try {
      await apiFetch(`/api/v1/push/followed-products/${productId}`, {
        method: "DELETE",
      });
      setFollowedProducts((list) => list.filter((p) => p.productId !== productId));
      toast.success("Unfollowed product");
    } catch (e) {
      toast.error("Failed to unfollow product");
    }
  };

  const handleSendTest = async () => {
    setActionPending(true);
    try {
      await apiFetch<{ success: boolean; enqueuedCount: number }>("/api/v1/push/test", {
        method: "POST",
      });
      toast.success("Test notification enqueued! Check your device notifications.");
    } catch (e) {
      toast.error("Failed to send test notification.");
    } finally {
      setActionPending(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground">
        Web push notifications are not supported in your current browser.
      </div>
    );
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading notification preferences...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {isSubscribed ? "Push notifications are active" : "Enable browser push notifications"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSubscribed
              ? "This device is registered to receive instant updates."
              : "Receive updates about your feedback, comments, and followed products."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSubscribed ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendTest}
                disabled={actionPending}
              >
                Send test
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisablePush}
                disabled={actionPending}
              >
                Disable
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleEnablePush}
              disabled={actionPending}
            >
              Enable push
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <div>{error}</div>
        </Alert>
      )}

      {permission === "denied" && (
        <Alert variant="destructive">
          <div>
            Notifications are blocked in your browser settings. Please allow notifications for this site to enable push updates.
          </div>
        </Alert>
      )}

      {isSubscribed && (
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Event triggers
          </h4>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.notifyReplies}
                onChange={() => handleTogglePref("notifyReplies")}
                className="size-4 mt-0.5 rounded border-border accent-foreground cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Replies to my posts & comments</span>
                <span className="text-xs text-muted-foreground">
                  Get notified when an admin or customer responds to your feedback.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.notifyStatusChanges}
                onChange={() => handleTogglePref("notifyStatusChanges")}
                className="size-4 mt-0.5 rounded border-border accent-foreground cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Status updates</span>
                <span className="text-xs text-muted-foreground">
                  Get notified when feedback you created or upvoted changes status.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.notifyNewPosts}
                onChange={() => handleTogglePref("notifyNewPosts")}
                className="size-4 mt-0.5 rounded border-border accent-foreground cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">New posts in followed products</span>
                <span className="text-xs text-muted-foreground">
                  Get notified whenever a customer submits new feedback in products you follow.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.notifyNewComments}
                onChange={() => handleTogglePref("notifyNewComments")}
                className="size-4 mt-0.5 rounded border-border accent-foreground cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">New comments in followed products</span>
                <span className="text-xs text-muted-foreground">
                  Get notified when top-level comments are submitted in products you follow.
                </span>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Privacy & preview content
            </h4>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.includePreviews}
                onChange={() => handleTogglePref("includePreviews")}
                className="size-4 mt-0.5 rounded border-border accent-foreground cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  Include message preview in notifications
                </span>
                <span className="text-xs text-muted-foreground">
                  When turned off, notifications show generic text (e.g. &ldquo;Feedback status updated&rdquo;) to protect privacy on shared screens.
                </span>
              </div>
            </label>
          </div>

          {followedProducts.length > 0 && (
            <div className="pt-4 border-t border-border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Followed products ({followedProducts.length})
              </h4>
              <div className="divide-y divide-border rounded-md border border-border">
                {followedProducts.map((p) => (
                  <div
                    key={p.productId}
                    className="flex items-center justify-between p-3 text-sm"
                  >
                    <div>
                      <span className="font-medium text-foreground">{p.productName}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {p.workspaceSlug} / {p.productSlug}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnfollowProduct(p.productId)}
                    >
                      Unfollow
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
