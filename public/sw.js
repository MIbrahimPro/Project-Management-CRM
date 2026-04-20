// DevRolin CRM — Service Worker for Web Push notifications.
// Minimal SW: handles push events + notification clicks. We keep caching
// disabled so authenticated app behavior is not affected.

self.addEventListener("install", (event) => {
  // Activate new SW immediately.
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
  } catch {
    payload = { title: "DevRolin", body: event.data.text() };
  }

  const title = payload.title || "DevRolin";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    data: { url: payload.url || "/dashboard" },
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const origin = self.location.origin;
      const absolute = targetUrl.startsWith("http") ? targetUrl : `${origin}${targetUrl}`;

      for (const client of allClients) {
        // Prefer focusing an existing tab on same origin
        if (client.url.startsWith(origin) && "focus" in client) {
          await client.navigate(absolute).catch(() => {});
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(absolute);
      }
    })(),
  );
});
