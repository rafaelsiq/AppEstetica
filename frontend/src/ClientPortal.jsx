import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { applyClinicIcon } from "./pageIcon";
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import ClientNotices from "./ClientNotices";
import InstallAppPrompt from "./InstallAppPrompt";
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
  readMaskedPhone,
  whatsAppUrl
} from "./firstContact";
import { IMAGE_CONSENT_TEXT } from "./imageConsent";
import { addDays, BOOKING_HORIZON_DAYS, isBookingOpen, isDayClosed } from "./agendaOff";

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
  formatMetric,
  metricTrend,
  renderEvolutionCanvas,
  loadLogoImage,
  sanitizeEvolutionStory,
  shareEvolutionImage,
  zipStoredFiles
} from "./evolutionStory";

function toneColor(value) {
  const safe = Math.min(10, Math.max(0, Number(value) || 0));
  if (safe <= 5) {
    return `rgb(${Math.round(47 + (240 - 47) * (safe / 5))}, ${Math.round(111 + (138 - 111) * (safe / 5))}, ${Math.round(237 + (36 - 237) * (safe / 5))})`;
  }
  const amount = (safe - 5) / 5;
  return `rgb(${Math.round(240 + (217 - 240) * amount)}, ${Math.round(138 + (45 - 138) * amount)}, ${Math.round(36 + (32 - 36) * amount)})`;
}

