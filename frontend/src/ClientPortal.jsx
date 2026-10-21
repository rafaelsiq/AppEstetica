import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { applyClinicIcon } from "./pageIcon";
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import ClientNotices from "./ClientNotices";
import ClientAccessPrompts, { ClinicNotifyCard } from "./InstallAppPrompt";
import ModalClose from "./ModalClose";
import {
  buildAnamneseSteps,
  buildFollowupSteps,
  phoneKey,
  sanitizeAnamneseAnswers,
  sanitizeFollowupAnswers
} from "./clientQuiz";
import {
  clientRequestMessage,
  FIRST_CONTACT_PERIODS,
  FIRST_CONTACT_REASONS,
  isAllowedPeriod,
  normalizeReasons,
  periodLabel,
  readMaskedPhone,
  whatsAppUrl
} from "./firstContact";
import { IMAGE_CONSENT_TEXT } from "./imageConsent";
import { addDays, BOOKING_HORIZON_DAYS, isBookingOpen, isDayClosed, PERIOD_WINDOWS } from "./agendaOff";

function accessStorageKey(token) {
  return `clinica-acesso:${token}`;
}

function readSavedPhoneKey(token) {
  try {
    const raw = localStorage.getItem(accessStorageKey(token));
    if (!raw) {
      return "";
    }
    const data = JSON.parse(raw);
    return phoneKey(data?.phoneKey || "");
  } catch (error) {
    return "";
  }
}

function savePhoneKey(token, key) {
  localStorage.setItem(accessStorageKey(token), JSON.stringify({ phoneKey: key }));
}

function clearSavedPhoneKey(token) {
  localStorage.removeItem(accessStorageKey(token));
}
import {
  buildEvolutionSlides,
  canvasToBlob,
  downloadEvolutionImage,
  evolutionSeries,
  formatDatePt,
  formatMetric,
  renderEvolutionCanvas,
  loadLogoImage,
  sanitizeEvolutionStory,
  shareEvolutionImage
} from "./evolutionStory";
import { chartCeiling, parameterSeries } from "./trackingParameters";

