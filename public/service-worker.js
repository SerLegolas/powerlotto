const CACHE_NAME = "powerlotto-v2";
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = [
  "/",
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

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker activating...");
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
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
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
    tag: "powerlotto-notification",
    requireInteraction: false,
    actions: [
      {
        action: "open",
        title: "Apri",
      },
      {
        action: "close",
        title: "Chiudi",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("👆 Notification clicked:", event.action);

  event.notification.close();

  if (event.action === "close") {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Check if app window already exists
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow("/");
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
