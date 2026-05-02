'use client';

import { useEffect } from 'react';
import { BUILD_VERSION } from "@/lib/generated/build-version";

const BUILD_VERSION_URL = "/build-version.json";
const RELOAD_GUARD_KEY = "powerlotto-sw-reload-version";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (sessionStorage.getItem(RELOAD_GUARD_KEY) !== BUILD_VERSION) {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
    }

    let refreshing = false;

    const handleControllerChange = () => {
      if (refreshing || sessionStorage.getItem(RELOAD_GUARD_KEY) === BUILD_VERSION) {
        return;
      }

      refreshing = true;
      sessionStorage.setItem(RELOAD_GUARD_KEY, BUILD_VERSION);
      window.setTimeout(() => {
        window.location.reload();
      }, 100);
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    void registerServiceWorker();

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    // Ritenta per un breve periodo: in alcuni flussi il token arriva dopo il mount.
    let syncCompleted = false;
    let attempts = 0;
    const maxAttempts = 20;

    const syncPush = async () => {
      if (syncCompleted || attempts >= maxAttempts) return;
      attempts += 1;
      const done = await subscribeToPushNotifications();
      if (done) {
        syncCompleted = true;
      }
    };

    void syncPush();
    const intervalId = window.setInterval(() => {
      void syncPush();
    }, 3000);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register("/service-worker.js", {
      scope: "/",
    });

    console.log("✅ Service Worker registered:", registration, BUILD_VERSION);

    watchServiceWorker(registration);

    const latestBuildVersion = await fetchLatestBuildVersion();
    if (latestBuildVersion && latestBuildVersion !== BUILD_VERSION) {
      console.log("🔄 New build detected:", latestBuildVersion);
      await registration.update();
    }

    activateWaitingWorker(registration);
  } catch (error) {
    console.error("❌ Service Worker registration failed:", error);
  }
}

function watchServiceWorker(registration: ServiceWorkerRegistration) {
  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) {
      return;
    }

    installingWorker.addEventListener("statechange", () => {
      if (
        installingWorker.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        activateWaitingWorker(registration);
      }
    });
  });
}

function activateWaitingWorker(registration: ServiceWorkerRegistration) {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}

async function fetchLatestBuildVersion(): Promise<string | null> {
  try {
    const response = await fetch(`${BUILD_VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { version?: string };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

async function subscribeToPushNotifications(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("Push notifications not supported");
      return true;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      // Evita subscription anonime non associabili a un utente.
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await sendSubscriptionToServer(subscription, token);
      console.log("✅ Existing push subscription synced");
      return true;
    }

    // Get VAPID public key
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn("VAPID public key not configured");
      return true;
    }

    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey as BufferSource,
    });

    await sendSubscriptionToServer(newSubscription, token);
    console.log("✅ Push notifications subscribed");
    return true;
  } catch (error) {
    console.error("❌ Push subscription failed:", error);
    return false;
  }
}

async function sendSubscriptionToServer(subscription: PushSubscription, token: string) {
  const subscriptionJSON = subscription.toJSON() as { endpoint: string; keys: Record<string, string> };

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: subscriptionJSON.keys?.p256dh || '',
      auth: subscriptionJSON.keys?.auth || '',
    }),
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
