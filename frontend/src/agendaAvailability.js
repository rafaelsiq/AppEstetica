import { doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

const CHUNK = 400;

export async function publishAgendaAvailability(tokens, availability) {
  const unique = [...new Set((tokens || []).filter(Boolean))];
  for (let index = 0; index < unique.length; index += CHUNK) {
    const slice = unique.slice(index, index + CHUNK);
    if (!slice.length) {
      continue;
    }
    const batch = writeBatch(db);
    slice.forEach((token) => {
      batch.set(doc(db, "clientLinks", token, "availability", "off"), availability);
    });
    await batch.commit();
  }
}
