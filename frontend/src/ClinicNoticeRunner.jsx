import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useDeliverNotices } from "./noticeDelivery";
import {
  clinicNotificationPermission,
  ensureClinicPushSubscription,
  ensurePushSubscription,
  requestClinicNotificationPermission
} from "./pushSubscribe";
import ModalClose from "./ModalClose";

const ASK_DISMISS_KEY = "clinica-agenda-push-adiado";
const ASK_AGAIN_MS = 3 * 24 * 60 * 60 * 1000;

function askDismissedRecently() {
  try {
    const at = Number(localStorage.getItem(ASK_DISMISS_KEY) || 0);
    return Date.now() - at < ASK_AGAIN_MS;
  } catch {
    return false;
  }
}

function rememberAskDismissed() {
  try {
    localStorage.setItem(ASK_DISMISS_KEY, String(Date.now()));
  } catch {
    // Sem armazenamento, o pedido volta na próxima abertura.
  }
}

export default function ClinicNoticeRunner({ uid, tokens = [] }) {
  const [lists, setLists] = useState([]);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    return onSnapshot(collection(db, "users", uid, "notificationLists"), (snapshot) => {
      setLists(snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((list) => list.active !== false));
    }, () => {});
  }, [uid]);

  useDeliverNotices(Boolean(uid), lists);

  const tokenKey = tokens.join(",");
  useEffect(() => {
    if (!tokenKey || !("Notification" in window) || Notification.permission !== "granted") {
      return undefined;
    }
    ensurePushSubscription(tokenKey.split(",")).catch(() => {});
    return undefined;
  }, [tokenKey]);

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let timer = 0;
    let active = true;
    clinicNotificationPermission().then((permission) => {
      if (!active) {
        return;
      }
      if (permission === "granted") {
        ensureClinicPushSubscription(uid).catch(() => {});
        return;
      }
      if (permission === "default" && !askDismissedRecently()) {
        timer = window.setTimeout(() => setAsk(true), 800);
      }
    }).catch(() => {});
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [uid]);

  function dismiss() {
    rememberAskDismissed();
    setAsk(false);
  }

  useEffect(() => {
    const onNeed = () => {
      if ("Notification" in window && Notification.permission === "default") {
        setAsk(true);
      }
    };
    window.addEventListener("clinica-notice-needs-permission", onNeed);
    return () => window.removeEventListener("clinica-notice-needs-permission", onNeed);
  }, []);

  async function allow() {
    try {
      const result = await requestClinicNotificationPermission();
      if (result === "granted") {
        window.dispatchEvent(new Event("clinica-notifications-granted"));
        await Promise.all([
          ensurePushSubscription(tokens).catch(() => {}),
          ensureClinicPushSubscription(uid).catch((error) => console.error(error))
        ]);
      }
    } catch {
      // O navegador não abriu o pedido.
    }
    dismiss();
  }

  if (!ask) {
    return null;
  }

  return (
    <div className="client-modal-backdrop install-app-backdrop" role="presentation">
      <section className="quiz-card install-app-modal" role="dialog" aria-modal="true" aria-labelledby="clinic-notify-title">
        <div className="install-app-header">
          <h2 id="clinic-notify-title">Ativar notificações</h2>
          <ModalClose onClick={dismiss} />
        </div>
        <p>Permita as notificações para receber neste celular os novos pedidos de agendamento das clientes e os avisos na hora marcada.</p>
        <div className="install-app-actions">
          <button type="button" className="primary-btn" onClick={allow}>Permitir notificações</button>
          <button type="button" className="secondary-btn" onClick={dismiss}>Agora não</button>
        </div>
      </section>
    </div>
  );
}
