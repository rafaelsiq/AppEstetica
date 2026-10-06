import { useEffect, useState } from "react";
import ModalClose from "./ModalClose";

const INSTALL_DISMISS_KEY = "clinica-app-convite";
const NOTIFY_DISMISS_KEY = "clinica-notificacao-convite";
const INSTALL_SEEN_KEY = "clinica-app-visto";
const NOTIFY_SEEN_KEY = "clinica-notificacao-visto";
const DESTINATION_KEY = "clinica-app-destino";

function isIos() {
  const ua = window.navigator.userAgent || "";
  const iPadOs = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || iPadOs;
}

function isMobile() {
  const ua = window.navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod/i.test(ua)) {
    return true;
  }
  return window.matchMedia("(max-width: 900px)").matches && window.matchMedia("(pointer: coarse)").matches;
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || window.navigator.standalone === true;
}

function notificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function wasDismissed(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function rememberDismiss(key) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Sem armazenamento, o convite só some nesta tela.
  }
}

function sessionSeen(key) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markSessionSeen(key) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // Segue sem lembrar desta visita.
  }
}

function installNeeded() {
  return isMobile() && !isInstalled() && !wasDismissed(INSTALL_DISMISS_KEY);
}

function notifyNeeded() {
  return notificationPermission() === "default" && !wasDismissed(NOTIFY_DISMISS_KEY);
}

export default function ClientAccessPrompts({ clinicName, unlocked = false }) {
  const [installEvent, setInstallEvent] = useState(() => window.__clinicaInstallPrompt || null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installSettled, setInstallSettled] = useState(() => !installNeeded());
  const [notifyOpen, setNotifyOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(DESTINATION_KEY, window.location.pathname);
    } catch {
      // O navegador pode bloquear o armazenamento. A instalação continua pelo link atual.
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    setInstallEvent(window.__clinicaInstallPrompt || null);
    const onReady = () => setInstallEvent(window.__clinicaInstallPrompt || null);
    window.addEventListener("clinica-install-ready", onReady);
    return () => window.removeEventListener("clinica-install-ready", onReady);
  }, []);

  useEffect(() => {
    if (installSettled) {
      return undefined;
    }
    const delay = sessionSeen(INSTALL_SEEN_KEY) ? 0 : 700;
    const timer = window.setTimeout(() => {
      markSessionSeen(INSTALL_SEEN_KEY);
      setInstallOpen(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [installSettled]);

  useEffect(() => {
    if (!unlocked || !installSettled || installOpen || notifyOpen || !notifyNeeded()) {
      return undefined;
    }
    const delay = sessionSeen(NOTIFY_SEEN_KEY) ? 0 : 400;
    const timer = window.setTimeout(() => {
      markSessionSeen(NOTIFY_SEEN_KEY);
      setNotifyOpen(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [unlocked, installSettled, installOpen, notifyOpen]);

  function dismissInstall() {
    rememberDismiss(INSTALL_DISMISS_KEY);
    setInstallOpen(false);
    setInstallSettled(true);
  }

  function dismissNotify() {
    rememberDismiss(NOTIFY_DISMISS_KEY);
    setNotifyOpen(false);
  }

  async function install() {
    const event = installEvent;
    if (!event) {
      return;
    }
    setInstallEvent(null);
    window.__clinicaInstallPrompt = null;
    try {
      event.prompt();
      const choice = await event.userChoice;
      if (choice?.outcome === "accepted") {
        dismissInstall();
      }
    } catch {
      // O navegador fechou o pedido de instalação.
    }
  }

  async function allowNotifications() {
    if (!("Notification" in window) || Notification.permission !== "default") {
      dismissNotify();
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        try {
          const { getFcmRegistrationToken } = await import("./fcmTokens");
          const token = await getFcmRegistrationToken();
          console.log("FCM token:", token);
        } catch (error) {
          console.warn("FCM token:", error?.message || error);
        }
        window.dispatchEvent(new Event("clinica-notifications-granted"));
      }
      if (result !== "default") {
        setNotifyOpen(false);
      }
    } catch {
      // Este navegador não abriu o pedido de permissão.
    }
  }

  const clinic = clinicName ? ` de ${clinicName}` : "";
  const ios = isIos();
  const canInstall = Boolean(installEvent);

  if (installOpen) {
    return (
      <div className="client-modal-backdrop install-app-backdrop" role="presentation">
        <section className="quiz-card install-app-modal" role="dialog" aria-modal="true" aria-labelledby="install-app-title">
          <div className="install-app-header">
            <h2 id="install-app-title">Instalar o aplicativo</h2>
            <ModalClose onClick={dismissInstall} />
          </div>
          <p>
            Adicione o acompanhamento{clinic} à tela inicial do celular.
            A instalação segue o padrão de aplicativo e abre direto neste acompanhamento.
          </p>
          {ios ? (
            <ol className="install-app-steps">
              <li>Toque em Compartilhar na barra do navegador.</li>
              <li>Escolha Adicionar à Tela de Início.</li>
              <li>Confirme em Adicionar.</li>
            </ol>
          ) : null}
          {!ios && !canInstall ? (
            <p>No menu do navegador, toque em Instalar aplicativo ou Adicionar à tela inicial.</p>
          ) : null}
          <div className="install-app-actions">
            {canInstall ? (
              <button type="button" className="primary-btn" onClick={install}>Instalar</button>
            ) : null}
            <button type="button" className="secondary-btn" onClick={dismissInstall}>Agora não</button>
          </div>
        </section>
      </div>
    );
  }

  if (!notifyOpen) {
    return null;
  }

  return (
    <div className="client-modal-backdrop install-app-backdrop" role="presentation">
      <section className="quiz-card install-app-modal" role="dialog" aria-modal="true" aria-labelledby="notify-app-title">
        <div className="install-app-header">
          <h2 id="notify-app-title">Ativar notificações</h2>
          <ModalClose onClick={dismissNotify} />
        </div>
        <p>Permita as notificações para {clinicName || "a clínica"} avisar você neste celular.</p>
        <div className="install-app-actions">
          <button type="button" className="primary-btn" onClick={allowNotifications}>Permitir notificações</button>
          <button type="button" className="secondary-btn" onClick={dismissNotify}>Agora não</button>
        </div>
      </section>
    </div>
  );
}
