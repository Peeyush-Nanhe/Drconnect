/**
 * Browser push notification registration using Firebase Cloud Messaging.
 *
 * This module is safe to import from client code. It only talks to the
 * browser Firebase SDK and the app's own `registerDeviceToken` server function.
 *
 * The Firebase project credentials come from the Lovable Firebase Cloud
 * Messaging connector (VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_* env vars).
 * If those variables are not set, the helper returns `not-configured`.
 */

import { registerDeviceToken } from "./push.functions";

let app: any = null;
let messaging: any = null;

export type PushEnableResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" | "unavailable" };

function getFirebaseConfig() {
  const apiKey = (import.meta as any).env?.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY;
  const projectId = (import.meta as any).env?.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID;
  const appId = (import.meta as any).env?.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID;
  const vapidKey = (import.meta as any).env?.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY;
  const messagingSenderId = appId?.split(":")[1] ?? "";
  return { apiKey, projectId, appId, vapidKey, messagingSenderId };
}

async function ensureMessaging() {
  if (messaging) return messaging;
  const { apiKey, projectId, appId, messagingSenderId } = getFirebaseConfig();
  if (!apiKey || !projectId || !appId || !messagingSenderId) return null;
  try {
    const appMod = "firebase/app";
    const msgMod = "firebase/messaging";
    const { initializeApp } = await import(/* @vite-ignore */ appMod);
    const { getMessaging } = await import(/* @vite-ignore */ msgMod);
    app = initializeApp({ apiKey, projectId, appId, messagingSenderId });
    messaging = getMessaging(app);
    return messaging;
  } catch {
    return null;
  }
}

/**
 * Request notification permission and register this browser for push.
 * Must be called from a user gesture (button click) on a top-level page.
 */
export async function enablePushNotifications(): Promise<PushEnableResult> {
  const { vapidKey, appId } = getFirebaseConfig();
  if (!vapidKey || !appId) {
    return { status: "not-configured" };
  }
  if (typeof window === "undefined") {
    return { status: "unavailable" };
  }

  let isSupportedFn: any = null;
  let getTokenFn: any = null;
  try {
    const msgMod = "firebase/messaging";
    const fbm = await import(/* @vite-ignore */ msgMod);
    isSupportedFn = fbm.isSupported;
    getTokenFn = fbm.getToken;
  } catch {
    return { status: "not-configured" };
  }

  if (!("Notification" in window) || (isSupportedFn && !(await isSupportedFn()))) {
    return { status: "unsupported" };
  }
  if (window.top !== window.self) {
    return { status: "open-in-new-tab" };
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    return { status: "denied" };
  }

  const msg = await ensureMessaging();
  if (!msg || !getTokenFn) {
    return { status: "unavailable" };
  }

  try {
    const token = await getTokenFn(msg, { vapidKey });
    if (!token) return { status: "unavailable" };

    await (registerDeviceToken as any)({
      data: {
        token,
        platform: "web",
        deviceInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          registeredAt: new Date().toISOString(),
        },
      },
    });

    return { status: "registered", token };
  } catch (err) {
    console.warn("Could not register for push notifications:", err);
    return { status: "unavailable" };
  }
}
