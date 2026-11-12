import { createHash } from "node:crypto";
import webpush from "web-push";
import { GoogleAuth } from "google-auth-library";
import { occurrenceKey, shouldNotify } from "../frontend/src/notificationSchedule.js";

const PROJECT = "clinica-estetica-a219";
const SITE = "https://clinica-estetica-a219.web.app";
const TIME_ZONE = "America/Sao_Paulo";

function valueOf(field) {
  if (!field) {
    return undefined;
  }
  if ("stringValue" in field) {
    return field.stringValue;
  }
  if ("booleanValue" in field) {
    return field.booleanValue;
  }
  if ("timestampValue" in field) {
    return field.timestampValue;
  }
  if ("integerValue" in field) {
    return Number(field.integerValue);
  }
  if ("arrayValue" in field) {
    return (field.arrayValue.values || []).map(valueOf);
  }
  return undefined;
}

function documentData(document) {
  const data = {};
  Object.entries(document.fields || {}).forEach(([key, field]) => {
    data[key] = valueOf(field);
  });
  data.id = document.name.split("/").pop();
  return data;
}

async function accessToken() {
  if (process.env.GOOGLE_ACCESS_TOKEN) {
    return process.env.GOOGLE_ACCESS_TOKEN;
  }
  const auth = new GoogleAuth({ scopes: [
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/firebase.messaging"
  ] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

async function firestore(token, path, options = {}) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status === 404) {
    return null;
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status} ${text.slice(0, 300)}`);
  }
  return data;
}

async function listDocuments(token, path) {
  const documents = [];
  let pageToken = "";
  do {
    const suffix = pageToken ? `?pageSize=100&pageToken=${encodeURIComponent(pageToken)}` : "?pageSize=100";
    const data = await firestore(token, `${path}${suffix}`);
    documents.push(...(data.documents || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return documents.map(documentData);
}

function clinicNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const read = (type) => Number(parts.find((part) => part.type === type).value);
  return new Date(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
}

function deliveryId(noticeId, occurrence, endpoint) {
  return createHash("sha256").update(`${noticeId}|${occurrence}|${endpoint}`).digest("hex").slice(0, 40);
}

async function alreadySent(token, id) {
  const found = await firestore(token, `pushDeliveries/${id}`);
  return Boolean(found);
}

async function markSent(token, id, noticeId, occurrence) {
  await firestore(token, `pushDeliveries?documentId=${id}`, {
    method: "POST",
    body: {
      fields: {
        noticeId: { stringValue: noticeId },
        occurrence: { stringValue: occurrence },
        sentAt: { timestampValue: new Date().toISOString() }
      }
    }
  });
}

const token = await accessToken();
const configDoc = await firestore(token, "pushConfig/vapid");
if (!configDoc) {
  throw new Error("Falta a configuração do envio.");
}
const config = documentData(configDoc);
webpush.setVapidDetails(SITE, config.publicKey, config.privateKey);

const now = clinicNow();
const links = await listDocuments(token, "clientLinks");
let sent = 0;
let failed = 0;
let bookings = 0;

async function deliver(device, payload, onGone) {
  try {
    await webpush.sendNotification({
      endpoint: device.endpoint,
      keys: { p256dh: device.p256dh, auth: device.auth }
    }, payload, { TTL: 12 * 60 * 60 });
    sent += 1;
    return true;
  } catch (error) {
    failed += 1;
    const status = error.statusCode || 0;
    console.error(JSON.stringify({ status, message: String(error.body || error.message || "").slice(0, 240) }));
    if (status === 404 || status === 410) {
      await onGone().catch(() => {});
    }
    return false;
  }
}

// App Android (Capacitor): envia pelo Firebase Cloud Messaging.
async function deliverFcm(device, notice, onGone) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token: device.fcmToken,
        notification: { title: notice.title, body: notice.body },
        data: { url: notice.url, tag: notice.tag },
        android: {
          priority: "high",
          ttl: "43200s",
          notification: { channel_id: notice.channel, tag: notice.tag, default_sound: true }
        }
      }
    })
  });
  if (response.ok) {
    sent += 1;
    return true;
  }
  failed += 1;
  const text = await response.text();
  console.error(JSON.stringify({ status: response.status, message: text.slice(0, 240) }));
  if (response.status === 404 || /UNREGISTERED|registration-token-not-registered/.test(text)) {
    await onGone().catch(() => {});
  }
  return false;
}

// Pedidos de agendamento novos: avisa os aparelhos da clínica dona do link.
const BOOKING_WINDOW_MS = 12 * 60 * 60 * 1000;
const PERIODS = { manha: "manhã", tarde: "tarde", noite: "noite", qualquer: "qualquer horário" };
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const ownerDevices = new Map();

function bookingBody(request) {
  const [year, month, day] = String(request.date || "").split("-").map(Number);
  const when = year
    ? `${WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}, ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`
    : "";
  const period = PERIODS[request.period] || "";
  const reasons = (request.reasons || []).join(", ");
  const head = [request.clientName, [when, period].filter(Boolean).join(", ")].filter(Boolean).join(" — ");
  return reasons ? `${head}
${reasons}` : head;
}

for (const link of links.filter((item) => item.type === "primeiro")) {
  const requests = (await listDocuments(token, `clientLinks/${link.id}/requests`))
    .filter((request) => request.status === "pendente"
      && request.createdAt
      && Date.now() - new Date(request.createdAt).getTime() < BOOKING_WINDOW_MS);
  if (!requests.length) {
    continue;
  }
  const secretDoc = await firestore(token, `clientLinks/${link.id}/secret/access`);
  const ownerId = secretDoc ? documentData(secretDoc).ownerId : "";
  if (!ownerId) {
    continue;
  }
  if (!ownerDevices.has(ownerId)) {
    ownerDevices.set(ownerId, await listDocuments(token, `users/${ownerId}/pushDevices`));
  }
  const devices = ownerDevices.get(ownerId);
  for (const request of requests) {
    for (const device of devices) {
      const webPush = device.endpoint && device.p256dh && device.auth;
      if (!webPush && !device.fcmToken) {
        continue;
      }
      const id = deliveryId(`agendamento:${request.id}`, link.id, device.fcmToken || device.endpoint);
      if (await alreadySent(token, id)) {
        continue;
      }
      const notice = {
        title: "Novo pedido de agendamento",
        body: bookingBody(request),
        url: `${SITE}/`,
        tag: `agendamento:${request.id}`,
        channel: "agendamentos"
      };
      const forget = () => firestore(token, `users/${ownerId}/pushDevices/${device.id}`, { method: "DELETE" });
      const ok = device.fcmToken
        ? await deliverFcm(device, notice, forget)
        : await deliver(device, JSON.stringify(notice), forget);
      if (ok) {
        await markSent(token, id, `agendamento:${request.id}`, link.id);
        bookings += 1;
      }
    }
  }
}

for (const link of links) {
  const notices = await listDocuments(token, `clientLinks/${link.id}/notices`);
  const devices = await listDocuments(token, `clientLinks/${link.id}/devices`);
  if (!devices.length) {
    continue;
  }
  for (const notice of notices) {
    if (!shouldNotify(notice, now)) {
      continue;
    }
    const occurrence = occurrenceKey(notice, now);
    for (const device of devices) {
      if (!device.endpoint || !device.p256dh || !device.auth) {
        continue;
      }
      const id = deliveryId(notice.id, occurrence, device.endpoint);
      if (await alreadySent(token, id)) {
        continue;
      }
      const payload = JSON.stringify({
        title: notice.title || "Aviso da clínica",
        body: notice.body || "",
        url: `${SITE}/c/${link.id}`,
        tag: `${notice.id}:${occurrence}`
      });
      const ok = await deliver(device, payload, () => firestore(token, `clientLinks/${link.id}/devices/${device.id}`, { method: "DELETE" }));
      if (ok) {
        await markSent(token, id, notice.id, occurrence);
      }
    }
  }
}

console.log(JSON.stringify({ sent, failed, bookings, links: links.length }));
