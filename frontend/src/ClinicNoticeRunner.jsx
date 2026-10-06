import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useDeliverNotices } from "./noticeDelivery";
import { ensurePushSubscription } from "./pushSubscribe";
import ModalClose from "./ModalClose";

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
    const onNeed = () => {
      if ("Notification" in window && Notification.permission === "default") {
        setAsk(true);
      }
    };
    window.addEventListener("clinica-notice-needs-permission", onNeed);
    return () => window.removeEventListener("clinica-notice-needs-permission", onNeed);
  }, []);

  async function allow() {
    if (!("Notification" in window)) {
      setAsk(false);
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        window.dispatchEvent(new Event("clinica-notifications-granted"));
        await ensurePushSubscription(tokens).catch(() => {});
      }
    } catch {
      // O navegador não abriu o pedido.
    }
    setAsk(false);
  }

  if (!ask) {
    return null;
  }

  return (
    <div className="client-modal-backdrop install-app-backdrop" role="presentation">
      <section className="quiz-card install-app-modal" role="dialog" aria-modal="true" aria-labelledby="clinic-notify-title">
        <div className="install-app-header">
          <h2 id="clinic-notify-title">Ativar notificações</h2>
          <ModalClose onClick={() => setAsk(false)} />
        </div>
        <p>Permita as notificações para o aviso aparecer na área de notificações deste celular na hora marcada.</p>
        <div className="install-app-actions">
          <button type="button" className="primary-btn" onClick={allow}>Permitir notificações</button>
          <button type="button" className="secondary-btn" onClick={() => setAsk(false)}>Agora não</button>
        </div>
      </section>
    </div>
  );
}
