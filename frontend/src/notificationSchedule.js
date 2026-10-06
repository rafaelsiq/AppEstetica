export const WEEKDAYS = [
  [1, "Seg"],
  [2, "Ter"],
  [3, "Qua"],
  [4, "Qui"],
  [5, "Sex"],
  [6, "Sáb"],
  [0, "Dom"]
];

export function emptyNotificationList(today) {
  return {
    name: "",
    title: "",
    body: "",
    imageDataUrl: "",
    frequency: "once",
    date: today,
    time: "09:00",
    weekdays: [1, 2, 3, 4, 5],
    monthDay: 1,
    until: "",
    audience: "all",
    clientIds: [],
    active: true
  };
}

export function validateNotificationList(list) {
  const name = String(list.name || "").trim();
  const title = String(list.title || "").trim();
  const body = String(list.body || "").trim();
  if (!name || name.length > 80) {
    return "Dê um nome para a lista, com até 80 caracteres.";
  }
  if (!title || title.length > 80) {
    return "Escreva o título da notificação, com até 80 caracteres.";
  }
  if (!body || body.length > 400) {
    return "Escreva o texto da notificação, com até 400 caracteres.";
  }
  if (!/^\d{2}:\d{2}$/.test(list.time || "")) {
    return "Informe o horário.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(list.date || "")) {
    return "Informe a data.";
  }
  if (list.frequency === "weekly" && (!Array.isArray(list.weekdays) || list.weekdays.length === 0)) {
    return "Escolha ao menos um dia da semana.";
  }
  if (list.frequency === "monthly") {
    const day = Number(list.monthDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      return "Escolha um dia do mês entre 1 e 28.";
    }
  }
  if ((list.audience === "only" || list.audience === "except") && !(list.clientIds || []).length) {
    return "Selecione ao menos uma cliente.";
  }
  if (list.until && list.until < list.date) {
    return "A data final precisa ser igual ou posterior ao início.";
  }
  return "";
}

export function targetClientIds(list, clients) {
  const all = clients.map((client) => client.id);
  const selected = new Set(list.clientIds || []);
  if (list.audience === "only") {
    return all.filter((id) => selected.has(id));
  }
  if (list.audience === "except") {
    return all.filter((id) => !selected.has(id));
  }
  return all;
}

export function targetTokens(list, clients, shareLinks) {
  const ids = new Set(targetClientIds(list, clients));
  const tokens = (shareLinks || [])
    .filter((link) => ids.has(link.clientId) && (link.type === "evolucao" || link.type === "acompanhamento"))
    .map((link) => link.token || link.id);
  return [...new Set(tokens)];
}

export function noticePayload(list) {
  return {
    listName: String(list.name || "").trim().slice(0, 80),
    title: String(list.title || "").trim().slice(0, 80),
    body: String(list.body || "").trim().slice(0, 400),
    imageDataUrl: String(list.imageDataUrl || ""),
    frequency: list.frequency,
    date: list.date || "",
    time: list.time,
    weekdays: list.frequency === "weekly" ? [...new Set((list.weekdays || []).map(Number))].filter((day) => day >= 0 && day <= 6) : [],
    monthDay: list.frequency === "monthly" ? Number(list.monthDay) || 1 : 0,
    until: list.until || "",
    active: list.active !== false
  };
}

function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function minutesOf(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(time || ""));
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

export function occurrenceKey(notice, now = new Date()) {
  if (!notice || notice.active === false) {
    return "";
  }
  if (notice.frequency === "once") {
    return "once";
  }
  if (notice.frequency === "monthly") {
    return dateKey(now).slice(0, 7);
  }
  return dateKey(now);
}

export function isNoticeDue(notice, now = new Date()) {
  if (!notice || notice.active === false) {
    return false;
  }
  const today = dateKey(now);
  if (notice.until && today > notice.until) {
    return false;
  }
  if (notice.date && today < notice.date) {
    return false;
  }
  const scheduled = minutesOf(notice.time);
  if (scheduled == null) {
    return false;
  }
  const current = now.getHours() * 60 + now.getMinutes();
  if (notice.frequency === "once") {
    return today > notice.date || (today === notice.date && current >= scheduled);
  }
  if (current < scheduled) {
    return false;
  }
  if (notice.frequency === "daily") {
    return true;
  }
  if (notice.frequency === "weekly") {
    return (notice.weekdays || []).map(Number).includes(now.getDay());
  }
  if (notice.frequency === "monthly") {
    return now.getDate() === Number(notice.monthDay);
  }
  return false;
}

function formatDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) {
    return iso || "";
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function frequencyLabel(list) {
  const time = list.time || "";
  if (list.frequency === "once") {
    return `Uma vez em ${formatDate(list.date)} às ${time}`;
  }
  if (list.frequency === "daily") {
    return `Todo dia às ${time}`;
  }
  if (list.frequency === "weekly") {
    const names = WEEKDAYS.filter(([day]) => (list.weekdays || []).map(Number).includes(day)).map(([, label]) => label);
    return `${names.join(", ") || "Semanal"} às ${time}`;
  }
  if (list.frequency === "monthly") {
    return `Todo mês, no dia ${list.monthDay}, às ${time}`;
  }
  return time;
}

export function audienceLabel(list, clients) {
  const names = (clients || [])
    .filter((client) => (list.clientIds || []).includes(client.id))
    .map((client) => client.name || "Cliente");
  if (list.audience === "except") {
    return names.length ? `Todas, exceto ${names.join(", ")}` : "Todas as clientes";
  }
  if (list.audience === "only") {
    return names.length ? `Somente ${names.join(", ")}` : "Nenhuma cliente selecionada";
  }
  return "Todas as clientes";
}
