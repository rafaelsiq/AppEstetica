import { useEffect, useMemo, useState } from "react";
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

function formatDatePt(dateValue) {
  if (!dateValue) {
    return "--";
  }
  const parsed = new Date(`${dateValue}T00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleDateString("pt-BR");
}

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

function EvolutionCharts({ checkpoints }) {
  const points = checkpoints.filter((item) => item.date);
  if (points.length < 2) {
    return <p className="muted-text">A clínica ainda está reunindo dados suficientes para os gráficos.</p>;
  }

  const series = [
    { title: "Dor", field: "painLevel", max: 10 },
    { title: "Estresse", field: "stressLevel", max: 10 },
    { title: "Sono (horas)", field: "sleepHours", max: 12 }
  ];

  return (
    <div className="quiz-charts">
      <WellnessChart points={points} />
      {series.map((seriesItem) => (
        <SimpleLineChart key={seriesItem.field} points={points} {...seriesItem} />
      ))}
    </div>
  );
}

function WellnessChart({ points }) {
  const scores = points.map((item) => {
    const pain = Math.min(Math.max(Number(item.painLevel) || 0, 0), 10);
    const stress = Math.min(Math.max(Number(item.stressLevel) || 0, 0), 10);
    const sleep = Math.min(Math.max(Number(item.sleepHours) || 0, 0), 10);
    return Math.round(((10 - pain) * 0.4 + (10 - stress) * 0.3 + sleep * 0.3) * 10);
  });
  return <SimpleLineChart title="Bem-estar" values={scores} labels={points.map((item) => formatDatePt(item.date))} max={100} />;
}

function SimpleLineChart({ title, points, field, values, labels, max }) {
  const seriesValues = values || (points || []).map((item) => Number(item[field]) || 0);
  const seriesLabels = labels || (points || []).map((item) => formatDatePt(item.date));
  const width = 360;
  const height = 180;
  const padding = 28;
  const maxValue = max || 10;
  const getX = (index) =>
    seriesValues.length === 1 ? padding : padding + (index * (width - padding * 2)) / (seriesValues.length - 1);
  const getY = (value) => padding + (1 - Math.min(Math.max(value, 0), maxValue) / maxValue) * (height - padding * 2);
  const path = seriesValues.map((value, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(value)}`).join(" ");

  return (
    <article className="chart-card">
      <h5>{title}</h5>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={title}>
        <path d={path} className="chart-line chart-line-primary" />
        {seriesValues.map((value, index) => (
          <g key={`${seriesLabels[index]}-${index}`}>
            <circle cx={getX(index)} cy={getY(value)} r="3.5" className="chart-point-primary" />
            <text x={getX(index)} y={height - 6} textAnchor="middle" className="chart-axis-x">
              {seriesLabels[index]}
            </text>
          </g>
        ))}
      </svg>
    </article>
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
          <p>Suas respostas chegaram na clínica. As observações da profissional continuam só com ela.</p>
        </section>
      </main>
    );
  }

  if (link.type === "evolucao") {
    return (
      <main className="quiz-page">
        <section className="quiz-card">
          <p className="quiz-kicker">{link.clinicName}</p>
          {evolution ? (
            <>
              <h1>Sua evolução, {evolution.clientFirstName || link.clientFirstName}</h1>
              {evolution.comments ? (
                <article className="quiz-note">
                  <h2>Recado da clínica</h2>
                  <p>{evolution.comments}</p>
                </article>
              ) : null}
              <EvolutionCharts checkpoints={evolution.checkpoints || []} />
            </>
          ) : (
            <>
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
            </>
          )}
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
