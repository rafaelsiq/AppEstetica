import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import ModalClose from "./ModalClose";
import { publishNotificationList, removeNotificationList } from "./notificationLists";
import {
  WEEKDAYS,
  audienceLabel,
  emptyNotificationList,
  frequencyLabel,
  targetTokens,
  validateNotificationList
} from "./notificationSchedule";

function formatDateBr(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function repeatSummary(list) {
  const start = formatDateBr(list.date);
  const end = formatDateBr(list.until);
  const base = frequencyLabel(list);
  if (start && end) {
    return `${base}. De ${start} até ${end}.`;
  }
  if (start) {
    return `${base}. A partir de ${start}.`;
  }
  return base;
}

function validateRepeat(draft) {
  if (!/^\d{2}:\d{2}$/.test(draft.time || "")) {
    return "Informe o horário.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date || "")) {
    return "Informe a data.";
  }
  if (draft.frequency === "weekly" && (!Array.isArray(draft.weekdays) || draft.weekdays.length === 0)) {
    return "Escolha ao menos um dia da semana.";
  }
  if (draft.frequency === "monthly") {
    const day = Number(draft.monthDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      return "Escolha um dia do mês entre 1 e 28.";
    }
  }
  if (draft.until && draft.until < draft.date) {
    return "A data final precisa ser igual ou posterior ao início.";
  }
  return "";
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

export default function NotificationLists({ uid, clients, shareLinks }) {
  const [lists, setLists] = useState([]);
  const [form, setForm] = useState(null);
  const [repeatDraft, setRepeatDraft] = useState(null);
  const [repeatError, setRepeatError] = useState("");
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
    if (!repeatDraft) {
      return undefined;
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        setRepeatDraft(null);
        setRepeatError("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [repeatDraft]);

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
    setRepeatDraft(null);
    setRepeatError("");
  };

  const openRepeat = () => {
    if (!form) {
      return;
    }
    setRepeatError("");
    setRepeatDraft({
      frequency: form.frequency === "once" ? "weekly" : form.frequency,
      date: form.date,
      time: form.time,
      weekdays: (form.weekdays || []).length ? [...form.weekdays] : [1, 2, 3, 4, 5],
      monthDay: form.monthDay || 1,
      until: form.until || ""
    });
  };

  const updateRepeat = (patch) => setRepeatDraft((current) => (current ? { ...current, ...patch } : current));

  const toggleDraftWeekday = (day) => {
    setRepeatDraft((current) => {
      if (!current) {
        return current;
      }
      const selected = new Set((current.weekdays || []).map(Number));
      if (selected.has(day)) {
        selected.delete(day);
      } else {
        selected.add(day);
      }
      return { ...current, weekdays: [...selected] };
    });
  };

  const confirmRepeat = () => {
    const message = validateRepeat(repeatDraft || {});
    if (message) {
      setRepeatError(message);
      return;
    }
    update({
      frequency: repeatDraft.frequency,
      date: repeatDraft.date,
      time: repeatDraft.time,
      weekdays: repeatDraft.frequency === "weekly" ? repeatDraft.weekdays.map(Number) : [],
      monthDay: repeatDraft.frequency === "monthly" ? Number(repeatDraft.monthDay) : 0,
      until: repeatDraft.until || ""
    });
    setRepeatError("");
    setRepeatDraft(null);
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
    const message = validateNotificationList(form);
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
      const draft = { ...form, active: form.active !== false, deliveredTokens: form.deliveredTokens || [] };
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
    <section className="card notification-lists">
      <div className="notification-heading">
        <div>
          <h3>Listas de notificação</h3>
          <p className="muted-text">
            Escolha a frequência, quem recebe e o conteúdo. Na hora marcada, o aviso chega na área de notificações do celular, mesmo com o aplicativo fechado. A cliente precisa abrir o link uma vez e permitir as notificações. Pode levar alguns minutos depois do horário.
          </p>
        </div>
        <button type="button" className="primary-btn" onClick={() => { setError(""); setForm(emptyNotificationList(todayIso())); }}>
          Nova lista
        </button>
      </div>
      <ul className="list">
        {lists.length === 0 ? <li className="empty">Nenhuma lista criada.</li> : null}
        {lists.map((list) => (
          <li key={list.id} className={list.active === false ? "notification-card is-paused" : "notification-card"}>
            <div className="notification-card-copy">
              <div className="notification-card-title">
                <strong>{list.name}</strong>
                {list.active === false ? <span className="notification-status">Pausada</span> : null}
              </div>
              <p>{frequencyLabel(list)}</p>
              <p>{audienceLabel(list, clients)}</p>
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
                      setForm({ ...emptyNotificationList(todayIso()), ...list, clientIds: list.clientIds || [], weekdays: list.weekdays || [] });
                    }}
                  >
                    Editar
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setOpenMenuId(""); toggleActive(list); }}>
                    {list.active === false ? "Ativar" : "Pausar"}
                  </button>
                  <button type="button" role="menuitem" className="is-danger" onClick={() => { setOpenMenuId(""); remove(list); }}>
                    Excluir
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {form ? (
        <div className="client-modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy && !repeatDraft) closeForm(); }}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-label="Lista de notificação" onClick={(event) => event.stopPropagation()}>
            <header className="profile-modal-header">
              <div>
                <h4>{form.id ? "Editar lista" : "Nova lista"}</h4>
                <p>Defina quando enviar, para quem e o que a cliente vai ler.</p>
              </div>
              <ModalClose onClick={closeForm} />
            </header>
            <form className="form profile-modal-body" onSubmit={save}>
              <label>
                Nome da lista
                <input value={form.name} onChange={(event) => update({ name: event.target.value })} maxLength={80} required />
              </label>
              <label>
                Título da notificação
                <input value={form.title} onChange={(event) => update({ title: event.target.value })} maxLength={80} required />
              </label>
              <label>
                Texto
                <textarea value={form.body} onChange={(event) => update({ body: event.target.value })} maxLength={400} rows={4} required />
              </label>
              <div className="notification-image-field">
                <span>Imagem</span>
                <label className="secondary-btn notification-file-btn">
                  Escolher imagem
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
              <fieldset className="notification-choice">
                <legend>Frequência</legend>
                <label>
                  <input
                    type="radio"
                    name="frequency"
                    checked={form.frequency === "once" && !repeatDraft}
                    onChange={() => {
                      setRepeatDraft(null);
                      setRepeatError("");
                      update({ frequency: "once" });
                    }}
                  />
                  Uma vez
                </label>
                <label>
                  <input
                    type="radio"
                    name="frequency"
                    checked={form.frequency !== "once" || Boolean(repeatDraft)}
                    onChange={openRepeat}
                    onClick={() => {
                      if (form.frequency !== "once") {
                        openRepeat();
                      }
                    }}
                  />
                  Com repetições
                </label>
              </fieldset>
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
                <div className="notification-repeat-summary">
                  <p>{repeatSummary(form)}</p>
                  <button type="button" className="secondary-btn" onClick={openRepeat}>Alterar frequência</button>
                </div>
              )}
              <fieldset className="notification-choice">
                <legend>Quem recebe</legend>
                <label><input type="radio" name="audience" checked={form.audience === "all"} onChange={() => update({ audience: "all", clientIds: [] })} /> Todas</label>
                <label><input type="radio" name="audience" checked={form.audience === "except"} onChange={() => update({ audience: "except" })} /> Todas, exceto</label>
                <label><input type="radio" name="audience" checked={form.audience === "only"} onChange={() => update({ audience: "only" })} /> Somente estas</label>
              </fieldset>
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
              {error ? <p className="error-text">{error}</p> : null}
              <button className="primary-btn" type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar lista"}</button>
            </form>
          </section>
        </div>
      ) : null}
      {repeatDraft ? (
        <div
          className="client-modal-backdrop notification-repeat-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setRepeatDraft(null);
              setRepeatError("");
            }
          }}
        >
          <section
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Frequência"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="profile-modal-header">
              <div>
                <h4>Frequência</h4>
                <p>Escolha como a notificação se repete.</p>
              </div>
              <ModalClose onClick={() => { setRepeatDraft(null); setRepeatError(""); }} />
            </header>
            <div className="form">
              <label>
                Repetição
                <select value={repeatDraft.frequency} onChange={(event) => updateRepeat({ frequency: event.target.value })}>
                  <option value="daily">Todo dia</option>
                  <option value="weekly">Toda semana</option>
                  <option value="monthly">Todo mês</option>
                </select>
              </label>
              <div className="grid-form">
                <label>
                  Começa em
                  <input type="date" value={repeatDraft.date} onChange={(event) => updateRepeat({ date: event.target.value })} required />
                </label>
                <label>
                  Horário
                  <input type="time" value={repeatDraft.time} onChange={(event) => updateRepeat({ time: event.target.value })} required />
                </label>
              </div>
              {repeatDraft.frequency === "weekly" ? (
                <div className="weekday-picker">
                  {WEEKDAYS.map(([day, label]) => (
                    <label key={day}>
                      <input type="checkbox" checked={(repeatDraft.weekdays || []).map(Number).includes(day)} onChange={() => toggleDraftWeekday(day)} />
                      {label}
                    </label>
                  ))}
                </div>
              ) : null}
              {repeatDraft.frequency === "monthly" ? (
                <label>
                  Dia do mês
                  <input type="number" min="1" max="28" value={repeatDraft.monthDay} onChange={(event) => updateRepeat({ monthDay: Number(event.target.value) })} />
                </label>
              ) : null}
              <label>
                Termina em
                <input type="date" value={repeatDraft.until} onChange={(event) => updateRepeat({ until: event.target.value })} />
              </label>
              {repeatError ? <p className="error-text">{repeatError}</p> : null}
              <button type="button" className="primary-btn" onClick={confirmRepeat}>Concluir</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