function QuizScale({ label, hint, value, onChange }) {
  const numeric = Math.min(10, Math.max(0, Number(value || 0)));
  const color = toneColor(numeric);
  return (
    <div className="quiz-step">
      <h2>{label}</h2>
      {hint ? <p>{hint}</p> : null}
      <label className="scale-slider">
        <span className="scale-slider-header">
          <span>Intensidade</span>
          <strong style={{ color }}>{numeric}</strong>
        </span>
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={numeric}
          style={{ "--scale-color": color }}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
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

function SimpleLineChart({ title, values, labels, max, wide = false, onShare }) {
  const seriesValues = values || [];
  const seriesLabels = labels || [];
  const width = 360;
  const height = 188;
  const padX = 16;
  const padTop = 16;
  const padBottom = 28;
  const maxValue = max || 10;
  const getX = (index) => (
    seriesValues.length === 1
      ? width / 2
      : padX + (index * (width - padX * 2)) / (seriesValues.length - 1)
  );
  const getY = (value) => padTop + (1 - Math.min(Math.max(value, 0), maxValue) / maxValue) * (height - padTop - padBottom);
  const path = seriesValues.map((value, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(value)}`).join(" ");
  const labelIndexes = seriesValues.length <= 3
    ? seriesValues.map((_, index) => index)
    : [0, seriesValues.length - 1];

  return (
    <article className={wide ? "chart-card chart-card-span-2 evolution-chart" : "chart-card evolution-chart"}>
      <div className="evolution-chart-head">
        <h5>{title}</h5>
        {onShare ? (
          <button type="button" className="evolution-share-btn" aria-label={`Compartilhar ${title}`} onClick={onShare}>
            <ShareIcon />
          </button>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={title}>
        <path d={path} className="chart-line chart-line-primary" />
        {seriesValues.map((value, index) => (
          <circle key={`${seriesLabels[index]}-${index}`} cx={getX(index)} cy={getY(value)} r="4" className="chart-point-primary" />
        ))}
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

function ClinicLogo({ src }) {
  const logo = String(src || "");
  if (!logo.startsWith("data:image/")) {
    return null;
  }
  return <img className="client-logo" src={logo} alt="Logo da clínica" />;
}

function EvolutionStat({ label, value, trend }) {
  return (
    <article className="evolution-stat">
      <span>{label}</span>
      <strong>{formatMetric(value)}</strong>
      {trend ? <small className={`evolution-trend is-${trend.tone}`}>{trend.label}</small> : null}
    </article>
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

  const downloadAll = async () => {
    if (!images.length) {
      return;
    }
    const files = await Promise.all(images.map(async (item) => ({
      name: item.file,
      data: new Uint8Array(await item.blob.arrayBuffer())
    })));
    downloadEvolutionImage(zipStoredFiles(files), "evolucao-redes.zip");
    setMessage("Todas as imagens foram baixadas em um arquivo só.");
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
            <p>{total ? `${Math.min(index + 1, total)} de ${total}` : "Preparando"}{current ? ` · ${current.title}` : ""}</p>
          </div>
          <ModalClose onClick={onClose} />
        </header>
        {busy ? <p>Preparando as imagens...</p> : null}
        {message ? <p className="evolution-share-message">{message}</p> : null}
        {!busy && !images.length ? <p>Ainda não há informações suficientes para montar as imagens.</p> : null}
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
        ) : null}
        {total > 1 ? (
          <div className="evolution-carousel-nav">
            <button type="button" className="secondary-btn" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0 || !images.length}>
              Anterior
            </button>
            <p>{current?.title || ""}</p>
            <button type="button" className="secondary-btn" onClick={() => setIndex((value) => Math.min(images.length - 1, value + 1))} disabled={!images.length || index >= images.length - 1}>
              Próxima
            </button>
          </div>
        ) : current ? <p className="evolution-carousel-single">{current.title}</p> : null}
        <div className="evolution-carousel-actions">
          <button type="button" className="primary-btn" onClick={shareCurrent} disabled={!current}>
            Compartilhar
          </button>
          <button type="button" className="secondary-btn" onClick={downloadCurrent} disabled={!current}>
            Baixar esta
          </button>
          {total > 1 ? (
            <button type="button" className="secondary-btn" onClick={downloadAll} disabled={images.length < 2}>
              Baixar todas
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function EvolutionView({ evolution, fallbackName, clinicName, logoUrl }) {
  const story = sanitizeEvolutionStory(evolution || {});
  const series = evolutionSeries(evolution?.checkpoints || []);
  const name = evolution?.clientFirstName || fallbackName;
  const hasChart = series.points.length >= 2;
  const hasStory = Boolean(story.comments || story.homeCare);
  const careLines = story.homeCare.split("\n").map((line) => line.trim()).filter(Boolean);
  const [shareSlides, setShareSlides] = useState(null);
  const range = series.labels.length > 1 ? `${series.labels[0]} a ${series.labels[series.labels.length - 1]}` : series.labels[0] || "";
  const slides = useMemo(() => buildEvolutionSlides({
    highlight: story.highlight,
    comments: story.comments,
    homeCare: story.homeCare,
    hasChart
  }), [story.highlight, story.comments, story.homeCare, hasChart]);
  const openChartShare = (key, title, file) => {
    setShareSlides([{
      title,
      file,
      include: {
        highlight: false,
        comments: false,
        homeCare: false,
        wellness: key === "wellness",
        pain: key === "pain",
        stress: key === "stress",
        sleep: key === "sleep"
      }
    }]);
  };

  const showTrend = series.points.length >= 2;

  return (
    <main className="evolution-page">
      <section className="evolution-shell">
        <header className="evolution-hero">
          <ClinicLogo src={logoUrl} />
          <p className="quiz-kicker">{evolution?.clinicName || clinicName}</p>
          <h1>Sua evolução, {name}</h1>
          {story.highlight ? <p className="evolution-highlight">{story.highlight}</p> : null}
          <div className="evolution-hero-foot">
            {range ? <p className="evolution-meta">{series.points.length} registros · {range}</p> : <span />}
            {slides.length ? (
              <button type="button" className="evolution-share-btn" aria-label="Compartilhar evolução" onClick={() => setShareSlides(slides)}>
                <ShareIcon />
              </button>
            ) : null}
          </div>
        </header>

        {series.points.length ? (
          <div className="evolution-stats">
            <EvolutionStat label="Bem-estar" value={series.wellness[series.wellness.length - 1]} trend={showTrend ? metricTrend(series.wellness[0], series.wellness[series.wellness.length - 1]) : null} />
            <EvolutionStat label="Dor" value={series.pain[series.pain.length - 1]} trend={showTrend ? metricTrend(series.pain[0], series.pain[series.pain.length - 1], true) : null} />
            <EvolutionStat label="Estresse" value={series.stress[series.stress.length - 1]} trend={showTrend ? metricTrend(series.stress[0], series.stress[series.stress.length - 1], true) : null} />
            <EvolutionStat label="Sono (h)" value={series.sleep[series.sleep.length - 1]} trend={showTrend ? metricTrend(series.sleep[0], series.sleep[series.sleep.length - 1]) : null} />
          </div>
        ) : null}

        <div className={hasStory ? "evolution-layout" : "evolution-layout is-charts-only"}>
          {hasStory ? (
            <aside className="evolution-story">
              {story.comments ? (
                <article className="quiz-note">
                  <h2>Recado da clínica</h2>
                  <p className="evolution-copy">{story.comments}</p>
                </article>
              ) : null}
              {careLines.length ? (
                <article className="quiz-note">
                  <h2>Cuidados em casa</h2>
                  <ul className="evolution-care">
                    {careLines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
                  </ul>
                </article>
              ) : null}
            </aside>
          ) : null}
          <div className="evolution-charts">
            {hasChart ? (
              <>
                <SimpleLineChart wide title="Bem-estar" values={series.wellness} labels={series.labels} max={100} onShare={() => openChartShare("wellness", "Bem-estar", "evolucao-bem-estar.png")} />
                <SimpleLineChart title="Dor" values={series.pain} labels={series.labels} max={10} onShare={() => openChartShare("pain", "Dor", "evolucao-dor.png")} />
                <SimpleLineChart title="Estresse" values={series.stress} labels={series.labels} max={10} onShare={() => openChartShare("stress", "Estresse", "evolucao-estresse.png")} />
                <SimpleLineChart title="Sono (horas)" values={series.sleep} labels={series.labels} max={12} onShare={() => openChartShare("sleep", "Sono", "evolucao-sono.png")} />
              </>
            ) : (
              <p className="muted-text">A clínica ainda está reunindo dados suficientes para os gráficos.</p>
            )}
          </div>
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

function FirstContactRequest({ link, token }) {
  const [stepIndex, setStepIndex] = useState(0);
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
  const steps = ["nome", "telefone", "dia", "periodo", "motivo"];
  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const openPeriods = FIRST_CONTACT_PERIODS.filter((item) => !date || isBookingOpen(closures, date, item.value));

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

  const goNext = () => {
    const trimmed = name.trim();
    const key = phoneKey(phone);
    if (steps[safeIndex] === "nome" && (trimmed.length < 2 || trimmed.length > 80)) {
      setError("Informe seu nome.");
      return;
    }
    if (steps[safeIndex] === "telefone" && !/^\d{10,13}$/.test(key)) {
      setError("Informe o telefone com DDD.");
      return;
    }
    if (steps[safeIndex] === "dia" && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > latestDate)) {
      setError("Escolha um dia a partir de hoje, dentro dos próximos 6 meses.");
      return;
    }
    if (steps[safeIndex] === "dia" && isDayClosed(closures, date)) {
      setError("A clínica não atende nesse dia.");
      return;
    }
    if (steps[safeIndex] === "periodo" && (!isAllowedPeriod(period) || !isBookingOpen(closures, date, period))) {
      setError("Escolha um período disponível.");
      return;
    }
    setError("");
    setStepIndex(safeIndex + 1);
  };

  const submitRequest = async () => {
    const trimmed = name.trim();
    const key = phoneKey(phone);
    const picked = normalizeReasons(reasons);
    if (picked.length < 1) {
      setError("Escolha pelo menos um motivo.");
      return;
    }
    if (date < today || date > latestDate || isDayClosed(closures, date) || !isBookingOpen(closures, date, period)) {
      setError("A clínica não atende nesse dia ou período.");
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
        <section className="quiz-card">
          <p className="quiz-kicker">{link.clinicName}</p>
          <h1>Pedido enviado</h1>
          <p>Seu primeiro atendimento já está na agenda da clínica, pendente de aprovação.</p>
          <p>Se quiser, envie o mesmo pedido pelo WhatsApp. A clínica recebe o horário mesmo que você não envie.</p>
          {whatsApp ? (
            <a className="primary-btn" href={whatsApp} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>
          ) : null}
        </section>
      </main>
    );
  }

  const progress = Math.round(((safeIndex + 1) / steps.length) * 100);

  return (
    <main className="quiz-page">
      <section className="quiz-card">
        <p className="quiz-kicker">{link.clinicName}</p>
        <h1>Primeiro atendimento</h1>
        <p className="muted-text">Conte o dia e o motivo da visita. A clínica confirma o horário com você.</p>
        <div className="quiz-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <p className="quiz-count">Pergunta {safeIndex + 1} de {steps.length}</p>

        {steps[safeIndex] === "nome" ? (
          <div className="quiz-step">
            <h2>Qual é o seu nome?</h2>
            <label>
              Nome
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="name" />
            </label>
          </div>
        ) : null}

        {steps[safeIndex] === "telefone" ? (
          <div className="quiz-step">
            <h2>Qual é o seu WhatsApp?</h2>
            <label>
              Telefone com DDD
              <input
                value={phone}
                onChange={(event) => setPhone(readMaskedPhone(event))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
              />
            </label>
          </div>
        ) : null}

        {steps[safeIndex] === "dia" ? (
          <div className="quiz-step">
            <h2>Qual dia você prefere?</h2>
            <label>
              Dia
              <input
                type="date"
                value={date}
                min={today}
                max={latestDate}
                onChange={(event) => {
                  const next = event.target.value;
                  setDate(next);
                  if (next && isDayClosed(closures, next)) {
                    setError("A clínica não atende nesse dia.");
                    return;
                  }
                  setError("");
                }}
              />
            </label>
          </div>
        ) : null}

        {steps[safeIndex] === "periodo" ? (
          <div className="quiz-step">
            <h2>Qual período fica melhor?</h2>
            {openPeriods.length === 0 ? (
              <p>A clínica não atende nesse dia.</p>
            ) : (
              <div className="quiz-options">
                {openPeriods.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={period === item.value ? "quiz-option active" : "quiz-option"}
                    onClick={() => {
                      setPeriod(item.value);
                      setError("");
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            {date && openPeriods.length > 0 && openPeriods.length < FIRST_CONTACT_PERIODS.length ? (
              <p>Alguns períodos estão indisponíveis neste dia.</p>
            ) : null}
          </div>
        ) : null}

        {steps[safeIndex] === "motivo" ? (
          <div className="quiz-step">
            <h2>Qual o motivo do atendimento?</h2>
            <p>Pode marcar mais de uma opção.</p>
            <div className="quiz-options">
              {FIRST_CONTACT_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className={reasons.includes(reason) ? "quiz-option active" : "quiz-option"}
                  onClick={() => toggleReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
        <div className="quiz-nav">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              setError("");
              setStepIndex(Math.max(0, safeIndex - 1));
            }}
            disabled={safeIndex === 0 || submitting}
          >
            Voltar
          </button>
          {safeIndex < steps.length - 1 ? (
            <button type="button" className="primary-btn" onClick={goNext}>Continuar</button>
          ) : (
            <button type="button" className="primary-btn" onClick={submitRequest} disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar pedido"}
            </button>
          )}
        </div>
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
    return <main className="quiz-page"><section className="quiz-card"><h1>Link indisponível</h1><p>{error}</p></section></main>;
  }

  if (link.type === "primeiro") {
    return <FirstContactRequest link={link} token={token} />;
  }

  if (link.status === "respondido" || link.status === "importado") {
    return (
      <>
        {link.type === "acompanhamento" ? <ClientNotices token={token} active /> : null}
        <main className="quiz-page">
          <section className="quiz-card">
            {link.type === "acompanhamento" ? <ClinicLogo src={link.logoDataUrl} /> : null}
            <p className="quiz-kicker">{link.clinicName}</p>
            <h1>Obrigado, {link.clientFirstName}!</h1>
            <p>
              {link.type === "consentimento"
                ? "Sua resposta sobre o uso de imagem chegou na clínica."
                : link.type === "acompanhamento"
                  ? "Seu feedback chegou na clínica."
                  : "Suas respostas chegaram na clínica. As observações da profissional continuam só com ela."}
            </p>
          </section>
        </main>
        {link.type === "acompanhamento" ? <InstallAppPrompt clinicName={link.clinicName} /> : null}
      </>
    );
  }

  if (link.type === "evolucao") {
    if (!evolution && restoringAccess) {
      return <main className="quiz-page"><p>Carregando...</p></main>;
    }
    if (evolution) {
      return (
        <>
          <ClientNotices token={token} active />
          <EvolutionView
            evolution={evolution}
            fallbackName={link.clientFirstName}
            clinicName={link.clinicName}
            logoUrl={link.logoDataUrl}
          />
          <InstallAppPrompt clinicName={link.clinicName} />
        </>
      );
    }
    return (
      <>
      <main className="evolution-page">
        <section className="quiz-card evolution-lock">
          <ClinicLogo src={link.logoDataUrl} />
          <p className="quiz-kicker">{link.clinicName}</p>
          <h1>Olá, {link.clientFirstName}</h1>
          <p>Para ver sua evolução, confirme o telefone cadastrado na clínica.</p>
          <form className="form" onSubmit={unlockEvolution}>
            <label>
              Telefone com DDD
              <input
                value={phone}
                onChange={(event) => setPhone(readMaskedPhone(event))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                required
              />
            </label>
            {phoneError ? <p className="error-text">{phoneError}</p> : null}
            <button className="primary-btn" type="submit">Ver evolução</button>
          </form>
        </section>
      </main>
      <InstallAppPrompt clinicName={link.clinicName} />
      </>
    );
  }

  if (link.type === "consentimento") {
    const term = link.termText || IMAGE_CONSENT_TEXT;
    return (
      <main className="quiz-page">
        <section className="quiz-card">
          <p className="quiz-kicker">{link.clinicName}</p>
          <h1>Uso de imagem</h1>
          {term.split("\n\n").map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <div className="quiz-options">
            <button
              type="button"
              className={imageChoice === "autorizado" ? "quiz-option active" : "quiz-option"}
              onClick={() => setImageChoice("autorizado")}
            >
              Autorizo o uso da imagem
            </button>
            <button
              type="button"
              className={imageChoice === "negado" ? "quiz-option active" : "quiz-option"}
              onClick={() => setImageChoice("negado")}
            >
              Não autorizo
            </button>
          </div>
          <label>
            Nome completo
            <input
              value={signatureName}
              onChange={(event) => setSignatureName(event.target.value)}
              placeholder="Confirme seu nome"
              maxLength={80}
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="button" className="primary-btn" onClick={submitConsent} disabled={submitting}>
            {submitting ? "Enviando..." : "Confirmar"}
          </button>
        </section>
      </main>
    );
  }

  const progress = steps.length === 0 ? 0 : Math.round(((safeIndex + 1) / steps.length) * 100);
  const selected = currentStep ? answers[currentStep.key] : undefined;

  return (
    <>
    {link.type === "acompanhamento" ? <ClientNotices token={token} active /> : null}
    <main className="quiz-page">
      <section className="quiz-card">
        {link.type === "acompanhamento" ? <ClinicLogo src={link.logoDataUrl} /> : null}
        <p className="quiz-kicker">{link.clinicName}</p>
        <h1>{link.type === "acompanhamento" ? "Como você está?" : `Olá, ${link.clientFirstName}`}</h1>
        <p className="muted-text">
          {link.type === "acompanhamento"
            ? "Conte como você está. Seu retorno chega na clínica como feedback."
            : "Um questionário curto para a clínica te receber melhor."}
        </p>
        <div className="quiz-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <p className="quiz-count">Pergunta {Math.min(safeIndex + 1, steps.length)} de {steps.length}</p>

        {currentStep?.kind === "scale" ? (
          <QuizScale
            label={currentStep.title}
            hint={currentStep.hint}
            value={answers[currentStep.key] || "0"}
            onChange={(value) => setAnswer(currentStep.key, value)}
          />
        ) : null}

        {currentStep && currentStep.kind !== "scale" ? (
          <div className="quiz-step">
            <h2>{currentStep.title}</h2>
            {currentStep.kind === "multi" ? <p>Pode marcar mais de uma opção.</p> : null}
            <div className="quiz-options">
              {currentStep.options.map((option) => {
                const value = typeof option === "string" ? option : option.value;
                const label = typeof option === "string" ? option : option.label;
                const active = currentStep.kind === "multi"
                  ? Array.isArray(selected) && selected.includes(value)
                  : selected === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={active ? "quiz-option active" : "quiz-option"}
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
    {link.type === "acompanhamento" ? <InstallAppPrompt clinicName={link.clinicName} /> : null}
    </>
  );
}
