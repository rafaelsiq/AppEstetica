import { Capacitor } from "@capacitor/core";

// Endereço público do site. No app Android a página roda em https://localhost,
// então links enviados para clientes precisam apontar para o site publicado.
export const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || "https://clinica-estetica-a219.web.app")
  .replace(/\/+$/, "");

export function siteOrigin() {
  return Capacitor.isNativePlatform() ? PUBLIC_SITE_URL : window.location.origin;
}
