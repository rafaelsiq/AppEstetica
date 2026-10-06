import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { phoneKey, sanitizeAnamneseAnswers, sanitizeFollowupAnswers } from "./clientQuiz";
import { clinicHandle, sanitizeEvolutionStory } from "./evolutionStory";
import { FIRST_CONTACT_SERVICE } from "./firstContact";
import { IMAGE_CONSENT_TEXT, IMAGE_CONSENT_VERSION } from "./imageConsent";
import { normalizeReadings } from "./trackingParameters";

export function shareUrl(token) {
  return `${window.location.origin}/c/${token}`;
}

export function isClientFeedback(item) {
  return item?.kind === "feedback" || item?.source === "cliente";
}

export function slimCheckpoints(checkpoints) {
  return [...checkpoints]
    .filter((item) => item.date && !isClientFeedback(item))
    .sort((first, second) => String(first.date).localeCompare(String(second.date)))
    .map((item) => ({
      date: item.date,
      sessionNumber: item.sessionNumber || "",
      painLevel: Number(item.painLevel || 0),
      stressLevel: Number(item.stressLevel || 0),
      sleepHours: Number(item.sleepHours || 0),
      sessionType: item.sessionType || "",
      moment: item.moment || "clinica",
      parameters: normalizeReadings(item.parameters)
    }));
}

function isEmptyAnswer(value) {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function sanitizeLogoDataUrl(value) {
  const logo = String(value || "");
  return logo.startsWith("data:image/") ? logo : "";
}

export async function createShareLink({
  uid,
  client,
  clinicName,
  type,
  moment = "",
  comments = "",
  highlight = "",
  homeCare = "",
  checkpoints = [],
  instagram = "",
  logoDataUrl = ""
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
    ...(type === "consentimento"
      ? { termVersion: IMAGE_CONSENT_VERSION, termText: IMAGE_CONSENT_TEXT }
      : {}),
    logoDataUrl: sanitizeLogoDataUrl(logoDataUrl),
    createdAt: serverTimestamp()
  });

  const story = type === "evolucao" ? sanitizeEvolutionStory({ comments, highlight, homeCare }) : null;
  const handle = story ? clinicHandle(instagram) : "";
  if (type === "evolucao") {
    await setDoc(doc(db, "clientLinks", token, "views", normalizedPhone), {
      clientFirstName: firstName,
      clinicName: clinicName || "Clínica",
      highlight: story.highlight,
      comments: story.comments,
      homeCare: story.homeCare,
      instagram: handle,
      checkpoints: slimCheckpoints(checkpoints)
    });
  }

  await setDoc(doc(db, "users", uid, "shareLinks", token), {
    token,
    type,
    clientId: client.id,
    clientName: client.name || "",
    moment: moment || "",
    comments: story ? story.comments : comments.trim(),
    ...(story ? { highlight: story.highlight, homeCare: story.homeCare, instagram: handle } : {}),
    status: type === "evolucao" ? "ativo" : "aberto",
    imported: false,
    ...(type === "consentimento"
      ? { termVersion: IMAGE_CONSENT_VERSION, termText: IMAGE_CONSENT_TEXT }
      : {}),
    createdAt: serverTimestamp()
  });

  return token;
}

export async function createFirstContactLink({ uid, clinicName, clinicPhone, logoDataUrl = "" }) {
  const normalizedPhone = phoneKey(clinicPhone);
  if (!/^\d{10,13}$/.test(normalizedPhone)) {
    throw new Error("Cadastre seu telefone em Meu cadastro antes de gerar o link.");
  }
  const token = crypto.randomUUID().replace(/-/g, "");
  await setDoc(doc(db, "clientLinks", token, "secret", "access"), {
    ownerId: uid,
    clientId: "",
    phoneKey: "",
    type: "primeiro"
  });
  await setDoc(doc(db, "clientLinks", token), {
    type: "primeiro",
    clinicName: clinicName || "Clínica",
    clinicPhone: normalizedPhone,
    status: "ativo",
    logoDataUrl: sanitizeLogoDataUrl(logoDataUrl),
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "users", uid, "shareLinks", token), {
    token,
    type: "primeiro",
    clientId: "",
    clientName: "",
    status: "ativo",
    imported: false,
    clinicPhone: normalizedPhone,
    createdAt: serverTimestamp()
  });
  return token;
}

export async function importFirstContactRequest(uid, token, requestId, data) {
  if (data?.hidden === true) {
    return false;
  }
  const clientName = String(data?.clientName || "").trim();
  const date = String(data?.date || "");
  if (!clientName || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const appointmentRef = doc(db, "users", uid, "appointments", `pedido-${requestId}`);
  const status = ["pendente", "aprovado", "recusado", "remarcacao"].includes(data.status)
    ? data.status
    : "pendente";
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(appointmentRef);
    if (existing.exists()) {
      return false;
    }
    transaction.set(appointmentRef, {
      client: clientName,
      service: FIRST_CONTACT_SERVICE,
      date,
      time: "",
      notes: "",
      status,
      clientPhone: String(data.clientPhone || ""),
      period: String(data.period || ""),
      reasons: Array.isArray(data.reasons) ? data.reasons.filter((item) => typeof item === "string") : [],
      requestId,
      shareToken: token,
      suggestedDate: typeof data.suggestedDate === "string" ? data.suggestedDate : "",
      rescheduleReason: typeof data.rescheduleReason === "string" ? data.rescheduleReason : "",
      createdAt: serverTimestamp()
    });
    return true;
  });
}

