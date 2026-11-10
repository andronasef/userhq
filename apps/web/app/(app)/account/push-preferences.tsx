"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api-client";
import type { PushPreferences, FollowedProductItem } from "@userhq/types";
import { useI18n } from "@/lib/i18n/context";

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
  const { t } = useI18n();
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
        toast.error(t("account.pushPermissionDenied"));
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
      toast.success(t("account.pushEnabledSuccess"));
    } catch (err) {
      console.error(err);
      setError(t("account.pushFailedEnable"));
      toast.error(t("account.couldNotEnablePush"));
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
      toast.success(t("account.pushDisabledSuccess"));
    } catch (err) {
      console.error(err);
      setError(t("account.pushFailedDisable"));
      toast.error(t("account.couldNotDisablePush"));
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
      toast.success(t("account.pushPrefUpdated"));
    } catch (e) {
      setPreferences(prev);
      toast.error(t("account.pushPrefFailed"));
    }
  };

  const handleUnfollowProduct = async (productId: string) => {
    try {
      await apiFetch(`/api/v1/push/followed-products/${productId}`, {
        method: "DELETE",
      });
      setFollowedProducts((list) => list.filter((p) => p.productId !== productId));
      toast.success(t("account.pushUnfollowedProduct"));
    } catch (e) {
      toast.error(t("account.pushFailedUnfollow"));
    }
  };

  const handleSendTest = async () => {
    setActionPending(true);
    try {
      await apiFetch<{ success: boolean; enqueuedCount: number }>("/api/v1/push/test", {
        method: "POST",
      });
      toast.success(t("account.pushTestSuccess"));
    } catch (e) {
      toast.error(t("account.pushTestFailed"));
    } finally {
      setActionPending(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("account.pushNotSupported")}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("account.pushLoading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {isSubscribed ? t("account.pushActive") : t("account.pushEnableTitle")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSubscribed
              ? t("account.pushActiveDesc")
              : t("account.pushEnableDesc")}
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
                {t("account.pushSendTest")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisablePush}
                disabled={actionPending}
              >
                {t("account.pushDisableBtn")}
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleEnablePush}
              disabled={actionPending}
            >
              {t("account.pushEnableBtn")}
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
            {t("account.pushBlockedAlert")}
          </div>
        </Alert>
      )}

      {isSubscribed && (
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("account.pushEventTriggers")}
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
                <span className="text-sm font-medium text-foreground">
                  {t("account.pushRepliesLabel")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("account.pushRepliesDesc")}
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
                <span className="text-sm font-medium text-foreground">
                  {t("account.pushStatusLabel")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("account.pushStatusDesc")}
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
                <span className="text-sm font-medium text-foreground">
                  {t("account.pushNewPostsLabel")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("account.pushNewPostsDesc")}
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
                <span className="text-sm font-medium text-foreground">
                  {t("account.pushNewCommentsLabel")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("account.pushNewCommentsDesc")}
                </span>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t("account.pushPrivacyTitle")}
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
                  {t("account.pushPrivacyLabel")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("account.pushPrivacyDesc")}
                </span>
              </div>
            </label>
          </div>

          {followedProducts.length > 0 && (
            <div className="pt-4 border-t border-border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {t("account.pushFollowedProducts", { count: followedProducts.length })}
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
                      {t("account.pushUnfollow")}
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
