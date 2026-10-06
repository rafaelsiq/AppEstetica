import { getInstallations, getId } from "firebase/installations";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { app } from "./firebase";

const MESSAGING_SW = "/firebase-messaging-sw.js";

export async function getFirebaseInstallationId() {
  return getId(getInstallations(app));
}

async function messagingRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Este navegador não tem Service Worker.");
  }
  return navigator.serviceWorker.register(MESSAGING_SW);
}

export async function getFcmRegistrationToken() {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error("Falta VITE_FIREBASE_VAPID_KEY no .env (certificado Web Push no Console).");
  }

  const supported = await isSupported();
  if (!supported) {
    throw new Error("Firebase Messaging não é suportado neste navegador.");
  }

  if (!("Notification" in window)) {
    throw new Error("Este navegador não permite notificações.");
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    throw new Error("Permita notificações no navegador para gerar o token FCM.");
  }

  const registration = await messagingRegistration();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error("O Firebase não devolveu um token FCM.");
  }
  return token;
}

export async function loadTestDeviceIds() {
  const result = { installationId: "", fcmToken: "", errors: [] };

  try {
    result.installationId = await getFirebaseInstallationId();
  } catch (error) {
    result.errors.push(error?.message || "Não foi possível ler o ID de instalação.");
  }

  try {
    result.fcmToken = await getFcmRegistrationToken();
  } catch (error) {
    result.errors.push(error?.message || "Não foi possível ler o token FCM.");
  }

  return result;
}
