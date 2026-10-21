import { useEffect, useState } from "react";
import { nextNoticeAt, occurrenceKey, shouldNotify } from "./notificationSchedule";

const inflight = new Set();
const delivered = new Set();
let permissionAsked = false;

function systemKey(notice, now) {
  return `clinica-aviso-sistema:${notice.id}:${occurrenceKey(notice, now)}`;
}

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sem armazenamento, o aviso pode voltar nesta visita.
  }
}

function noticeOptions(notice, extras) {
  return {
    body: notice.body || "",
    tag: systemKey(notice, new Date()),
    lang: "pt-BR",
    data: { url: window.location.href },
    ...extras
  };
}

async function workerRegistration() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      return existing;
    }
  } catch {
    // Segue para o registro ativo.
  }
  const ready = navigator.serviceWorker.ready.then((registration) => registration).catch(() => null);
  const timeout = new Promise((resolve) => {
    window.setTimeout(() => resolve(null), 4000);
  });
  return Promise.race([ready, timeout]);
}

export async function showSystemNotice(notice) {
  const title = notice.title || "Aviso da clínica";
  const icon = new URL("/icon-192.png", window.location.origin).href;
  const image = String(notice.imageDataUrl || "");
  const rich = { icon, vibrate: [180, 80, 180], renotify: true };
  if (image.startsWith("data:image/") && image.length < 200000) {
    rich.image = image;
  }
  const attempts = [
    noticeOptions(notice, { ...rich, requireInteraction: true }),
    noticeOptions(notice, rich),
    noticeOptions(notice, { icon }),
    noticeOptions(notice, {})
  ];
  const registration = await workerRegistration();
  let lastError = null;
  for (const options of attempts) {
    try {
      if (registration) {
        await registration.showNotification(title, options);
      } else if (!("Notification" in window) || Notification.permission !== "granted") {
        throw new Error("sem-notificacao");
      } else {
        new Notification(title, options);
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("sem-notificacao");
}

export function deliverDueNotices(notices, now = new Date()) {
  const due = (notices || []).filter((notice) => notice?.id && shouldNotify(notice, now));
  if (!due.length) {
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") {
    if ("Notification" in window && Notification.permission === "default" && !permissionAsked) {
      permissionAsked = true;
      window.dispatchEvent(new Event("clinica-notice-needs-permission"));
    }
    return;
  }
  permissionAsked = false;
  due.forEach((notice) => {
    const key = systemKey(notice, now);
    if (storageGet(key) === "1" || delivered.has(key) || inflight.has(key)) {
      return;
    }
    inflight.add(key);
    showSystemNotice(notice)
      .then(() => {
        delivered.add(key);
        storageSet(key, "1");
      })
      .catch(() => {})
      .finally(() => {
        inflight.delete(key);
      });
  });
}

export function useDeliverNotices(active, notices) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const tick = () => setNow(new Date());
    const interval = window.setInterval(tick, 1000);
    window.addEventListener("clinica-notifications-granted", tick);
    window.addEventListener("focus", tick);
    window.addEventListener("pageshow", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("clinica-notifications-granted", tick);
      window.removeEventListener("focus", tick);
      window.removeEventListener("pageshow", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const upcoming = (notices || [])
      .map((notice) => nextNoticeAt(notice, now))
      .filter(Boolean)
      .sort((first, second) => first.getTime() - second.getTime())[0];
    if (!upcoming) {
      return undefined;
    }
    const delay = Math.max(200, Math.min(upcoming.getTime() - now.getTime() + 200, 2147483647));
    const timer = window.setTimeout(() => setNow(new Date()), delay);
    return () => window.clearTimeout(timer);
  }, [active, notices, now]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    deliverDueNotices(notices, now);
  }, [active, notices, now]);
}
