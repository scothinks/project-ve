"use client";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function isPushSupported() {
  return (
    typeof window !== "undefined"
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window
  );
}

export function getPushDeviceKey() {
  if (typeof window === "undefined") {
    return "server";
  }

  const storageKey = "project-ve-push-device-key";
  const existing = window.localStorage.getItem(storageKey);

  if (existing) {
    return existing;
  }

  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `device-${Date.now()}`;
  window.localStorage.setItem(storageKey, next);
  return next;
}

export async function getCurrentPushSubscription() {
  if (!isPushSupported()) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeCurrentDevice(vapidPublicKey: string) {
  if (!vapidPublicKey) {
    throw new Error("Push notifications are not configured yet.");
  }

  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported on this device.");
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Allow browser notifications to enable push alerts.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const response = await fetch("/api/notifications/push-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deviceKey: getPushDeviceKey(),
      subscription: subscription.toJSON(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    }),
  });

  const result = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(result?.error ?? "Could not enable push notifications.");
  }

  return {
    permission,
    subscription,
  };
}

export async function unsubscribeCurrentDevice() {
  const subscription = await getCurrentPushSubscription();

  if (subscription) {
    await subscription.unsubscribe();
  }

  const response = await fetch("/api/notifications/push-subscription", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deviceKey: getPushDeviceKey(),
    }),
  });

  const result = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(result?.error ?? "Could not disable push notifications.");
  }
}
