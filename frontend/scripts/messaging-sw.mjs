import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function firebaseVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "node_modules/firebase/package.json"), "utf8"));
    return pkg.version || "12.4.0";
  } catch {
    return "12.4.0";
  }
}

export function buildMessagingServiceWorker(env = process.env) {
  const version = firebaseVersion();
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY || "",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: env.VITE_FIREBASE_APP_ID || ""
  };

  return `/* Generated for Firebase Cloud Messaging — do not edit by hand. */
importScripts("https://www.gstatic.com/firebasejs/${version}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${version}/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config, null, 2)});
firebase.messaging();
`;
}
