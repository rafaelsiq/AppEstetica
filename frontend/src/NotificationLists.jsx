import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import ModalClose from "./ModalClose";
import { publishNotificationList, removeNotificationList } from "./notificationLists.js";
import {
  audienceLabel,
  emptyNotificationList,
  frequencyLabel,
  targetTokens,
  validateNotificationList
} from "./notificationSchedule";

const WEEKDAY_FULL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const WEEKDAY_SHORT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function shortDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}` : "";
}

function weekdayArticle(name) {
  return name === "sábado" || name === "domingo" ? "todo" : "toda";
}

function scheduleFields(frequency, date) {
  const parsed = parseIsoDate(date);
  const weekday = parsed ? parsed.getDay() : 1;
  const monthDay = parsed ? parsed.getDate() : 1;
  if (frequency === "weekly") {
    return { weekdays: [weekday], monthDay: 0 };
  }
  if (frequency === "monthly") {
    return { weekdays: [], monthDay };
  }
  return { weekdays: [], monthDay: 0 };
}

const WEEKDAY_LETTER = ["D", "S", "T", "Q", "Q", "S", "S"];

function selectedWeekdays(list) {
  return [...new Set((list.weekdays || []).map(Number))].filter((day) => day >= 0 && day <= 6);
}

function schedulePhrase(list) {
  const time = list.time || "--:--";
  const date = parseIsoDate(list.date);
  if (list.frequency === "daily") {
    return `Todo dia às ${time}`;
  }
  if (list.frequency === "weekly") {
    const days = selectedWeekdays(list);
    if (days.length === 1) {
      const name = WEEKDAY_SHORT[days[0]];
      const lead = weekdayArticle(name);
      return `${lead.charAt(0).toUpperCase()}${lead.slice(1)} ${name} às ${time}`;
    }
    if (days.length > 1) {
      return `${days.map((day) => WEEKDAY_SHORT[day]).join(", ")} às ${time}`;
    }
    return `Toda semana às ${time}`;
  }
  if (list.frequency === "monthly") {
    const day = date ? date.getDate() : "";
    return `Todo dia ${day} às ${time}`;
  }
  return "";
}

function frequencyResume(list) {
  const time = list.time || "--:--";
  const from = shortDate(list.date) || "—";
  const date = parseIsoDate(list.date);
  if (list.frequency === "daily") {
    return `todo dia às ${time}, a partir de ${from}.`;
  }
  if (list.frequency === "weekly") {
    const days = selectedWeekdays(list);
    if (days.length === 1) {
      const name = WEEKDAY_FULL[days[0]];
      return `${weekdayArticle(name)} ${name} às ${time}, a partir de ${from}.`;
    }
    if (days.length > 1) {
      return `${days.map((day) => WEEKDAY_SHORT[day]).join(", ")} às ${time}, a partir de ${from}.`;
    }
    return `toda semana às ${time}, a partir de ${from}.`;
  }
  const day = date ? date.getDate() : "—";
  return `todo dia ${day} às ${time}, a partir de ${from}.`;
}

function readySchedule(form) {
  if (form.frequency === "monthly") {
    return { ...form, weekdays: [], monthDay: parseIsoDate(form.date)?.getDate() || Number(form.monthDay) || 1 };
  }
  if (form.frequency === "weekly") {
    const weekdays = selectedWeekdays(form);
    return {
      ...form,
      weekdays: weekdays.length ? weekdays : scheduleFields("weekly", form.date).weekdays,
      monthDay: 0
    };
  }
  return { ...form, weekdays: [], monthDay: 0 };
}

function recipientCount(form, clients) {
  if (form.audience === "only") {
    return clients.filter((client) => (form.clientIds || []).includes(client.id)).length;
  }
  if (form.audience === "except") {
    return clients.filter((client) => !(form.clientIds || []).includes(client.id)).length;
  }
  return clients.length;
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const max = 720;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL("image/jpeg", 0.72);
        if (url.length > 450000) {
          reject(new Error("A imagem ficou grande demais. Escolha outra mais leve."));
          return;
        }
        resolve(url);
      };
      image.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export default function NotificationLists({ uid, clients, shareLinks, clinicName = "Clínica Estética", onSummaryChange }) {
  const [lists, setLists] = useState([]);

  useEffect(() => {
    const paused = lists.filter((list) => list.active === false).length;
    onSummaryChange?.({ active: lists.length - paused, paused });
  }, [lists, onSummaryChange]);
  const [form, setForm] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openMenuId, setOpenMenuId] = useState("");
  const syncing = useRef(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    return onSnapshot(collection(db, "users", uid, "notificationLists"), (snapshot) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, ownerId: uid, ...item.data() }));
      next.sort((first, second) => String(second.updatedAt?.seconds || 0) - String(first.updatedAt?.seconds || 0) || first.name.localeCompare(second.name));
      setLists(next);
    });
  }, [uid]);

  useEffect(() => {
    if (!uid || syncing.current) {
      return undefined;
    }
    const jobs = lists
      .filter((list) => list.active !== false)
      .map((list) => {
        const tokens = targetTokens(list, clients, shareLinks);
        const known = new Set(list.deliveredTokens || []);
        return { list, missing: tokens.filter((token) => !known.has(token)) };
      })
      .filter((job) => job.missing.length);
    if (!jobs.length) {
      return undefined;
    }
    let cancelled = false;
    syncing.current = true;
    (async () => {
      try {
        for (const job of jobs) {
          if (cancelled) {
            return;
          }
          const delivered = await publishNotificationList({
            listId: job.list.id,
            list: job.list,
            clients,
            shareLinks
          });
          await setDoc(doc(db, "users", uid, "notificationLists", job.list.id), {
            deliveredTokens: delivered
          }, { merge: true });
        }
      } finally {
        syncing.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lists, clients, shareLinks, uid]);

  useEffect(() => {
    if (!openMenuId) {
      return undefined;
    }
    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpenMenuId("");
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpenMenuId("");
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuId]);

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  const closeForm = () => {
    if (busy) {
      return;
    }
    setForm(null);
    setScheduleOpen(false);
    setScheduleDraft(null);
    setError("");
  };

  const chooseOnce = () => {
    setScheduleOpen(false);
    setScheduleDraft(null);
    update({ frequency: "once", weekdays: [], monthDay: 0 });
  };

  const chooseRepeat = () => {
    if (!form || form.frequency === "once") {
      update({ frequency: "weekly", ...scheduleFields("weekly", form?.date) });
    }
  };

  const openSchedule = () => {
    if (!form) {
      return;
    }
    const frequency = form.frequency === "once" ? "weekly" : form.frequency;
    const weekdays = frequency === "weekly"
      ? (selectedWeekdays(form).length ? [selectedWeekdays(form)[0]] : scheduleFields("weekly", form.date).weekdays)
      : [];
    setScheduleDraft({
      frequency,
      date: form.date,
      time: form.time || "09:00",
      weekdays,
      monthDay: form.monthDay
    });
    setScheduleOpen(true);
  };

  const cancelSchedule = () => {
    setScheduleOpen(false);
    setScheduleDraft(null);
  };

  const confirmSchedule = () => {
    if (!scheduleDraft) {
      return;
    }
    update(readySchedule(scheduleDraft));
    setScheduleOpen(false);
    setScheduleDraft(null);
  };

  const setDraftFrequency = (frequency) => {
    setScheduleDraft((current) => {
      const next = { ...current, frequency };
      if (frequency === "weekly" && !selectedWeekdays(current).length) {
        next.weekdays = scheduleFields("weekly", current.date).weekdays;
      }
      return next;
    });
  };

  const toggleClient = (clientId) => {
    setForm((current) => {
      const selected = new Set(current.clientIds || []);
      if (selected.has(clientId)) {
        selected.delete(clientId);
      } else {
        selected.add(clientId);
      }
      return { ...current, clientIds: [...selected] };
    });
  };

  const save = async (event) => {
    event.preventDefault();
    const ready = readySchedule(form);
    const message = validateNotificationList(ready);
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        const result = await Notification.requestPermission();
        if (result === "granted") {
          window.dispatchEvent(new Event("clinica-notifications-granted"));
        }
      } catch {
        // O navegador não abriu o pedido de permissão.
      }
    }
    try {
      const ref = form.id
        ? doc(db, "users", uid, "notificationLists", form.id)
        : doc(collection(db, "users", uid, "notificationLists"));
      const draft = { ...ready, active: form.active !== false, deliveredTokens: form.deliveredTokens || [] };
      const deliveredTokens = await publishNotificationList({
        listId: ref.id,
        list: draft,
        clients,
        shareLinks
      });
      await setDoc(ref, {
        name: draft.name.trim(),
        title: draft.title.trim(),
        body: draft.body.trim(),
        imageDataUrl: draft.imageDataUrl || "",
        frequency: draft.frequency,
        date: draft.date,
        time: draft.time,
        weekdays: draft.frequency === "weekly" ? draft.weekdays.map(Number) : [],
        monthDay: draft.frequency === "monthly" ? Number(draft.monthDay) : 0,
        until: draft.until || "",
        audience: draft.audience,
        clientIds: draft.audience === "all" ? [] : draft.clientIds,
        active: true,
        deliveredTokens,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setForm(null);
      setScheduleOpen(false);
    } catch (saveError) {
      setError("Não foi possível salvar a lista. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (list) => {
    setBusy(true);
    try {
      const active = list.active === false;
      const deliveredTokens = await publishNotificationList({
        listId: list.id,
        list: { ...list, active },
        clients,
        shareLinks
      });
      await setDoc(doc(db, "users", uid, "notificationLists", list.id), {
        active,
        deliveredTokens,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (list) => {
    setBusy(true);
    try {
      await removeNotificationList(uid, list);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="notification-lists">
      <header className="page-header">
        <div>
          <h1>Avisos</h1>
          <p>Listas de notificação que chegam no celular das clientes.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="primary-btn notification-add-btn" aria-label="Nova lista" onClick={() => { setError(""); setScheduleOpen(false); setForm(emptyNotificationList(todayIso())); }}>
            <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span className="btn-label">Nova lista</span>
          </button>
        </div>
      </header>
      <div className="info-callout">
        <span className="info-callout-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></svg>
        </span>
        <p>
          <span className="info-callout-long">
            <strong>Como funciona:</strong> na hora marcada, o aviso chega na área de notificações do celular, mesmo com o aplicativo fechado. A cliente precisa abrir o link uma vez e permitir as notificações. Pode levar alguns minutos depois do horário.
          </span>
          <span className="info-callout-short">
            O aviso chega no celular mesmo com o app fechado. A cliente precisa abrir o link uma vez e permitir as notificações.
          </span>
        </p>
      </div>
      <ul className="notification-grid">
        {lists.length === 0 ? <li className="notification-empty">Nenhuma lista criada.</li> : null}
        {lists.map((list) => (
          <li
            key={list.id}
            className={[
              "notification-card",
              list.active === false ? "is-paused" : "",
              openMenuId === list.id ? "is-open" : ""
            ].filter(Boolean).join(" ")}
          >
            <div className="notification-card-copy">
              <div className="notification-card-title">
                <strong>{list.name}</strong>
                <span className={list.active === false ? "notification-status" : "notification-status is-active"}>{list.active === false ? "Pausada" : "Ativa"}</span>
              </div>
              <p className="notification-meta is-frequency">{frequencyLabel(list)}</p>
              <p className="notification-meta is-audience">{audienceLabel(list, clients)}</p>
            </div>
            <div className="notification-card-menu" ref={openMenuId === list.id ? menuRef : null}>
              <button
                type="button"
                className="notification-menu-trigger"
                aria-label={`Ações de ${list.name}`}
                aria-expanded={openMenuId === list.id}
                disabled={busy}
                onClick={() => setOpenMenuId((current) => (current === list.id ? "" : list.id))}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.7" />
                  <circle cx="12" cy="12" r="1.7" />
                  <circle cx="12" cy="19" r="1.7" />
                </svg>
              </button>
              {openMenuId === list.id ? (
                <div className="notification-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenuId("");
                      setError("");
                      setScheduleOpen(false);
                      setForm({ ...emptyNotificationList(todayIso()), ...list, clientIds: list.clientIds || [], weekdays: list.weekdays || [] });
                    }}
                  >
                    Editar
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setOpenMenuId(""); toggleActive(list); }}>
                    {list.active === false ? "Ativar" : "Pausar"}
                  </button>
                  <div className="notification-menu-divider" />
                  <button type="button" role="menuitem" className="is-danger" onClick={() => { setOpenMenuId(""); remove(list); }}>
                    Excluir
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
        <li className="notification-add-item">
          <button type="button" className="notification-add" onClick={() => { setError(""); setScheduleOpen(false); setForm(emptyNotificationList(todayIso())); }}>
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            Criar nova lista
          </button>
        </li>
      </ul>

      {form ? createPortal(
        <div className="client-modal-backdrop app-modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) closeForm(); }}>
          <section className="profile-modal notice-composer" role="dialog" aria-modal="true" aria-labelledby="notice-composer-title" onClick={(event) => event.stopPropagation()}>
            <header className="profile-modal-header">
              <div>
                <h4 id="notice-composer-title">{form.id ? "Editar lista" : "Nova lista"}</h4>
                <p>Defina quando enviar, para quem e o que a cliente vai ler.</p>
              </div>
              <ModalClose onClick={closeForm} />
            </header>
            <form className="form notice-composer-form" onSubmit={save}>
              <div className="notice-composer-layout">
              <div className="notice-composer-fields">
              <label>
                Nome da lista
                <input value={form.name} onChange={(event) => update({ name: event.target.value })} maxLength={80} required />
                <span className="notice-hint">Só você vê.</span>
              </label>
              <label>
                Título da notificação
                <input value={form.title} onChange={(event) => update({ title: event.target.value })} maxLength={80} required />
              </label>
              <label>
                Texto
                <textarea value={form.body} onChange={(event) => update({ body: event.target.value })} maxLength={400} rows={4} required />
              </label>
              <div className="notice-image-row">
                <div>
                  <strong>Imagem</strong>
                  <span>Opcional. Aparece na notificação expandida.</span>
                </div>
                <label className="secondary-btn notification-file-btn">
                  Escolher
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) {
                      return;
                    }
                    try {
                      update({ imageDataUrl: await readImage(file) });
                      setError("");
                    } catch (imageError) {
                      setError(imageError.message);
                    }
                  }}
                />
                </label>
              </div>
              {form.imageDataUrl ? (
                <div className="notification-image-preview">
                  <img src={form.imageDataUrl} alt="Imagem da notificação" />
                  <button type="button" className="secondary-btn" onClick={() => update({ imageDataUrl: "" })}>Remover imagem</button>
                </div>
              ) : null}
              <div className="notice-frequency">
                <span className="notice-field-label" id="notice-frequency-label">Frequência</span>
                <div className="segmented" role="tablist" aria-labelledby="notice-frequency-label">
                  <button type="button" role="tab" aria-selected={form.frequency === "once"} className={form.frequency === "once" ? "is-selected" : ""} onClick={chooseOnce}>Uma vez</button>
                  <button type="button" role="tab" aria-selected={form.frequency !== "once"} className={form.frequency !== "once" ? "is-selected" : ""} onClick={chooseRepeat}>Repetir</button>
                </div>
                {form.frequency === "once" ? (
                  <div className="grid-form">
                    <label>
                      Data
                      <input type="date" value={form.date} onChange={(event) => update({ date: event.target.value })} required />
                    </label>
                    <label>
                      Horário
                      <input type="time" value={form.time} onChange={(event) => update({ time: event.target.value })} required />
                    </label>
                  </div>
                ) : (
                  <div className="notice-schedule-line">
                    <p>{schedulePhrase(form)}</p>
                    <button type="button" className="notice-alter" onClick={openSchedule}>Alterar</button>
                  </div>
                )}
              </div>
              <div className="notice-frequency">
                <span className="notice-field-label" id="notice-audience-label">Quem recebe</span>
                <div className="segmented" role="tablist" aria-labelledby="notice-audience-label">
                  <button type="button" role="tab" aria-selected={form.audience === "all"} className={form.audience === "all" ? "is-selected" : ""} onClick={() => update({ audience: "all", clientIds: [] })}>Todas</button>
                  <button type="button" role="tab" aria-selected={form.audience === "except"} className={form.audience === "except" ? "is-selected" : ""} onClick={() => update({ audience: "except" })}>Exceto</button>
                  <button type="button" role="tab" aria-selected={form.audience === "only"} className={form.audience === "only" ? "is-selected" : ""} onClick={() => update({ audience: "only" })}>Somente</button>
                </div>
              </div>
              {form.audience !== "all" ? (
                <div className="audience-picker">
                  {clients.length === 0 ? <p className="muted-text">Nenhuma cliente cadastrada.</p> : null}
                  {clients.map((client) => (
                    <label key={client.id}>
                      <input type="checkbox" checked={(form.clientIds || []).includes(client.id)} onChange={() => toggleClient(client.id)} />
                      {client.name || "Cliente"}
                    </label>
                  ))}
                </div>
              ) : null}
              <p className="notice-count">{recipientCount(form, clients) === 1 ? "1 cliente recebe" : `${recipientCount(form, clients)} clientes recebem`}</p>
              </div>
              <aside className="notice-preview" aria-label="Prévia">
                <p className="notice-preview-kicker">Prévia</p>
                <div className="notice-phone">
                  <strong className="notice-phone-clock">{form.time || "--:--"}</strong>
                  <article className="notice-phone-card">
                    <span className="notice-phone-mark" aria-hidden="true">{(clinicName || "C").trim().charAt(0).toUpperCase()}</span>
                    <div>
                      <p>{clinicName || "Clínica Estética"} · agora</p>
                      <strong>{form.title.trim() || "Título da notificação"}</strong>
                      <span>{form.body.trim() || "O texto da notificação aparece aqui."}</span>
                    </div>
                  </article>
                </div>
              </aside>
              </div>
              {error ? <p className="error-text">{error}</p> : null}
              <footer className="notice-composer-footer">
                <button type="button" className="secondary-btn" onClick={closeForm} disabled={busy}>Cancelar</button>
                <button className="primary-btn" type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar lista"}</button>
              </footer>
            </form>
          </section>
        </div>,
        document.body
      ) : null}

      {scheduleOpen && scheduleDraft ? createPortal(
        <div
          className="client-modal-backdrop app-modal-backdrop notification-repeat-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) cancelSchedule();
          }}
        >
          <section
            className="app-modal frequency-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Frequência"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="app-modal-header">
              <div>
                <h2>Frequência</h2>
                <p>Escolha como a notificação se repete.</p>
              </div>
              <ModalClose onClick={cancelSchedule} />
            </header>
            <div className="app-modal-body">
              <div className="segmented" role="tablist" aria-label="Repetição">
                <button type="button" role="tab" aria-selected={scheduleDraft.frequency === "daily"} className={scheduleDraft.frequency === "daily" ? "is-selected" : ""} onClick={() => setDraftFrequency("daily")}>Todo dia</button>
                <button type="button" role="tab" aria-selected={scheduleDraft.frequency === "weekly"} className={scheduleDraft.frequency === "weekly" ? "is-selected" : ""} onClick={() => setDraftFrequency("weekly")}>Toda semana</button>
                <button type="button" role="tab" aria-selected={scheduleDraft.frequency === "monthly"} className={scheduleDraft.frequency === "monthly" ? "is-selected" : ""} onClick={() => setDraftFrequency("monthly")}>Todo mês</button>
              </div>
              {scheduleDraft.frequency === "weekly" ? (
                <div className="frequency-days">
                  <span id="frequency-days-label">Dias da semana</span>
                  <div className="frequency-day-row" role="radiogroup" aria-labelledby="frequency-days-label">
                    {WEEKDAY_LETTER.map((letter, day) => (
                      <button
                        key={WEEKDAY_FULL[day]}
                        type="button"
                        role="radio"
                        aria-checked={scheduleDraft.weekdays[0] === day}
                        aria-label={WEEKDAY_FULL[day]}
                        className={scheduleDraft.weekdays[0] === day ? "frequency-day is-selected" : "frequency-day"}
                        onClick={() => setScheduleDraft((current) => ({ ...current, weekdays: [day] }))}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="frequency-when">
                <label>
                  Horário
                  <input type="time" value={scheduleDraft.time} onChange={(event) => setScheduleDraft((current) => ({ ...current, time: event.target.value }))} />
                </label>
                <label>
                  Começa em
                  <input type="date" value={scheduleDraft.date} onChange={(event) => setScheduleDraft((current) => ({ ...current, date: event.target.value }))} />
                </label>
              </div>
              <p className="frequency-resume"><strong>Resumo:</strong> {frequencyResume(scheduleDraft)}</p>
            </div>
            <footer className="app-modal-footer">
              <button type="button" className="secondary-btn" onClick={cancelSchedule}>Cancelar</button>
              <button type="button" className="primary-btn" onClick={confirmSchedule}>Concluir</button>
            </footer>
          </section>
        </div>,
        document.body
      ) : null}
    </section>
  );
}
