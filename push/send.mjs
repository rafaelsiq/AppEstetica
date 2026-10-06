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
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/datastore"] });
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
      try {
        await webpush.sendNotification({
          endpoint: device.endpoint,
          keys: { p256dh: device.p256dh, auth: device.auth }
        }, payload, { TTL: 12 * 60 * 60 });
        await markSent(token, id, notice.id, occurrence);
        sent += 1;
      } catch (error) {
        failed += 1;
        const status = error.statusCode || 0;
        console.error(JSON.stringify({ status, message: String(error.body || error.message || "").slice(0, 240) }));
        if (status === 404 || status === 410) {
          await firestore(token, `clientLinks/${link.id}/devices/${device.id}`, { method: "DELETE" }).catch(() => {});
        }
      }
    }
  }
}

console.log(JSON.stringify({ sent, failed, links: links.length }));