function QuizScale({ label, hint, value, onChange, caption, lowLabel, highLabel }) {
  const numeric = Math.min(10, Math.max(0, Number(value || 0)));
  return (
    <div className="quiz-step">
      <h2>{label}</h2>
      {hint ? <p>{hint}</p> : null}
      <div className="quiz-scale-card">
        <strong>{numeric}</strong>
        <span>{caption}</span>
      </div>
      <div className="quiz-scale-row" role="radiogroup" aria-label={label}>
        {Array.from({ length: 11 }, (_, score) => (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={score === numeric}
            className={score === numeric ? "is-selected" : ""}
            onClick={() => onChange(String(score))}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="quiz-scale-legend">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

function scaleCopy(key, value) {
  const score = Math.min(10, Math.max(0, Number(value) || 0));
  if (key === "stressLevel") {
    const caption = score === 0 ? "Tranquilo" : score <= 3 ? "Tensão leve" : score <= 6 ? "Tensão moderada" : score <= 8 ? "Tensão alta" : "Muito tenso";
    return { caption, low: "Tranquilo", high: "Muito tenso" };
  }
  const caption = score === 0 ? "Nenhuma dor" : score <= 3 ? "Dor leve" : score <= 6 ? "Dor moderada" : score <= 8 ? "Dor forte" : "Dor máxima";
  return {
    caption,
    low: key === "painScale" ? "Nenhum" : "Nenhuma dor",
    high: key === "painScale" ? "Máximo" : "Máxima"
  };
}

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 10 17l9-10" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 18.5 5 21l2.6-1.3A8.5 8.5 0 1 0 6.5 18.5Z" />
      <path d="M9.2 9.6c.2-.4.3-.4.6-.4h.5c.2 0 .4 0 .5.4.2.5.6 1.6.6 1.7.1.2 0 .4-.2.6l-.3.4c-.1.1-.2.3-.1.5.2.4.8 1.3 1.7 1.8.7.3 1 .3 1.2.2l.5-.3c.2-.1.4-.1.6 0 .2.1 1.3.6 1.5.7.2.1.3.2.4.4.1.2.1.8-.2 1.4-.2.6-1.3 1.1-1.8 1.1-.5 0-1.1.1-3.3-.8-2.5-1.1-4.1-3.6-4.2-3.8-.2-.2-1.3-1.7-1.3-3.3 0-1.5.8-2.3 1.1-2.6Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="M8 7.5 12 3.5l4 4" />
      <path d="M6 12.5v6A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5v-6" />
    </svg>
  );
}

function SimpleLineChart({ title, values, labels, max, wide = false, secondary = null, primaryLabel = "", endLabel = "" }) {
  const seriesValues = values || [];
  const seriesLabels = labels || [];
  const extra = secondary?.values || [];
  const width = 360;
  const height = 188;
  const padX = 16;
  const padTop = endLabel ? 28 : 16;
  const padBottom = 28;
  const maxValue = max || 10;
  const count = Math.max(seriesValues.length, 1);
  const getX = (index) => (
    count === 1
      ? width / 2
      : padX + (index * (width - padX * 2)) / (count - 1)
  );
  const getY = (value) => padTop + (1 - Math.min(Math.max(value, 0), maxValue) / maxValue) * (height - padTop - padBottom);
  const line = (points) => points.map((value, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(value)}`).join(" ");
  const path = line(seriesValues);
  const extraPath = extra.length ? line(extra) : "";
  const labelIndexes = seriesValues.length <= 3
    ? seriesValues.map((_, index) => index)
    : [0, seriesValues.length - 1];
  const lastIndex = seriesValues.length - 1;

  return (
    <article className={wide ? "chart-card chart-card-span-2 evolution-chart" : "chart-card evolution-chart"}>
      <div className="evolution-chart-head">
        <h5>{title}</h5>
        {secondary ? (
          <div className="evolution-legend">
            <span><i className="is-solid" /> {primaryLabel || "Dor"}</span>
            <span><i className="is-dashed" /> {secondary.label || "Estresse"}</span>
          </div>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={title}>
        {extraPath ? <path d={extraPath} className="chart-line chart-line-dashed" /> : null}
        <path d={path} className="chart-line chart-line-primary" />
        {seriesValues.map((value, index) => (
          <circle key={`${seriesLabels[index]}-${index}`} cx={getX(index)} cy={getY(value)} r="4" className="chart-point-primary" />
        ))}
        {endLabel && lastIndex >= 0 ? (
          <text x={getX(lastIndex)} y={Math.max(14, getY(seriesValues[lastIndex]) - 10)} textAnchor={lastIndex === 0 ? "middle" : "end"} className="chart-end-label">
            {endLabel}
          </text>
        ) : null}
        {labelIndexes.map((index) => (
          <text
            key={`label-${index}`}
            x={index === 0 ? 4 : index === seriesValues.length - 1 ? width - 4 : getX(index)}
            y={height - 6}
            textAnchor={index === 0 ? "start" : index === seriesValues.length - 1 ? "end" : "middle"}
            className="chart-axis-x"
          >
            {seriesLabels[index]}
          </text>
        ))}
      </svg>
    </article>
  );
}

function metricText(value) {
  return formatMetric(value).replace(".", ",");
}

function shortDay(label) {
  const match = /^(\d{1,2})\/(\d{1,2})/.exec(String(label || ""));
  if (!match) {
    return label;
  }
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}`;
}

function EvolutionStat({ label, value, hint = "", hintTone = "" }) {
  return (
    <article className="evolution-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small className={hintTone ? `evolution-trend is-${hintTone}` : "evolution-trend"}>{hint}</small> : null}
    </article>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function BrokenLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 14.5 7 17a3.2 3.2 0 0 1-4.5-4.5l2.5-2.5" />
      <path d="M14.5 9.5 17 7a3.2 3.2 0 0 1 4.5 4.5l-2.5 2.5" />
      <path d="M8 16 16 8" />
      <path d="m5 5 14 14" />
    </svg>
  );
}

function EvolutionShareModal({ open, onClose, slides, story, evolution, clinicName, clientName, checkpoints, logoUrl }) {
  const [index, setIndex] = useState(0);
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dragStart = useRef(0);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let cancelled = false;
    const urls = [];
    setIndex(0);
    setImages([]);
    setMessage("");
    setBusy(true);
    (async () => {
      try {
        const logoImage = await loadLogoImage(logoUrl);
        const built = [];
        for (const slide of slides) {
          const canvas = renderEvolutionCanvas({
            clinicName: evolution?.clinicName || clinicName,
            clientFirstName: clientName,
            highlight: story.highlight,
            comments: story.comments,
            homeCare: story.homeCare,
            checkpoints,
            include: slide.include,
            instagram: evolution?.instagram || "",
            logoImage
          });
          const blob = await canvasToBlob(canvas);
          if (cancelled) {
            return;
          }
          const url = URL.createObjectURL(blob);
          urls.push(url);
          built.push({ ...slide, blob, url });
        }
        if (!cancelled) {
          setImages(built);
        }
      } catch (imageError) {
        if (!cancelled) {
          setMessage("Não foi possível gerar as imagens.");
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [open, slides, story, evolution, clinicName, clientName, checkpoints, logoUrl]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(images.length - 1, current + 1));
      }
      if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(0, current - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, images.length]);

  if (!open) {
    return null;
  }

  const current = images[index];
  const total = images.length || slides.length;

  const shareCurrent = async () => {
    if (!current?.blob) {
      return;
    }
    try {
      const result = await shareEvolutionImage(current.blob, current.title, current.file);
      setMessage(result === "shared" ? "Escolha onde publicar a imagem." : "Imagem baixada. Publique a partir da galeria.");
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        setMessage("Não foi possível compartilhar.");
      }
    }
  };

  const downloadCurrent = () => {
    if (!current?.blob) {
      return;
    }
    downloadEvolutionImage(current.blob, current.file);
    setMessage("Imagem baixada. Publique a partir da galeria.");
  };

  return (
    <div
      className="client-modal-backdrop evolution-carousel-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="evolution-carousel"
        role="dialog"
        aria-modal="true"
        aria-label="Compartilhar evolução"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="profile-modal-header">
          <div>
            <h4>Compartilhar</h4>
            <p>Imagens prontas para os stories</p>
          </div>
          <ModalClose onClick={onClose} />
        </header>
        {busy ? <p>Preparando as imagens...</p> : null}
        {message ? <p className="evolution-share-message">{message}</p> : null}
        {!busy && !images.length ? <p>Ainda não há informações suficientes para montar as imagens.</p> : null}
        <div className="evolution-carousel-frame">
          <button
            type="button"
            className="evolution-carousel-arrow"
            aria-label="Anterior"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0 || !images.length}
          >
            ‹
          </button>
          {current ? (
            <div
              className="evolution-carousel-stage"
              onPointerDown={(event) => {
                dragStart.current = event.clientX;
              }}
              onPointerUp={(event) => {
                const delta = event.clientX - dragStart.current;
                if (delta > 48) {
                  setIndex((value) => Math.max(0, value - 1));
                } else if (delta < -48) {
                  setIndex((value) => Math.min(images.length - 1, value + 1));
                }
              }}
            >
              <img src={current.url} alt={current.title} />
            </div>
          ) : <div className="evolution-carousel-stage" />}
          <button
            type="button"
            className="evolution-carousel-arrow"
            aria-label="Próxima"
            onClick={() => setIndex((value) => Math.min(images.length - 1, value + 1))}
            disabled={!images.length || index >= images.length - 1}
          >
            ›
          </button>
        </div>
        {total > 1 ? (
          <div className="evolution-carousel-dots" aria-hidden="true">
            {Array.from({ length: total }, (_, dot) => (
              <span key={dot} className={dot === index ? "is-active" : ""} />
            ))}
          </div>
        ) : null}
        <div className="evolution-carousel-actions">
          <button type="button" className="primary-btn" onClick={shareCurrent} disabled={!current}>
            Compartilhar imagem
          </button>
          <button type="button" className="secondary-btn" onClick={downloadCurrent} disabled={!current}>
            Salvar no celular
          </button>
        </div>
      </section>
    </div>
  );
}

function EvolutionView({ evolution, fallbackName, clinicName, logoUrl, token }) {
  const story = sanitizeEvolutionStory(evolution || {});
  const series = evolutionSeries(evolution?.checkpoints || []);
  const customSeries = parameterSeries(evolution?.checkpoints || []).filter((item) => item.points.length > 0);
  const name = evolution?.clientFirstName || fallbackName;
  const hasChart = series.points.length >= 2;
  const careLines = story.homeCare.split("\n").map((line) => line.trim()).filter(Boolean);
  const [shareSlides, setShareSlides] = useState(null);
  const shortLabels = series.labels.map(shortDay);
  const range = shortLabels.length > 1 ? `${shortLabels[0]} a ${shortLabels[shortLabels.length - 1]}` : shortLabels[0] || "";
  const compared = series.points.length >= 2;
  const last = series.points.length - 1;
  const wellnessDelta = compared ? Math.round(series.wellness[last] - series.wellness[0]) : 0;
  const era = (value, unit = "") => {
    const text = metricText(value);
    return unit ? `era ${text} ${unit}` : `era ${text}`;
  };
  const slides = useMemo(() => buildEvolutionSlides({
    highlight: story.highlight,
    comments: story.comments,
    homeCare: story.homeCare,
    hasChart
  }), [story.highlight, story.comments, story.homeCare, hasChart]);

  return (
    <main className="evolution-page">
      <section className="evolution-shell">
        <header className="evolution-hero">
          <div className="evolution-hero-top">
            <p className="quiz-kicker">{evolution?.clinicName || clinicName}</p>
            <ClientNotices token={token} active history embedded layout="page" />
          </div>
          <p className="evolution-kicker">Sua evolução</p>
          <h1>{story.highlight || `Sua evolução, ${name}`}</h1>
          {range ? <p className="evolution-meta">{name} · {series.points.length} {series.points.length === 1 ? "registro" : "registros"} {shortLabels.length > 1 ? "de" : "em"} {range}</p> : null}
          {series.points.length ? (
            <div className="evolution-stats">
              <EvolutionStat
                label="Bem-estar"
                value={metricText(series.wellness[last])}
                hint={wellnessDelta ? `${wellnessDelta > 0 ? "+" : ""}${wellnessDelta} desde o início` : ""}
                hintTone={wellnessDelta > 0 ? "gain" : wellnessDelta < 0 ? "down" : ""}
              />
              <EvolutionStat label="Dor" value={metricText(series.pain[last])} hint={compared ? era(series.pain[0]) : ""} />
              <EvolutionStat label="Estresse" value={metricText(series.stress[last])} hint={compared ? era(series.stress[0]) : ""} />
              <EvolutionStat label="Sono" value={`${metricText(series.sleep[last])} h`} hint={compared ? era(series.sleep[0], "h") : ""} />
              {customSeries.map((item) => {
                const latest = item.points[item.points.length - 1].value;
                const first = item.points[0].value;
                return (
                  <EvolutionStat
                    key={item.id}
                    label={item.name}
                    value={`${metricText(latest)}${item.unit ? ` ${item.unit}` : ""}`}
                    hint={item.points.length >= 2 ? era(first, item.unit) : ""}
                  />
                );
              })}
            </div>
          ) : null}
        </header>

        <div className="evolution-body">
          <div className="evolution-charts">
            {hasChart ? (
              <>
                <SimpleLineChart wide title="Seu bem-estar" values={series.wellness} labels={shortLabels} max={100} endLabel={metricText(series.wellness[last])} />
                <SimpleLineChart
                  wide
                  title="Dor e estresse"
                  values={series.pain}
                  labels={shortLabels}
                  max={10}
                  primaryLabel="Dor"
                  secondary={{ values: series.stress, label: "Estresse" }}
                />
              </>
            ) : customSeries.some((item) => item.points.length >= 2) ? null : (
              <p className="muted-text">A clínica ainda está reunindo dados suficientes para os gráficos.</p>
            )}
            {customSeries.filter((item) => item.points.length >= 2).map((item) => (
              <SimpleLineChart
                key={item.id}
                wide
                title={`${item.name}${item.unit ? ` (${item.unit})` : ""}`}
                values={item.points.map((point) => point.value)}
                labels={item.points.map((point) => shortDay(formatDatePt(point.date)))}
                max={chartCeiling(item.points.map((point) => point.value))}
              />
            ))}
          </div>
          {story.comments ? (
            <article className="evolution-note">
              <h2>Recado da clínica</h2>
              <p className="evolution-copy">{story.comments}</p>
            </article>
          ) : null}
          {careLines.length ? (
            <article className="evolution-note">
              <h2>Cuidados em casa</h2>
              <ul className="evolution-care-list">
                {careLines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
              </ul>
            </article>
          ) : null}
          {slides.length ? (
            <button type="button" className="primary-btn evolution-share-main" onClick={() => setShareSlides(slides)}>
              <ShareIcon />
              Compartilhar minha evolução
            </button>
          ) : null}
        </div>

      </section>
      <EvolutionShareModal
        open={Boolean(shareSlides)}
        onClose={() => setShareSlides(null)}
        slides={shareSlides || []}
        story={story}
        evolution={evolution}
        clinicName={clinicName}
        clientName={name}
        checkpoints={series.points}
        logoUrl={logoUrl}
      />
    </main>
  );
}

function localToday() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const BOOKING_DAY_COUNT = 60;

function parseIsoDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function longDayLabel(iso) {
  const date = parseIsoDate(iso);
  if (!date) {
    return iso;
  }
  return `${WEEKDAY_LONG[date.getDay()]}, ${date.getDate()} de ${MONTHS_LONG[date.getMonth()]}`;
}

function periodHours(value) {
  const window = PERIOD_WINDOWS[value];
  if (!window) {
    return "";
  }
  const compact = (time) => `${Number(String(time).slice(0, 2))}h`;
  return `${compact(window.start)} às ${compact(window.end)}`;
}

function periodSummary(value) {
  const hours = periodHours(value);
  const label = periodLabel(value);
  return hours ? `${label} · ${hours}` : label;
}

function FirstContactRequest({ link, token }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [period, setPeriod] = useState("");
  const [reasons, setReasons] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(null);
  const [closures, setClosures] = useState([]);
  const today = localToday();
  const latestDate = addDays(today, BOOKING_HORIZON_DAYS);
  const dayChoices = [];
  for (let offset = 0; offset < BOOKING_DAY_COUNT; offset += 1) {
    const iso = addDays(today, offset);
    if (!iso || iso > latestDate) {
      break;
    }
    dayChoices.push(iso);
  }

  useEffect(() => {
    const availabilityRef = doc(db, "clientLinks", token, "availability", "off");
    return onSnapshot(availabilityRef, (snapshot) => {
      const next = snapshot.exists() && Array.isArray(snapshot.data()?.closures) ? snapshot.data().closures : [];
      setClosures(next);
    }, () => setClosures([]));
  }, [token]);

  useEffect(() => {
    if (period && date && !isBookingOpen(closures, date, period)) {
      setPeriod("");
    }
  }, [closures, date, period]);

  useEffect(() => {
    if (date && isDayClosed(closures, date)) {
      setError("A clínica não atende nesse dia.");
    }
  }, [closures, date]);

  const toggleReason = (reason) => {
    setReasons((current) => (
      current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]
    ));
    setError("");
  };

  const submitRequest = async () => {
    const trimmed = name.trim();
    const key = phoneKey(phone);
    const picked = normalizeReasons(reasons);
    if (trimmed.length < 2 || trimmed.length > 80) {
      setError("Informe seu nome.");
      return;
    }
    if (!/^\d{10,13}$/.test(key)) {
      setError("Informe o WhatsApp com DDD.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > latestDate || isDayClosed(closures, date)) {
      setError("Escolha um dia em que a clínica atende.");
      return;
    }
    if (!isAllowedPeriod(period) || !isBookingOpen(closures, date, period)) {
      setError("Escolha um período disponível.");
      return;
    }
    if (picked.length < 1) {
      setError("Escolha pelo menos um motivo.");
      return;
    }
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await addDoc(collection(db, "clientLinks", token, "requests"), {
        clientName: trimmed,
        clientPhone: key,
        date,
        period,
        reasons: picked,
        status: "pendente",
        createdAt: serverTimestamp()
      });
      setSent({ clientName: trimmed, date, period, reasons: picked });
    } catch (submitError) {
      const denied = String(submitError?.code || "").includes("permission");
      setError(denied
        ? "A clínica não atende nesse dia ou período."
        : "Não foi possível enviar o pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    const message = clientRequestMessage({
      clientName: sent.clientName,
      clinicName: link.clinicName,
      date: sent.date,
      period: sent.period,
      reasons: sent.reasons
    });
    const whatsApp = link.clinicPhone ? whatsAppUrl(link.clinicPhone, message) : "";
    return (
      <main className="quiz-page">
        <section className="quiz-card quiz-sheet">
          <p className="quiz-kicker">{link.clinicName}</p>
          <span className="quiz-check is-inline"><CheckMark /></span>
          <h1>Pedido enviado</h1>
          <p className="quiz-lead">Seu primeiro atendimento já está na agenda da clínica, aguardando aprovação.</p>
          <dl className="quiz-summary">
            <div>
              <dt>Dia</dt>
              <dd>{longDayLabel(sent.date)}</dd>
            </div>
            <div>
              <dt>Período</dt>
              <dd>{periodSummary(sent.period)}</dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>{sent.reasons.join(", ")}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd><span className="quiz-badge">Aguardando a clínica</span></dd>
            </div>
          </dl>
          <p className="quiz-lead">Se quiser, envie o mesmo pedido pelo WhatsApp. A clínica recebe o horário mesmo que você não envie.</p>
          {whatsApp ? (
            <a className="secondary-btn quiz-whatsapp" href={whatsApp} target="_blank" rel="noreferrer">
              <WhatsAppIcon />
              Enviar no WhatsApp
            </a>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="quiz-page">
      <section className="quiz-card quiz-sheet">
        <p className="quiz-kicker">{link.clinicName}</p>
        <h1>Primeiro atendimento</h1>
        <p className="quiz-lead">Conte o dia e o motivo da visita. A clínica confirma o horário com você.</p>
        <div className="quiz-pair">
          <label>
            Seu nome
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="name" />
          </label>
          <label>
            WhatsApp
            <input
              value={phone}
              onChange={(event) => setPhone(readMaskedPhone(event))}
              inputMode="tel"
              autoComplete="tel"
              placeholder="(00) 00000-0000"
            />
          </label>
        </div>
        <div className="quiz-block">
          <h2>Qual dia você prefere?</h2>
          <div className="quiz-days">
            {dayChoices.map((iso) => {
              const parsed = parseIsoDate(iso);
              const closed = isDayClosed(closures, iso);
              return (
                <button
                  key={iso}
                  type="button"
                  className={date === iso ? "quiz-day is-selected" : "quiz-day"}
                  disabled={closed}
                  onClick={() => {
                    setDate(iso);
                    setError("");
                  }}
                >
                  <span>{parsed ? WEEKDAY_SHORT[parsed.getDay()] : ""}</span>
                  <strong>{parsed ? parsed.getDate() : ""}</strong>
                </button>
              );
            })}
          </div>
        </div>
        <div className="quiz-block">
          <h2>Qual período fica melhor?</h2>
          <div className="quiz-periods">
            {FIRST_CONTACT_PERIODS.map((item) => {
              const closed = Boolean(date) && !isBookingOpen(closures, date, item.value);
              const hours = closed ? "Indisponível" : (periodHours(item.value) || "A combinar");
              return (
                <button
                  key={item.value}
                  type="button"
                  className={`quiz-period${period === item.value ? " is-selected" : ""}${item.value === "qualquer" ? " is-wide" : ""}`}
                  disabled={!date || closed}
                  onClick={() => {
                    setPeriod(item.value);
                    setError("");
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>{hours}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="quiz-block">
          <h2>Qual o motivo? <span>· pode marcar mais de um</span></h2>
          <div className="quiz-chips">
            {FIRST_CONTACT_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                className={reasons.includes(reason) ? "quiz-chip is-selected" : "quiz-chip"}
                onClick={() => toggleReason(reason)}
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="button" className="primary-btn quiz-submit" onClick={submitRequest} disabled={submitting}>
          {submitting ? "Enviando..." : "Enviar pedido"}
        </button>
      </section>
    </main>
  );
}

export default function ClientPortal() {
  const { token } = useParams();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [evolution, setEvolution] = useState(null);
  const [phoneError, setPhoneError] = useState("");
  const [restoringAccess, setRestoringAccess] = useState(() => Boolean(readSavedPhoneKey(token)));
  const [imageChoice, setImageChoice] = useState("");
  const [signatureName, setSignatureName] = useState("");

  useEffect(() => {
    let active = true;
    getDoc(doc(db, "clientLinks", token))
      .then((snapshot) => {
        if (!active) {
          return;
        }
        if (!snapshot.exists()) {
          setError("Este link não está mais disponível.");
          return;
        }
        setLink({ id: snapshot.id, ...snapshot.data() });
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível abrir o link.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    applyClinicIcon(link?.logoDataUrl || "");
  }, [link?.logoDataUrl]);

  useEffect(() => {
    if (!link || link.type !== "evolucao") {
      setRestoringAccess(false);
      return undefined;
    }
    const key = readSavedPhoneKey(token);
    if (!key) {
      setRestoringAccess(false);
      return undefined;
    }
    let active = true;
    setRestoringAccess(true);
    getDoc(doc(db, "clientLinks", token, "views", key))
      .then((snapshot) => {
        if (!active) {
          return;
        }
        if (!snapshot.exists()) {
          clearSavedPhoneKey(token);
          return;
        }
        setEvolution(snapshot.data());
      })
      .catch((restoreError) => {
        if (active && restoreError?.code === "permission-denied") {
          clearSavedPhoneKey(token);
        }
      })
      .finally(() => {
        if (active) {
          setRestoringAccess(false);
        }
      });
    return () => {
      active = false;
    };
  }, [link, token]);

  const steps = useMemo(() => {
    if (!link) {
      return [];
    }
    if (link.type === "acompanhamento") {
      return buildFollowupSteps();
    }
    if (link.type === "anamnese") {
      return buildAnamneseSteps(answers);
    }
    return [];
  }, [link, answers]);

  const safeIndex = Math.min(stepIndex, Math.max(steps.length - 1, 0));
  const currentStep = steps[safeIndex];

  useEffect(() => {
    setStepIndex((previous) => {
      const maxIndex = Math.max(steps.length - 1, 0);
      return previous > maxIndex ? maxIndex : previous;
    });
  }, [steps.length]);

  const setAnswer = (key, value) => {
    setAnswers((previous) => ({ ...previous, [key]: value }));
  };

  const toggleMulti = (key, option) => {
    setAnswers((previous) => {
      const current = Array.isArray(previous[key]) ? previous[key] : [];
      const next = current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
      return { ...previous, [key]: next };
    });
  };

  const submitConsent = async () => {
    const name = signatureName.trim();
    if (!link || submitting) {
      return;
    }
    if (imageChoice !== "autorizado" && imageChoice !== "negado") {
      setError("Escolha se autoriza o uso da imagem.");
      return;
    }
    if (name.length < 2) {
      setError("Confirme seu nome para registrar a resposta.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await updateDoc(doc(db, "clientLinks", token), {
        answers: {
          imageUse: imageChoice,
          signatureName: name.slice(0, 80)
        },
        status: "respondido",
        submittedAt: serverTimestamp()
      });
      setLink((previous) => ({ ...previous, status: "respondido" }));
    } catch (submitError) {
      setError("Não foi possível enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitQuiz = async () => {
    if (!link || submitting) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = link.type === "acompanhamento" ? sanitizeFollowupAnswers(answers) : sanitizeAnamneseAnswers(answers);
      await updateDoc(doc(db, "clientLinks", token), {
        answers: payload,
        status: "respondido",
        submittedAt: serverTimestamp()
      });
      setLink((previous) => ({ ...previous, status: "respondido" }));
    } catch (submitError) {
      setError("Não foi possível enviar suas respostas. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const unlockEvolution = async (event) => {
    event.preventDefault();
    setPhoneError("");
    const key = phoneKey(phone);
    if (!key) {
      setPhoneError("Informe o telefone com DDD.");
      return;
    }
    try {
      const snapshot = await getDoc(doc(db, "clientLinks", token, "views", key));
      if (!snapshot.exists()) {
        setPhoneError("Telefone não confere com o cadastro.");
        return;
      }
      savePhoneKey(token, key);
      setEvolution(snapshot.data());
    } catch (unlockError) {
      setPhoneError("Telefone não confere com o cadastro.");
    }
  };

  if (loading) {
    return <main className="quiz-page"><p>Carregando...</p></main>;
  }

  if (error && !link) {
    const inactive = error === "Este link não está mais disponível.";
    return (
      <main className="quiz-page">
        <section className="quiz-card quiz-sheet quiz-thanks">
          <p className="quiz-kicker" aria-hidden="true" />
          <div className="quiz-thanks-body">
            <span className="quiz-check is-muted"><BrokenLinkIcon /></span>
            <h1>{inactive ? "Este link não está mais ativo" : "Não foi possível abrir o link"}</h1>
            <p className="quiz-lead">
              {inactive
                ? "A clínica pode ter gerado um link novo. Peça o endereço atualizado pelo WhatsApp."
                : error}
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (link.type === "primeiro") {
    return <FirstContactRequest link={link} token={token} />;
  }

  if (link.status === "respondido" || link.status === "importado") {
    return (
      <>
        {link.type === "acompanhamento" || link.type === "anamnese" || link.type === "consentimento" ? <ClientNotices token={token} active /> : null}
        <main className="quiz-page">
          <section className="quiz-card quiz-sheet quiz-thanks">
            <p className="quiz-kicker">{link.clinicName}</p>
            <div className="quiz-thanks-body">
              <span className="quiz-check"><CheckMark /></span>
              <h1>Obrigado, {link.clientFirstName}!</h1>
              <p className="quiz-lead">
                {link.type === "consentimento"
                  ? "Sua resposta sobre o uso de imagem chegou na clínica."
                  : link.type === "acompanhamento"
                    ? "Seu feedback chegou na clínica."
                    : "Suas respostas chegaram na clínica. As observações da profissional continuam só com ela."}
              </p>
            </div>
            {link.type === "acompanhamento" ? <ClinicNotifyCard /> : null}
          </section>
        </main>
        {link.type === "acompanhamento" ? <ClientAccessPrompts clinicName={link.clinicName} unlocked hideNotify /> : null}
      </>
    );
  }

  if (link.type === "evolucao") {
    if (!evolution && restoringAccess) {
      return (
        <>
          <ClientNotices token={token} active />
          <main className="quiz-page"><p>Carregando...</p></main>
        </>
      );
    }
    if (evolution) {
      return (
        <>
          <EvolutionView
            evolution={evolution}
            fallbackName={link.clientFirstName}
            clinicName={link.clinicName}
            logoUrl={link.logoDataUrl}
            token={token}
          />
          <ClientAccessPrompts clinicName={link.clinicName} unlocked hideInstall />
        </>
      );
    }
    return (
      <main className="evolution-page evolution-gate">
        <section className="evolution-gate-hero">
          <p className="quiz-kicker">{link.clinicName}</p>
          <h1>Olá, {link.clientFirstName}</h1>
          <p>Sua evolução está pronta. Para proteger seus dados, confirme o telefone cadastrado na clínica.</p>
        </section>
        <section className="evolution-gate-card">
          <span className="evolution-gate-lock" aria-hidden="true"><LockIcon /></span>
          <form className="form" onSubmit={unlockEvolution}>
            <label>
              Telefone com DDD
              <input
                value={phone}
                onChange={(event) => setPhone(readMaskedPhone(event))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 90000-0000"
                required
              />
            </label>
            {phoneError ? <p className="error-text">{phoneError}</p> : null}
            <button className="primary-btn" type="submit">Ver minha evolução</button>
          </form>
          <p className="quiz-quiet">Usamos o telefone só para confirmar que é você. Se ele mudou, fale com a clínica.</p>
        </section>
      </main>
    );
  }

  if (link.type === "consentimento") {
    const term = link.termText || IMAGE_CONSENT_TEXT;
    const designed = term === IMAGE_CONSENT_TEXT;
    const consentBullets = [
      "As fotos podem ficar no prontuário, para acompanhar a sua evolução.",
      "Também podem aparecer em portfólio e redes sociais da clínica.",
      "Dados de saúde nunca entram na divulgação."
    ];
    return (
      <>
      <ClientNotices token={token} active />
      <main className="quiz-page">
        <section className="quiz-card quiz-sheet">
          <p className="quiz-kicker">{link.clinicName}</p>
          <h1>Uso de imagem</h1>
          {designed ? (
            <p className="quiz-lead">A clínica pede autorização para usar fotos feitas no seu atendimento.</p>
          ) : term.split("\n\n").map((paragraph) => (
            <p className="quiz-lead" key={paragraph}>{paragraph}</p>
          ))}
          {designed ? (
            <ul className="quiz-bullets">
              {consentBullets.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
          <div className="quiz-options">
            <button
              type="button"
              className={imageChoice === "autorizado" ? "quiz-option is-radio active" : "quiz-option is-radio"}
              onClick={() => setImageChoice("autorizado")}
            >
              Autorizo o uso da imagem
            </button>
            <button
              type="button"
              className={imageChoice === "negado" ? "quiz-option is-radio active" : "quiz-option is-radio"}
              onClick={() => setImageChoice("negado")}
            >
              Não autorizo
            </button>
          </div>
          <label>
            Seu nome completo, como assinatura
            <input
              value={signatureName}
              onChange={(event) => setSignatureName(event.target.value)}
              placeholder="Nome completo"
              maxLength={80}
            />
          </label>
          {designed ? <p className="quiz-quiet">Você pode não autorizar. Isso não muda o seu atendimento.</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          <button type="button" className="primary-btn quiz-submit" onClick={submitConsent} disabled={submitting}>
            {submitting ? "Enviando..." : "Confirmar resposta"}
          </button>
        </section>
      </main>
      </>
    );
  }

  const progress = steps.length === 0 ? 0 : Math.round(((safeIndex + 1) / steps.length) * 100);
  const selected = currentStep ? answers[currentStep.key] : undefined;
  const followup = link.type === "acompanhamento";
  const greeting = followup ? "Como você está?" : `Olá, ${link.clientFirstName}`;
  const stepHint = !currentStep
    ? ""
    : currentStep.kind === "multi"
      ? "Pode marcar mais de uma opção."
      : followup
        ? "Seu retorno chega na clínica como feedback."
        : "";
  const scale = currentStep?.kind === "scale" ? scaleCopy(currentStep.key, answers[currentStep.key] || "0") : null;

  return (
    <>
    <main className="quiz-page">
      <section className="quiz-card quiz-sheet">
        <header className="quiz-top">
          <p className="quiz-kicker">{link.clinicName}</p>
          {followup || link.type === "anamnese" ? <ClientNotices token={token} active history embedded /> : null}
        </header>
        <div className="quiz-meta">
          <p>{greeting}</p>
          <span>{Math.min(safeIndex + 1, steps.length)} de {steps.length}</span>
        </div>
        <div className="quiz-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>

        {currentStep?.kind === "scale" ? (
          <QuizScale
            label={currentStep.title}
            hint={stepHint}
            value={answers[currentStep.key] || "0"}
            caption={scale.caption}
            lowLabel={scale.low}
            highLabel={scale.high}
            onChange={(value) => setAnswer(currentStep.key, value)}
          />
        ) : null}

        {currentStep && currentStep.kind !== "scale" ? (
          <div className="quiz-step">
            <h2>{currentStep.title}</h2>
            {stepHint ? <p>{stepHint}</p> : null}
            <div className="quiz-options">
              {currentStep.options.map((option) => {
                const value = typeof option === "string" ? option : option.value;
                const label = typeof option === "string" ? option : option.label;
                const active = currentStep.kind === "multi"
                  ? Array.isArray(selected) && selected.includes(value)
                  : selected === value;
                const radio = currentStep.kind === "single" ? " is-radio" : "";
                return (
                  <button
                    key={value}
                    type="button"
                    className={active ? `quiz-option${radio} active` : `quiz-option${radio}`}
                    onClick={() => (currentStep.kind === "multi" ? toggleMulti(currentStep.key, value) : setAnswer(currentStep.key, value))}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
        <div className="quiz-nav">
          <button type="button" className="secondary-btn" onClick={() => setStepIndex((previous) => Math.max(0, previous - 1))} disabled={safeIndex === 0}>
            Voltar
          </button>
          {safeIndex < steps.length - 1 ? (
            <button type="button" className="primary-btn" onClick={() => setStepIndex(safeIndex + 1)}>
              Continuar
            </button>
          ) : (
            <button type="button" className="primary-btn" onClick={submitQuiz} disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar"}
            </button>
          )}
        </div>
      </section>
    </main>
    {followup ? <ClientAccessPrompts clinicName={link.clinicName} /> : null}
    </>
  );
}
