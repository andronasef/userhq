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

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open with the URL, focus it
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      // If any tab with same origin is open, navigate and focus
      if (clientList.length > 0 && "focus" in clientList[0]) {
        clientList[0].navigate(targetUrl);
        return clientList[0].focus();
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
