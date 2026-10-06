import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { isNoticeDue, occurrenceKey } from "./notificationSchedule";

function seenKey(token, notice, now) {
  return `clinica-aviso:${token}:${notice.id}:${occurrenceKey(notice, now)}`;
}

function systemKey(token, notice, now) {
  return `clinica-aviso-sistema:${token}:${notice.id}:${occurrenceKey(notice, now)}`;
}

async function showSystemNotice(notice) {
  const image = String(notice.imageDataUrl || "");
  const options = {
    body: notice.body || "",
    icon: "/icon-192.png",
    tag: notice.id,
    data: { url: window.location.href }
  };
  if (image.startsWith("data:image/") && image.length < 200000) {
    options.image = image;
  }
  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
  if (registration) {
    await registration.showNotification(notice.title || "Aviso da clínica", options);
    return;
  }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(notice.title || "Aviso da clínica", options);
  }
}

export default function ClientNotices({ token, active }) {
  const [notices, setNotices] = useState([]);
  const [hidden, setHidden] = useState(() => new Set());
  const noticesRef = useRef([]);
  noticesRef.current = notices;

  useEffect(() => {
    if (!active || !token) {
      return undefined;
    }
    return onSnapshot(collection(db, "clientLinks", token, "notices"), (snapshot) => {
      const now = new Date();
      const due = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((notice) => isNoticeDue(notice, now) && localStorage.getItem(seenKey(token, notice, now)) !== "1");
      setNotices(due);
      if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
      }
      due.forEach((notice) => {
        const key = systemKey(token, notice, now);
        if (localStorage.getItem(key) === "1") {
          return;
        }
        localStorage.setItem(key, "1");
        showSystemNotice(notice).catch(() => {});
      });
    }, () => {});
  }, [active, token]);

  useEffect(() => {
    const refresh = () => {
      if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
      }
      const now = new Date();
      noticesRef.current.forEach((notice) => {
        const key = systemKey(token, notice, now);
        if (localStorage.getItem(key) === "1") {
          return;
        }
        localStorage.setItem(key, "1");
        showSystemNotice(notice).catch(() => {});
      });
    };
    window.addEventListener("clinica-notifications-granted", refresh);
    return () => window.removeEventListener("clinica-notifications-granted", refresh);
  }, [token]);

  const visible = notices.filter((notice) => !hidden.has(notice.id));
  if (!visible.length) {
    return null;
  }

  return (
    <div className="client-notices">
      {visible.map((notice) => (
        <article key={notice.id} className="client-notice">
          <div className="client-notice-heading">
            <strong>{notice.title}</strong>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                const now = new Date();
                localStorage.setItem(seenKey(token, notice, now), "1");
                setHidden((current) => new Set(current).add(notice.id));
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
