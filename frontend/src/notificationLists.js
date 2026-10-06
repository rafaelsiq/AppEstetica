import { deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { noticePayload, targetTokens } from "./notificationSchedule";

const CHUNK = 400;

async function commitOps(ops) {
  for (let index = 0; index < ops.length; index += CHUNK) {
    const slice = ops.slice(index, index + CHUNK);
    if (!slice.length) {
      continue;
    }
    const batch = writeBatch(db);
    slice.forEach((op) => {
      if (op.type === "delete") {
        batch.delete(op.ref);
      } else {
        batch.set(op.ref, op.data);
      }
    });
    await batch.commit();
  }
}

export async function publishNotificationList({ listId, list, clients, shareLinks }) {
  const tokens = list.active === false ? [] : targetTokens(list, clients, shareLinks);
  const previous = list.deliveredTokens || [];
  const removed = previous.filter((token) => !tokens.includes(token));
  const payload = noticePayload(list);
  await commitOps([
    ...tokens.map((token) => ({
      type: "set",
      ref: doc(db, "clientLinks", token, "notices", listId),
      data: payload
    })),
    ...removed.map((token) => ({
      type: "delete",
      ref: doc(db, "clientLinks", token, "notices", listId)
    }))
  ]);
  return tokens;
}

export async function removeNotificationList(uid, list) {
  const tokens = list.deliveredTokens || [];
  await commitOps(tokens.map((token) => ({
    type: "delete",
    ref: doc(db, "clientLinks", token, "notices", list.id)
  })));
  await deleteDoc(doc(db, "users", uid, "notificationLists", list.id));
}
