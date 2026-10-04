import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { phoneKey, sanitizeAnamneseAnswers, sanitizeFollowupAnswers } from "./clientQuiz";

export function shareUrl(token) {
  return `${window.location.origin}/c/${token}`;
}

export function slimCheckpoints(checkpoints) {
  return [...checkpoints]
    .filter((item) => item.date)
    .sort((first, second) => String(first.date).localeCompare(String(second.date)))
    .map((item) => ({
      date: item.date,
      sessionNumber: item.sessionNumber || "",
      painLevel: Number(item.painLevel || 0),
      stressLevel: Number(item.stressLevel || 0),
      sleepHours: Number(item.sleepHours || 0),
      sessionType: item.sessionType || "",
      moment: item.moment || "clinica"
    }));
}

function isEmptyAnswer(value) {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

export async function createShareLink({
  uid,
  client,
  clinicName,
  type,
  moment = "",
  comments = "",
  checkpoints = []
}) {
  const token = crypto.randomUUID().replace(/-/g, "");
  const normalizedPhone = phoneKey(client.phone);
  if (type === "evolucao" && !normalizedPhone) {
    throw new Error("Cadastre o telefone da cliente antes de gerar o link da evolução.");
  }

  await setDoc(doc(db, "clientLinks", token, "secret", "access"), {
    ownerId: uid,
    clientId: client.id,
    phoneKey: normalizedPhone,
    type
  });

  const firstName = String(client.name || "Cliente").trim().split(" ")[0];
  await setDoc(doc(db, "clientLinks", token), {
    type,
    clientFirstName: firstName,
    clinicName: clinicName || "Clínica",
    status: type === "evolucao" ? "ativo" : "aberto",
    moment: moment || "",
    createdAt: serverTimestamp()
  });

  if (type === "evolucao") {
    await setDoc(doc(db, "clientLinks", token, "views", normalizedPhone), {
      clientFirstName: firstName,
      clinicName: clinicName || "Clínica",
      comments: comments.trim(),
      checkpoints: slimCheckpoints(checkpoints)
    });
  }

  await setDoc(doc(db, "users", uid, "shareLinks", token), {
    token,
    type,
    clientId: client.id,
    clientName: client.name || "",
    moment: moment || "",
    comments: comments.trim(),
    status: type === "evolucao" ? "ativo" : "aberto",
    imported: false,
    createdAt: serverTimestamp()
  });

  return token;
}

export async function updateEvolutionLink({ uid, token, phone, comments, checkpoints, clinicName, clientName }) {
  const normalizedPhone = phoneKey(phone);
  if (!normalizedPhone) {
    throw new Error("Cadastre o telefone da cliente antes de atualizar a evolução.");
  }
  const secretRef = doc(db, "clientLinks", token, "secret", "access");
  const secretSnap = await getDoc(secretRef);
  const previousKey = secretSnap.exists() ? secretSnap.data().phoneKey : "";
  if (previousKey !== normalizedPhone) {
    await updateDoc(secretRef, { phoneKey: normalizedPhone });
  }
  const firstName = String(clientName || "Cliente").trim().split(" ")[0];
  await setDoc(doc(db, "clientLinks", token, "views", normalizedPhone), {
    clientFirstName: firstName,
    clinicName: clinicName || "Clínica",
    comments: comments.trim(),
    checkpoints: slimCheckpoints(checkpoints)
  });
  if (previousKey && previousKey !== normalizedPhone) {
    await deleteDoc(doc(db, "clientLinks", token, "views", previousKey));
  }
  await updateDoc(doc(db, "users", uid, "shareLinks", token), {
    comments: comments.trim()
  });
}

export async function importSubmittedLink(uid, link, helpers) {
  const publicSnap = await getDoc(doc(db, "clientLinks", link.id));
  if (!publicSnap.exists() || publicSnap.data().status !== "respondido") {
    return;
  }
  const data = publicSnap.data();

  if (data.type === "anamnese") {
    const answers = sanitizeAnamneseAnswers(data.answers || {});
    const anamneseRef = doc(db, "users", uid, "anamneses", link.clientId);
    const existingSnap = await getDoc(anamneseRef);
    const existing = existingSnap.exists() ? existingSnap.data() : {};
    const patch = {};
    Object.entries(answers).forEach(([key, value]) => {
      if (isEmptyAnswer(existing[key])) {
        patch[key] = value;
      }
    });
    if (Array.isArray(patch.painAreas) && (!Array.isArray(existing.painSelections) || existing.painSelections.length === 0)) {
      const selections = patch.painAreas.map((label) => helpers.defaultPain(label)).filter(Boolean);
      patch.painSelections = selections;
      patch.painAreas = selections.map((item) => item.label);
    }
    await setDoc(
      anamneseRef,
      {
        ...patch,
        clientId: link.clientId,
        clientName: link.clientName || data.clientFirstName || "",
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  if (data.type === "acompanhamento") {
    const answers = sanitizeFollowupAnswers(data.answers || {});
    const checkpointsRef = collection(db, "users", uid, "anamneses", link.clientId, "checkpoints");
    const existingSnap = await getDocs(checkpointsRef);
    const items = existingSnap.docs.map((item) => item.data());
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const importedCheckpoint = {
      date: today,
      sessionNumber: String(helpers.nextSession(items)),
      sessionType: answers.sessionType || "",
      painLevel: Number(answers.painLevel || 0),
      stressLevel: Number(answers.stressLevel || 0),
      sleepHours: Number(answers.sleepHours || 0),
      observations: "",
      source: "cliente",
      moment: link.moment || data.moment || "",
      shareToken: link.id
    };
    if (!items.some((item) => item.shareToken === link.id)) {
      await addDoc(checkpointsRef, {
        ...importedCheckpoint,
        createdAt: serverTimestamp()
      });
      items.push(importedCheckpoint);
    }
    await refreshEvolutionSnapshot(uid, link, items);
  }

  await updateDoc(doc(db, "users", uid, "shareLinks", link.id), {
    imported: true,
    status: "importado"
  });
}

async function refreshEvolutionSnapshot(uid, link, checkpoints) {
  const linksSnap = await getDocs(collection(db, "users", uid, "shareLinks"));
  const evolution = linksSnap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .find((item) => item.clientId === link.clientId && item.type === "evolucao");
  if (!evolution) {
    return;
  }
  const clientSnap = await getDoc(doc(db, "users", uid, "clients", link.clientId));
  const phone = clientSnap.exists() ? clientSnap.data().phone : "";
  if (!phoneKey(phone)) {
    return;
  }
  const publicSnap = await getDoc(doc(db, "clientLinks", evolution.id));
  await updateEvolutionLink({
    uid,
    token: evolution.id,
    phone,
    comments: evolution.comments || "",
    checkpoints,
    clinicName: publicSnap.exists() ? publicSnap.data().clinicName : "",
    clientName: link.clientName || clientSnap.data()?.name || ""
  });
}
