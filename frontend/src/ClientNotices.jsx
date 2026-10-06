import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { noticeHistory } from "./notificationSchedule";
import { useDeliverNotices } from "./noticeDelivery";
import { ensurePushSubscription } from "./pushSubscribe";

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
  const menuRef = useRef(null);
  useDeliverNotices(active, stored);

  useEffect(() => {
    if (!active || !token) {
      return undefined;
    }
    ensurePushSubscription(token).catch(() => {});
    const onGrant = () => {
      ensurePushSubscription(token).catch(() => {});
    };
    window.addEventListener("clinica-notifications-granted", onGrant);
    return () => window.removeEventListener("clinica-notifications-granted", onGrant);
  }, [active, token]);

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
