import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { VAPID_PUBLIC_KEY } from "./vapidPublic";

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

function deviceId() {
  const key = "clinica-aparelho";
  try {
    const existing = localStorage.getItem(key);
    if (existing && /^[A-Za-z0-9]{16,40}$/.test(existing)) {
      return existing;
    }
    const created = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  }
}

function pushAvailable() {
  return "Notification" in window
    && Notification.permission === "granted"
    && "serviceWorker" in navigator
    && "PushManager" in window;
}

async function currentSubscription() {
  // A área da clínica não registra o worker no carregamento; registra aqui para receber push.
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) {
    await navigator.serviceWorker.register("/sw.js");
  }
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return null;
  }
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

export async function ensurePushSubscription(tokens) {
  const list = [...new Set((Array.isArray(tokens) ? tokens : [tokens]).filter(Boolean))];
  if (!list.length || !pushAvailable()) {
    return;
  }
  const device = await currentSubscription();
  if (!device) {
    return;
  }
  const id = deviceId();
  await Promise.all(list.map((token) => setDoc(doc(db, "clientLinks", token, "devices", id), device)));
}

// Aparelho da clínica: recebe o aviso de novos pedidos de agendamento.
export async function ensureClinicPushSubscription(uid) {
  if (!uid || !pushAvailable()) {
    return;
  }
  const device = await currentSubscription();
  if (!device) {
    return;
  }
  await setDoc(doc(db, "users", uid, "pushDevices", deviceId()), {
    ...device,
    userAgent: navigator.userAgent.slice(0, 200),
    updatedAt: new Date().toISOString()
  });
}