export async function updateEvolutionLink({
  uid,
  token,
  phone,
  comments,
  highlight = "",
  homeCare = "",
  checkpoints,
  clinicName,
  clientName,
  instagram = ""
}) {
  const normalizedPhone = phoneKey(phone);
  if (!normalizedPhone) {
    throw new Error("Cadastre o telefone da cliente antes de atualizar a evolução.");
  }
  const story = sanitizeEvolutionStory({ comments, highlight, homeCare });
  const handle = clinicHandle(instagram);
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
    highlight: story.highlight,
    comments: story.comments,
    homeCare: story.homeCare,
    instagram: handle,
    checkpoints: slimCheckpoints(checkpoints)
  });
  if (previousKey && previousKey !== normalizedPhone) {
    await deleteDoc(doc(db, "clientLinks", token, "views", previousKey));
  }
  await updateDoc(doc(db, "users", uid, "shareLinks", token), {
    comments: story.comments,
    highlight: story.highlight,
    homeCare: story.homeCare,
    instagram: handle
  });
}

export async function syncClinicLogo(uid, logoDataUrl) {
  const logo = sanitizeLogoDataUrl(logoDataUrl);
  const linksSnap = await getDocs(collection(db, "users", uid, "shareLinks"));
  await Promise.all(linksSnap.docs.map(async (item) => {
    const linkRef = doc(db, "clientLinks", item.id);
    const snap = await getDoc(linkRef);
    if (!snap.exists() || String(snap.data().logoDataUrl || "") === logo) {
      return;
    }
    await updateDoc(linkRef, { logoDataUrl: logo });
  }));
}

export async function syncEvolutionInstagram(uid, instagram) {
  const handle = clinicHandle(instagram);
  const linksSnap = await getDocs(collection(db, "users", uid, "shareLinks"));
  const evolutions = linksSnap.docs.filter((item) => item.data().type === "evolucao");
  await Promise.all(evolutions.map(async (item) => {
    const secretSnap = await getDoc(doc(db, "clientLinks", item.id, "secret", "access"));
    const key = secretSnap.exists() ? secretSnap.data().phoneKey : "";
    if (key) {
      await setDoc(doc(db, "clientLinks", item.id, "views", key), { instagram: handle }, { merge: true });
    }
    await updateDoc(doc(db, "users", uid, "shareLinks", item.id), { instagram: handle });
  }));
}

export async function importSubmittedLink(uid, link, helpers) {
  const publicSnap = await getDoc(doc(db, "clientLinks", link.id));
  if (!publicSnap.exists() || publicSnap.data().status !== "respondido") {
    return;
  }
  const data = publicSnap.data();

  if (data.type === "consentimento") {
    const imageUse = data.answers?.imageUse === "autorizado"
      ? "autorizado"
      : data.answers?.imageUse === "negado"
        ? "negado"
        : "";
    if (!imageUse) {
      return;
    }
    await updateDoc(doc(db, "users", uid, "shareLinks", link.id), {
      imported: true,
      status: "importado",
      imageUse,
      signatureName: String(data.answers?.signatureName || "").trim().slice(0, 80),
      termText: typeof data.termText === "string" ? data.termText : "",
      termVersion: typeof data.termVersion === "string" ? data.termVersion : "",
      respondedAt: serverTimestamp()
    });
    return;
  }

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
    if (!items.some((item) => item.shareToken === link.id)) {
      await addDoc(checkpointsRef, {
        date: today,
        sessionNumber: "",
        sessionType: answers.sessionType || "",
        painLevel: Number(answers.painLevel || 0),
        stressLevel: Number(answers.stressLevel || 0),
        sleepHours: Number(answers.sleepHours || 0),
        observations: "",
        source: "cliente",
        kind: "feedback",
        moment: "feedback",
        shareToken: link.id,
        createdAt: serverTimestamp()
      });
    }
    await refreshEvolutionSnapshot(uid, link, items.filter((item) => !isClientFeedback(item)));
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
  const profileSnap = await getDoc(doc(db, "users", uid, "settings", "profile"));
  const instagram = clinicHandle(
    (profileSnap.exists() && profileSnap.data().instagram) || evolution.instagram || ""
  );
  await updateEvolutionLink({
    uid,
    token: evolution.id,
    phone,
    comments: evolution.comments || "",
    highlight: evolution.highlight || "",
    homeCare: evolution.homeCare || "",
    instagram,
    checkpoints,
    clinicName: publicSnap.exists() ? publicSnap.data().clinicName : "",
    clientName: link.clientName || clientSnap.data()?.name || ""
  });
}
