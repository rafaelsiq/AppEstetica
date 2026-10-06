import { phoneKey } from "./clientQuiz";
import { formatDatePt } from "./evolutionStory";

export const FIRST_CONTACT_SERVICE = "Primeiro atendimento";

export const FIRST_CONTACT_PERIODS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
  { value: "qualquer", label: "Qualquer horário" }
];

export const FIRST_CONTACT_REASONS = [
  "Massagem",
  "Alívio de dor",
  "Estética facial",
  "Estética corporal",
  "Avaliação"
];

const PERIOD_VALUES = FIRST_CONTACT_PERIODS.map((item) => item.value);

export function periodLabel(value) {
  return FIRST_CONTACT_PERIODS.find((item) => item.value === value)?.label || "A combinar";
}

export function bookingStatusLabel(status) {
  if (status === "pendente") {
    return "Pendente de aprovação";
  }
  if (status === "aprovado") {
    return "Aprovado";
  }
  if (status === "recusado") {
    return "Recusado";
  }
  if (status === "remarcacao") {
    return "Aguardando confirmação";
  }
  return "";
}

export function appointmentAgendaDate(appointment) {
  if (appointment?.status === "remarcacao" && appointment.suggestedDate) {
    return appointment.suggestedDate;
  }
  return appointment?.date || "";
}

export function formatPhoneBr(value) {
  const digits = phoneKey(value);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function personName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  return name || "cliente";
}

export function clientRequestMessage({ clientName, clinicName, date, period, reasons }) {
  const motives = (reasons || []).filter(Boolean).join(", ");
  return [
    `Olá, sou ${personName(clientName)}.`,
    `Quero solicitar o primeiro atendimento na ${clinicName || "clínica"}.`,
    `Dia: ${formatDatePt(date)}`,
    `Período: ${periodLabel(period)}`,
    `Motivo: ${motives}`
  ].join("\n");
}

export function approvalMessage({ clinicName, clientName, date, period }) {
  return [
    `Olá, ${personName(clientName)}.`,
    `Seu primeiro atendimento na ${clinicName || "clínica"} está confirmado.`,
    `Dia: ${formatDatePt(date)}`,
    `Período: ${periodLabel(period)}`
  ].join("\n");
}

export function refusalMessage({ clinicName, clientName, date }) {
  return [
    `Olá, ${personName(clientName)}.`,
    `Não será possível realizar o primeiro atendimento solicitado para ${formatDatePt(date)} na ${clinicName || "clínica"}.`
  ].join("\n");
}

export function rescheduleMessage({ clinicName, clientName, suggestedDate, reason }) {
  return [
    `Olá, ${personName(clientName)}.`,
    `Precisamos remarcar o primeiro atendimento na ${clinicName || "clínica"}.`,
    `Motivo: ${String(reason || "").trim()}`,
    `Nova data sugerida: ${formatDatePt(suggestedDate)}`,
    "Você confirma essa nova data?"
  ].join("\n");
}

export function whatsAppUrl(phone, message) {
  const digits = phoneKey(phone);
  const number = digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function isAllowedPeriod(value) {
  return PERIOD_VALUES.includes(value);
}

export function normalizeReasons(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return FIRST_CONTACT_REASONS.filter((reason) => values.includes(reason)).slice(0, FIRST_CONTACT_REASONS.length);
}
