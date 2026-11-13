import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import webpush from "web-push";
import { BOOKING_CHANNEL, BOOKING_TITLE, bookingBody, bookingDeliveryId } from "./bookingMessage.js";

initializeApp();
const db = getFirestore();
const SITE = "https://clinica-estetica-a219.web.app";

// Pedido de agendamento novo (link de primeiro atendimento): avisa na hora os aparelhos da clínica.
export const avisarPedidoDeAgendamento = onDocumentCreated(
  { document: "clientLinks/{token}/requests/{requestId}", region: "us-central1", retry: false },
  async (event) => {
    const request = event.data?.data();
    const { token, requestId } = event.params;
    if (!request || request.status !== "pendente") {
      return;
    }
    const secret = await db.doc(`clientLinks/${token}/secret/access`).get();
    const ownerId = secret.get("ownerId");
    if (!ownerId) {
      logger.warn("Link sem dona", { token });
      return;
    }
    const devices = await db.collection(`users/${ownerId}/pushDevices`).get();
    if (devices.empty) {
      logger.info("Clínica sem aparelho para avisar", { ownerId });
      return;
    }

    const notice = {
      title: BOOKING_TITLE,
      body: bookingBody(request),
      url: `${SITE}/`,
      tag: `agendamento:${requestId}`
    };
    let vapidReady = false;

    for (const device of devices.docs) {
      const data = device.data();
      const key = data.fcmToken || data.endpoint;
      if (!key) {
        continue;
      }
      const deliveryRef = db.doc(`pushDeliveries/${bookingDeliveryId(requestId, token, key)}`);
      // create() falha se já existir: garante um aviso só por aparelho.
      try {
        await deliveryRef.create({
          noticeId: notice.tag,
          occurrence: token,
          sentAt: FieldValue.serverTimestamp(),
          via: "function"
        });
      } catch {
        continue;
      }
      try {
        if (data.fcmToken) {
          await getMessaging().send({
            token: data.fcmToken,
            notification: { title: notice.title, body: notice.body },
            data: { url: notice.url, tag: notice.tag },
            android: {
              priority: "high",
              ttl: 12 * 60 * 60 * 1000,
              notification: { channelId: BOOKING_CHANNEL, tag: notice.tag, defaultSound: true }
            }
          });
        } else if (data.p256dh && data.auth) {
          if (!vapidReady) {
            const vapid = (await db.doc("pushConfig/vapid").get()).data();
            webpush.setVapidDetails(SITE, vapid.publicKey, vapid.privateKey);
            vapidReady = true;
          }
          await webpush.sendNotification(
            { endpoint: data.endpoint, keys: { p256dh: data.p256dh, auth: data.auth } },
            JSON.stringify(notice),
            { TTL: 12 * 60 * 60 }
          );
        }
        logger.info("Aviso enviado", { requestId, device: device.id });
      } catch (error) {
        await deliveryRef.delete().catch(() => {});
        const code = error.code || error.statusCode || "";
        logger.error("Falha no aviso", { requestId, device: device.id, code, message: String(error.message || error) });
        if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token", 404, 410].includes(code)) {
          await device.ref.delete().catch(() => {});
        }
      }
    }
  }
);
