import { useEffect, useState } from "react";
import ModalClose from "./ModalClose";

const DISMISS_KEY = "clinica-app-convite";
const SEEN_KEY = "clinica-app-visto";
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

export default function InstallAppPrompt({ clinicName }) {
  const [installEvent, setInstallEvent] = useState(() => window.__clinicaInstallPrompt || null);
  const [installed, setInstalled] = useState(() => isInstalled());
  const [permission, setPermission] = useState(() => notificationPermission());
  const [open, setOpen] = useState(false);

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
    const mobile = isMobile();
    const standalone = isInstalled();
    setInstalled(standalone);
    const currentPermission = notificationPermission();
    setPermission(currentPermission);
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    const needsInstall = mobile && !standalone;
    const needsNotification = currentPermission === "default" && (needsInstall || standalone);
    if (dismissed || (!needsInstall && !needsNotification)) {
      return undefined;
    }
    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      alreadySeen = false;
    }
    if (alreadySeen) {
      setOpen(true);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Segue sem lembrar desta visita.
      }
      setOpen(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, []);

  if (!open) {
    return null;
  }

  const ios = isIos();
  const canInstall = Boolean(installEvent) && !installed;
  const canAskNotification = permission === "default";

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
        setInstalled(true);
        if (notificationPermission() !== "default") {
          dismiss();
        }
      }
    } catch {
      // O navegador fechou o pedido de instalação.
    }
  }

  async function allowNotifications() {
    if (!("Notification" in window) || Notification.permission !== "default") {
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        window.dispatchEvent(new Event("clinica-notifications-granted"));
      }
      if (result !== "default" && (installed || isInstalled())) {
        dismiss();
      }
    } catch {
      // Este navegador não abriu o pedido de permissão.
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sem armazenamento, o convite só some nesta tela.
    }
    setOpen(false);
  }

  const title = installed ? "Ativar notificações" : "Instalar o aplicativo";
  const clinic = clinicName ? ` de ${clinicName}` : "";

  return (
    <div className="client-modal-backdrop install-app-backdrop" role="presentation">
      <section className="quiz-card install-app-modal" role="dialog" aria-modal="true" aria-labelledby="install-app-title">
        <div className="install-app-header">
          <h2 id="install-app-title">{title}</h2>
          <ModalClose onClick={dismiss} />
        </div>
        {installed ? (
          <p>Permita as notificações para a clínica poder avisar você neste celular.</p>
        ) : (
          <p>
            Adicione o acompanhamento{clinic} à tela inicial do celular.
            A instalação segue o padrão de aplicativo e abre direto neste acompanhamento.
            Permita também as notificações para receber avisos da clínica.
          </p>
        )}
        {!installed && ios ? (
          <ol className="install-app-steps">
            <li>Toque em Compartilhar na barra do navegador.</li>
            <li>Escolha Adicionar à Tela de Início.</li>
            <li>Confirme em Adicionar.</li>
          </ol>
        ) : null}
        {!installed && !ios && !canInstall ? (
          <p>No menu do navegador, toque em Instalar aplicativo ou Adicionar à tela inicial.</p>
        ) : null}
        <div className="install-app-actions">
          {canInstall ? (
            <button type="button" className="primary-btn" onClick={install}>Instalar</button>
          ) : null}
          {canAskNotification ? (
            <button type="button" className="primary-btn" onClick={allowNotifications}>Permitir notificações</button>
          ) : null}
          <button type="button" className="secondary-btn" onClick={dismiss}>Agora não</button>
        </div>
      </section>
    </div>
  );
}
