import { createHash } from "node:crypto";

// Texto e identificador do aviso de novo pedido de agendamento.
// Usado pela Cloud Function (na hora) e pelo cron do GitHub Actions (reserva).
const PERIODS = { manha: "manhã", tarde: "tarde", noite: "noite", qualquer: "qualquer horário" };
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export const BOOKING_TITLE = "Novo pedido de agendamento";
export const BOOKING_CHANNEL = "agendamentos";

export function bookingBody(request) {
  const [year, month, day] = String(request.date || "").split("-").map(Number);
  const when = year
    ? `${WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}, ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`
    : "";
  const period = PERIODS[request.period] || "";
  const reasons = (request.reasons || []).join(", ");
  const head = [request.clientName, [when, period].filter(Boolean).join(", ")].filter(Boolean).join(" — ");
  return reasons ? `${head}\n${reasons}` : head;
}

// Mesmo id nos dois envios: quem enviar primeiro registra em pushDeliveries e o outro pula.
export function bookingDeliveryId(requestId, token, deviceKey) {
  return createHash("sha256").update(`agendamento:${requestId}|${token}|${deviceKey}`).digest("hex").slice(0, 40);
}
