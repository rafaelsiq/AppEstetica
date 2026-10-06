import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { noticeHistory } from "./notificationSchedule";

const NOTICE_TYPES = new Set(["anamnese", "acompanhamento", "evolucao", "consentimento"]);

export function clientNoticeTokens(links) {
  return [...new Set(
    (links || [])
      .filter((link) => NOTICE_TYPES.has(link.type))
      .map((link) => link.token || link.id)
      .filter((token) => typeof token === "string" && token.length > 0)
  )].sort();
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

export default function ClientReceivedNotices({ tokens, onOpen }) {
  const [byToken, setByToken] = useState({});
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const tokenKey = (tokens || []).join(",");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const list = tokenKey ? tokenKey.split(",") : [];
    if (!list.length) {
      setByToken({});
      return undefined;
    }
    const unsubscribers = list.map((token) => onSnapshot(
      collection(db, "clientLinks", token, "notices"),
      (snapshot) => {
        setByToken((current) => ({
          ...current,
          [token]: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        }));
        setNow(new Date());
      },
      () => {
        setByToken((current) => ({ ...current, [token]: [] }));
      }
    ));
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [tokenKey]);

  useEffect(() => {
    setOpen(false);
  }, [tokenKey]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const margin = 12;
      const width = Math.min(360, window.innerWidth - margin * 2);
      const alignedRight = Math.max(margin, window.innerWidth - rect.right);
      const maxRight = Math.max(margin, window.innerWidth - width - margin);
      const top = rect.bottom + 8;
      setBox({
        top,
        right: Math.min(alignedRight, maxRight),
        width,
        maxHeight: Math.max(160, window.innerHeight - top - 16)
      });
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const received = useMemo(() => {
    const allowed = new Set(tokenKey ? tokenKey.split(",") : []);
    const unique = new Map();
    allowed.forEach((token) => {
      (byToken[token] || []).forEach((notice) => {
        if (notice?.id && !unique.has(notice.id)) {
          unique.set(notice.id, notice);
        }
      });
    });
    return noticeHistory([...unique.values()], now);
  }, [byToken, tokenKey, now]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      if (next) {
        onOpen?.();
      }
      return next;
    });
  };

  return (
    <div className="header-notice-menu" ref={menuRef}>
      <button
        type="button"
        ref={buttonRef}
        className="header-notice-btn"
        aria-label="Notificações recebidas"
        aria-expanded={open}
        onClick={toggle}
      >
        <BellIcon />
      </button>
      {open ? (
        <section
          className="client-notice-panel header-notice-panel"
          aria-label="Notificações recebidas"
          style={box ? { top: box.top, right: box.right, width: box.width, maxHeight: box.maxHeight } : undefined}
        >
          <header>
            <strong>Notificações recebidas</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
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
  );
}
