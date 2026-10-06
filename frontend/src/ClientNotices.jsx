import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { isNoticeDue, nextNoticeAt, noticeHistory, occurrenceKey } from "./notificationSchedule";

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

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5" />
      <path d="M4.5 16.5h15" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function formatReceivedAt(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()} às ${hours}:${minutes}`;
}

export default function ClientNotices({ token, active, history = false }) {
  const [stored, setStored] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [historyOpen, setHistoryOpen] = useState(false);
  const inflight = useRef(new Set());
  const delivered = useRef(new Set());
  const menuRef = useRef(null);

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

  useEffect(() => {
    if (!historyOpen) {
      return undefined;
    }
    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setHistoryOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [historyOpen]);

  if (!history) {
    return null;
  }

  const received = noticeHistory(stored, now);
  return (
    <div className="client-notice-top">
      <div className="client-notice-menu" ref={menuRef}>
        <button
          type="button"
          className="client-notice-bell"
          aria-label="Notificações"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((open) => !open)}
        >
          <BellIcon />
        </button>
        {historyOpen ? (
          <section className="client-notice-panel" aria-label="Notificações recebidas">
            <header>
              <strong>Notificações</strong>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Fechar">×</button>
            </header>
            {received.length === 0 ? <p className="muted-text">Nenhum aviso recebido ainda.</p> : (
              <ul>
                {received.map((item) => (
                  <li key={`${item.id}:${item.occurrence}`}>
                    <time dateTime={item.at.toISOString()}>{formatReceivedAt(item.at)}</time>
                    <strong>{item.title}</strong>
                    {item.body ? <p>{item.body}</p> : null}
                    {item.imageDataUrl.startsWith("data:image/") ? <img src={item.imageDataUrl} alt="" /> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
