import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  buildAnamneseSteps,
  buildFollowupSteps,
  phoneKey,
  sanitizeAnamneseAnswers,
  sanitizeFollowupAnswers
} from "./clientQuiz";
import { IMAGE_CONSENT_TEXT } from "./imageConsent";
import {
  canvasToBlob,
  downloadEvolutionImage,
  evolutionSeries,
  formatMetric,
  metricTrend,
  renderEvolutionCanvas,
  sanitizeEvolutionStory,
  shareEvolutionImage
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

function SimpleLineChart({ title, values, labels, max, wide = false }) {
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
    <article className={wide ? "chart-card chart-card-span-2" : "chart-card"}>
      <h5>{title}</h5>
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

function EvolutionStat({ label, value, trend }) {
  return (
    <article className="evolution-stat">
      <span>{label}</span>
      <strong>{formatMetric(value)}</strong>
      {trend ? <small className={`evolution-trend is-${trend.tone}`}>{trend.label}</small> : null}
    </article>
  );
}

function EvolutionView({ evolution, fallbackName, clinicName }) {
  const story = sanitizeEvolutionStory(evolution || {});
  const series = evolutionSeries(evolution?.checkpoints || []);
  const name = evolution?.clientFirstName || fallbackName;
  const hasChart = series.points.length >= 2;
  const hasStory = Boolean(story.comments || story.homeCare);
  const careLines = story.homeCare.split("\n").map((line) => line.trim()).filter(Boolean);
  const [pick, setPick] = useState({
    highlight: Boolean(story.highlight),
    comments: false,
    homeCare: false,
    wellness: hasChart,
    pain: hasChart,
    stress: false,
    sleep: false
  });
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageBlob, setImageBlob] = useState(null);
  const [imageMessage, setImageMessage] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const previewRef = useRef("");

  useEffect(() => () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }
  }, []);

  const options = [
    ["highlight", "Destaque", Boolean(story.highlight)],
    ["comments", "Recado", Boolean(story.comments)],
    ["homeCare", "Cuidados", Boolean(story.homeCare)],
    ["wellness", "Bem-estar", hasChart],
    ["pain", "Dor", hasChart],
    ["stress", "Estresse", hasChart],
    ["sleep", "Sono", hasChart]
  ];
  const selectedCount = options.filter(([key, , available]) => available && pick[key]).length;
  const range = series.labels.length > 1 ? `${series.labels[0]} a ${series.labels[series.labels.length - 1]}` : series.labels[0] || "";

  const clearPreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = "";
    }
    setPreviewUrl("");
    setImageBlob(null);
  };

  const togglePick = (key) => {
    clearPreview();
    setImageMessage("");
    setPick((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const createImage = async () => {
    setImageBusy(true);
    setImageMessage("");
    try {
      const canvas = renderEvolutionCanvas({
        clinicName: evolution?.clinicName || clinicName,
        clientFirstName: name,
        highlight: story.highlight,
        comments: story.comments,
        homeCare: story.homeCare,
        checkpoints: series.points,
        include: pick
      });
      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
      previewRef.current = url;
      setPreviewUrl(url);
      setImageBlob(blob);
    } catch (imageError) {
      setImageMessage("Não foi possível gerar a imagem.");
    } finally {
      setImageBusy(false);
    }
  };

  const downloadImage = async () => {
    if (!imageBlob) {
      return;
    }
    await downloadEvolutionImage(imageBlob);
    setImageMessage("Imagem baixada. Publique a partir da galeria.");
  };

  const shareImage = async () => {
    if (!imageBlob) {
      return;
    }
    try {
      const result = await shareEvolutionImage(imageBlob, story.highlight || `Evolução na ${clinicName || "clínica"}`);
      setImageMessage(result === "shared" ? "Escolha onde publicar." : "Seu navegador baixou a imagem. Publique a partir da galeria.");
    } catch (shareError) {
      if (shareError?.name === "AbortError") {
        setImageMessage("");
        return;
      }
      setImageMessage("Não foi possível compartilhar. Baixe a imagem e publique da galeria.");
    }
  };

  const showTrend = series.points.length >= 2;

  return (
    <main className="evolution-page">
      <section className="evolution-shell">
        <header className="evolution-hero">
          <p className="quiz-kicker">{evolution?.clinicName || clinicName}</p>
          <h1>Sua evolução, {name}</h1>
          {story.highlight ? <p className="evolution-highlight">{story.highlight}</p> : null}
          {range ? <p className="evolution-meta">{series.points.length} registros · {range}</p> : null}
          <a className="primary-btn evolution-share-jump" href="#imagem-redes">Imagem para as redes</a>
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
                <SimpleLineChart wide title="Bem-estar" values={series.wellness} labels={series.labels} max={100} />
                <SimpleLineChart title="Dor" values={series.pain} labels={series.labels} max={10} />
                <SimpleLineChart title="Estresse" values={series.stress} labels={series.labels} max={10} />
                <SimpleLineChart title="Sono (horas)" values={series.sleep} labels={series.labels} max={12} />
              </>
            ) : (
              <p className="muted-text">A clínica ainda está reunindo dados suficientes para os gráficos.</p>
            )}
          </div>
        </div>

        <section className="evolution-share" id="imagem-redes">
          <h2>Imagem para as redes</h2>
          <p>Escolha o que entra na imagem. Ela sai quadrada, pronta para publicar.</p>
          <div className="evolution-share-options">
            {options.map(([key, label, available]) => (
              <label key={key} className={available ? "" : "is-disabled"}>
                <input
                  type="checkbox"
                  checked={Boolean(available && pick[key])}
                  disabled={!available}
                  onChange={() => togglePick(key)}
                />
                {label}
              </label>
            ))}
          </div>
          {!hasChart ? <p className="field-hint">Os gráficos entram quando houver pelo menos duas datas.</p> : null}
          <div className="evolution-share-actions">
            <button type="button" className="primary-btn" onClick={createImage} disabled={imageBusy || selectedCount === 0}>
              {imageBusy ? "Criando..." : "Criar imagem"}
            </button>
            <button type="button" className="secondary-btn" onClick={downloadImage} disabled={!imageBlob}>
              Baixar
            </button>
            <button type="button" className="secondary-btn" onClick={shareImage} disabled={!imageBlob}>
              Compartilhar
            </button>
          </div>
          {imageMessage ? <p className="evolution-share-message">{imageMessage}</p> : null}
          {previewUrl ? <img className="evolution-share-preview" src={previewUrl} alt="Prévia da imagem para as redes" /> : null}
        </section>
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

  if (link.status === "respondido" || link.status === "importado") {
    return (
      <main className="quiz-page">
        <section className="quiz-card">
          <p className="quiz-kicker">{link.clinicName}</p>
          <h1>Obrigado, {link.clientFirstName}!</h1>
          <p>
            {link.type === "consentimento"
              ? "Sua resposta sobre o uso de imagem chegou na clínica."
              : "Suas respostas chegaram na clínica. As observações da profissional continuam só com ela."}
          </p>
        </section>
      </main>
    );
  }

  if (link.type === "evolucao") {
    if (evolution) {
      return (
        <EvolutionView
          evolution={evolution}
          fallbackName={link.clientFirstName}
          clinicName={link.clinicName}
        />
      );
    }
    return (
      <main className="evolution-page">
        <section className="quiz-card evolution-lock">
          <p className="quiz-kicker">{link.clinicName}</p>
          <h1>Olá, {link.clientFirstName}</h1>
          <p>Para ver sua evolução, confirme o telefone cadastrado na clínica.</p>
          <form className="form" onSubmit={unlockEvolution}>
            <label>
              Telefone com DDD
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                placeholder="(00) 00000-0000"
                required
              />
            </label>
            {phoneError ? <p className="error-text">{phoneError}</p> : null}
            <button className="primary-btn" type="submit">Ver evolução</button>
          </form>
        </section>
      </main>
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
    <main className="quiz-page">
      <section className="quiz-card">
        <p className="quiz-kicker">{link.clinicName}</p>
        <h1>{link.type === "acompanhamento" ? "Como você está?" : `Olá, ${link.clientFirstName}`}</h1>
        <p className="muted-text">
          {link.type === "acompanhamento"
            ? link.moment === "depois"
              ? "Conte como você ficou depois do atendimento."
              : "Conte como você está antes do atendimento."
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
  );
}
