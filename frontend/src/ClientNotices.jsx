import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { isNoticeDue, nextNoticeAt, occurrenceKey } from "./notificationSchedule";

function seenKey(token, notice, now) {
  return `clinica-aviso:${token}:${notice.id}:${occurrenceKey(notice, now)}`;
}

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

function noticeOptions(notice, withIcon) {
  const options = {
    body: notice.body || "",
    tag: `${notice.id}:${occurrenceKey(notice)}`,
    data: { url: window.location.href }
  };
  if (withIcon) {
    options.icon = new URL("/icon-192.png", window.location.origin).href;
    const image = String(notice.imageDataUrl || "");
    if (image.startsWith("data:image/") && image.length < 200000) {
      options.image = image;
    }
  }
  return options;
}

async function workerRegistration() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  const ready = navigator.serviceWorker.ready.then((registration) => registration).catch(() => null);
  const timeout = new Promise((resolve) => {
    window.setTimeout(() => resolve(null), 4000);
  });
  return Promise.race([ready, timeout]);
}

async function showSystemNotice(notice) {
  const title = notice.title || "Aviso da clínica";
  const registration = await workerRegistration();
  if (registration) {
    try {
      await registration.showNotification(title, noticeOptions(notice, true));
      return;
    } catch {
      await registration.showNotification(title, noticeOptions(notice, false));
      return;
    }
  }
  if (!("Notification" in window) || Notification.permission !== "granted") {
    throw new Error("sem-notificacao");
  }
  try {
    new Notification(title, noticeOptions(notice, true));
  } catch {
    new Notification(title, noticeOptions(notice, false));
  }
}

export default function ClientNotices({ token, active }) {
  const [stored, setStored] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [hidden, setHidden] = useState(() => new Set());
  const inflight = useRef(new Set());
  const delivered = useRef(new Set());

  useEffect(() => {
    if (!active || !token) {
      return undefined;
    }
    return onSnapshot(collection(db, "clientLinks", token, "notices"), (snapshot) => {
      setStored(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setNow(new Date());
    }, () => {});
  }, [active, token]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const tick = () => setNow(new Date());
    const interval = window.setInterval(tick, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    window.addEventListener("clinica-notifications-granted", tick);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("clinica-notifications-granted", tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const upcoming = stored
      .map((notice) => nextNoticeAt(notice, now))
      .filter(Boolean)
      .sort((first, second) => first.getTime() - second.getTime())[0];
    if (!upcoming) {
      return undefined;
    }
    const delay = Math.max(250, Math.min(upcoming.getTime() - now.getTime() + 250, 2147483647));
    const timer = window.setTimeout(() => setNow(new Date()), delay);
    return () => window.clearTimeout(timer);
  }, [active, stored, now]);

  useEffect(() => {
    if (!active || !("Notification" in window) || Notification.permission !== "granted") {
      return undefined;
    }
    stored.forEach((notice) => {
      if (!isNoticeDue(notice, now)) {
        return;
      }
      const key = systemKey(notice, now);
      if (storageGet(key) === "1" || delivered.current.has(key) || inflight.current.has(key)) {
        return;
      }
      inflight.current.add(key);
      showSystemNotice(notice)
        .then(() => {
          delivered.current.add(key);
          storageSet(key, "1");
        })
        .catch(() => {})
        .finally(() => {
          inflight.current.delete(key);
        });
    });
    return undefined;
  }, [active, stored, now]);

  const due = stored.filter((notice) => isNoticeDue(notice, now) && storageGet(seenKey(token, notice, now)) !== "1");
  const visible = due.filter((notice) => !hidden.has(`${notice.id}:${occurrenceKey(notice, now)}`));
  if (!visible.length) {
    return null;
  }

  return (
    <div className="client-notices">
      {visible.map((notice) => (
        <article key={`${notice.id}:${occurrenceKey(notice, now)}`} className="client-notice">
          <div className="client-notice-heading">
            <strong>{notice.title}</strong>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                storageSet(seenKey(token, notice, now), "1");
                setHidden((current) => new Set(current).add(`${notice.id}:${occurrenceKey(notice, now)}`));
              }}
            >
              Ok
            </button>
          </div>
          {notice.body ? <p>{notice.body}</p> : null}
          {String(notice.imageDataUrl || "").startsWith("data:image/") ? <img src={notice.imageDataUrl} alt="" /> : null}
        </article>
      ))}
    </div>
  );
}
