// Service Worker for UserHQ Web Push Notifications (Slice 8 / Phase 11)

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: "UserHQ Notification",
      body: event.data.text(),
    };
  }

  const title = payload.title || "UserHQ Notification";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/favicon.ico",
    badge: "/favicon.ico",
    data: {
      url: payload.url || "/",
    },
  };
  // Same tag collapses repeat events for one post into one notification. The Notifications
  // API throws on renotify without a tag, so renotify is only ever set alongside one.
  if (typeof payload.tag === "string" && payload.tag) {
    options.tag = payload.tag;
    if (payload.renotify) options.renotify = true;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// Same-origin only: a foreign, protocol-relative or unparsable url falls back to the origin root.
function resolveTarget(raw) {
  try {
    const url = new URL(raw || "/", self.location.origin);
    if (url.origin === self.location.origin) return url.href;
  } catch (e) {
    // fall through
  }
  return new URL("/", self.location.origin).href;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = resolveTarget(event.notification.data && event.notification.data.url);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === target && "focus" in client) {
          return client.focus();
        }
      }
      // Never navigate an unrelated existing tab: open the target instead.
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    })
  );
});
