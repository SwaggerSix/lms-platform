/**
 * Push notification registration utilities.
 *
 * This module handles requesting permission, subscribing via the
 * service worker, and persisting the subscription on the server.
 */

const VAPID_PUBLIC_KEY_KEY = "lms_vapid_public_key";

/**
 * Request notification permission from the user.
 * Returns the permission status.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    return "denied";
  }

  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }

  return await Notification.requestPermission();
}

/**
 * Subscribe to push notifications via the service worker.
 * Stores the subscription on the server.
 *
 * @param vapidPublicKey - The VAPID public key for push subscription.
 *   If not provided, attempts to fetch from /api/push/vapid-key.
 * @returns true if subscription was successful
 */
export async function subscribeToPush(vapidPublicKey?: string): Promise<boolean> {
  try {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") return false;

    if (!("serviceWorker" in navigator)) return false;

    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Get VAPID key
      let key = vapidPublicKey;
      if (!key) {
        // Try to get from server
        try {
          const res = await fetch("/api/push/vapid-key");
          if (res.ok) {
            const data = await res.json();
            key = data.key;
          }
        } catch {
          // If no VAPID key endpoint, use cached or return false
          key = localStorage.getItem(VAPID_PUBLIC_KEY_KEY) || undefined;
        }
      }

      if (!key) return false;

      // Save key for future use
      localStorage.setItem(VAPID_PUBLIC_KEY_KEY, key);

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(key);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }

    // Send subscription to server
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    return response.ok;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return false;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) return true;

    // Remove from server
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    // Unsubscribe locally
    await subscription.unsubscribe();

    return true;
  } catch (err) {
    console.error("Push unsubscribe failed:", err);
    return false;
  }
}

/**
 * Check if push notifications are currently enabled.
 */
export async function isPushEnabled(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
    if (Notification.permission !== "granted") return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

/**
 * Convert a URL-safe base64 string to a Uint8Array.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
