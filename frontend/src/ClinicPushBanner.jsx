import { useEffect, useState } from "react";
import {
  clinicNotificationPermission,
  ensureClinicPushSubscription,
  isNativeApp,
  requestClinicNotificationPermission
} from "./pushSubscribe";

// Aviso fixo no topo do Início enquanto as notificações deste aparelho estão desligadas.
export default function ClinicPushBanner({ uid }) {
  const [permission, setPermission] = useState("granted");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () => {
      clinicNotificationPermission()
        .then((value) => {
          if (active) {
            setPermission(value);
          }
        })
        .catch((error) => console.error(error));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        check();
      }
    };
    check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("clinica-notifications-granted", check);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("clinica-notifications-granted", check);
    };
  }, []);

  if (permission === "granted" || permission === "unsupported") {
    return null;
  }

  async function enable() {
    setBusy(true);
    try {
      const result = await requestClinicNotificationPermission();
      setPermission(result);
      if (result === "granted") {
        window.dispatchEvent(new Event("clinica-notifications-granted"));
        await ensureClinicPushSubscription(uid).catch((error) => console.error(error));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setBusy(false);
    }
  }

  const blocked = permission === "denied";
  const where = isNativeApp
    ? "Configurações do celular > Apps > Minha Clínica > Notificações"
    : "as configurações do site no navegador";

  return (
    <section className="push-banner" role="status">
      <span className="push-banner-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5" />
          <path d="M4.5 16.5h15" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      </span>
      <div className="push-banner-text">
        <strong>{blocked ? "Notificações bloqueadas" : "Notificações desativadas"}</strong>
        <p>
          {blocked
            ? `Você não vai saber na hora quando uma cliente pedir um horário. Libere em ${where}.`
            : "Ative para receber neste aparelho os novos pedidos de agendamento das clientes."}
        </p>
      </div>
      <button type="button" className="primary-btn push-banner-btn" onClick={enable} disabled={busy}>
        {busy ? "Ativando..." : blocked ? "Tentar de novo" : "Ativar notificações"}
      </button>
    </section>
  );
}
