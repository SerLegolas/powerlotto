const APP_VERSION = "0.1.0-20260502-132207";
const CACHE_NAME = "powerlotto-v0-1-0-20260502-132207";
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = [
  "/login",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.json",
];

// Install event - cache essential assets
self.addEventListener("install", (event) => {
  console.log("💿 Service Worker installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Caching essential assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker activating...", APP_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("🗑️ Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip non-http(s) schemes (e.g. chrome-extension://)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // API requests - network first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            return response;
          }
          return caches.match(request).then((cached) => cached || response);
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response.ok) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (request.mode === "navigate") {
              return caches.match(OFFLINE_URL);
            }
            return new Response("Resource unavailable while offline", {
              status: 503,
              statusText: "Service Unavailable",
            });
          })
      );
    })
  );
});

// Handle push notifications
self.addEventListener("push", (event) => {
  console.log("📢 Push notification received");

  const data = event.data
    ? event.data.json()
    : {
        title: "PowerLotto",
        body: "Nuova notifica",
        icon: "/icons/icon-192.png",
      };

  const options = {
    body: data.body || "PowerLotto - Estratti Lotto",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.data?.kind === "winning" ? "powerlotto-win" : "powerlotto-notification",
    requireInteraction: data.data?.kind === "winning",
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("👆 Notification clicked");

  event.notification.close();

  const notificationData = event.notification.data || {};
  const targetPath = notificationData.kind === "winning" ? "/dashboard/storico" : "/dashboard";
  const absoluteTargetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientPath = new URL(client.url).pathname;
        if (clientPath.startsWith("/dashboard") && "focus" in client) {
          client.navigate(absoluteTargetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(absoluteTargetUrl);
      }
    })
  );
});

// Handle background sync (periodic tasks)
self.addEventListener("sync", (event) => {
  console.log("🔄 Background sync triggered:", event.tag);

  if (event.tag === "sync-draws") {
    event.waitUntil(syncDraws());
  }
});

async function syncDraws() {
  try {
    const response = await fetch("/api/draws");
    if (response.ok) {
      console.log("✅ Draws synced successfully");
    }
  } catch (error) {
    console.error("❌ Failed to sync draws:", error);
  }
}
