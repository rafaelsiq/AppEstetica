import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { auth, db } from "./firebase";

const TABS = {
  AGENDA: "agenda",
  CLIENTES: "clientes",
  SERVICOS: "servicos"
};

const CLIENT_VIEWS = {
  ANAMNESE: "anamnese",
  FOLLOWUP: "followup",
  CHARTS: "charts"
};

const PAIN_AREAS = [
  "Cabeça",
  "Articulação temporomandibular",
  "Pescoço",
  "Ombro",
  "Braço",
  "Antebraço",
  "Mão",
  "Dedos",
  "Peito",
  "Abdômen",
  "Cintura",
  "Quadril",
  "Coxa",
  "Coxa posterior",
  "Joelho",
  "Perna",
  "Tornozelo",
  "Pé",
  "Cervical",
  "Escápula",
  "Cotovelo",
  "Lombar",
  "Glúteo",
  "Panturrilha",
  "Planta do pé"
];

const FRONT_PAIN_REGIONS = [
  { label: "Cabeça", x: 50.2, y: 6.2 },
  { label: "Articulação temporomandibular", x: 57.8, y: 12.8 },
  { label: "Pescoço", x: 57.8, y: 18.1 },
  { label: "Ombro", x: 38.3, y: 27.7 },
  { label: "Braço", x: 35.6, y: 37.0 },
  { label: "Antebraço", x: 30.9, y: 47.0 },
  { label: "Mão", x: 31.1, y: 56.9 },
  { label: "Dedos", x: 35.0, y: 61.2 },
  { label: "Peito", x: 57.8, y: 27.0 },
  { label: "Abdômen", x: 51.7, y: 48.0 },
  { label: "Cintura", x: 61.0, y: 48.0 },
  { label: "Quadril", x: 64.6, y: 58.5 },
  { label: "Coxa", x: 58.5, y: 67.7 },
  { label: "Joelho", x: 62.6, y: 75.8 },
  { label: "Perna", x: 45.1, y: 83.4 },
  { label: "Tornozelo", x: 41.5, y: 92.4 },
  { label: "Pé", x: 60.6, y: 96.0 }
];

const BACK_PAIN_REGIONS = [
  { label: "Cervical", x: 50.0, y: 16.7 },
  { label: "Escápula", x: 59.3, y: 28.0 },
  { label: "Cotovelo", x: 66.7, y: 39.1 },
  { label: "Lombar", x: 49.3, y: 48.2 },
  { label: "Glúteo", x: 55.8, y: 55.7 },
  { label: "Coxa posterior", x: 40.2, y: 68.4 },
  { label: "Panturrilha", x: 38.7, y: 79.5 },
  { label: "Planta do pé", x: 57.5, y: 96.0 }
];

const LATERALITY_OPTIONS = [
  { value: "left", label: "Esquerdo", short: "E" },
  { value: "right", label: "Direito", short: "D" },
  { value: "both", label: "Ambos", short: "A" }
];

const SEX_OPTIONS = [
  { value: "", label: "Selecionar" },
  { value: "female", label: "Feminino" },
  { value: "male", label: "Masculino" },
  { value: "other", label: "Outro" },
  { value: "not_informed", label: "Prefere não informar" }
];

const PAIN_RADIATION_OPTIONS = [
  { value: "specific", label: "Em ponto específico" },
  { value: "radiates", label: "Irradia para outra área" },
  { value: "both", label: "As duas situações" }
];

const PAIN_TYPE_OPTIONS = [
  "Queimação",
  "Fisgada",
  "Pontada",
  "Constante",
  "Peso / pressão",
  "Latejante"
];

const PAIN_TRIGGER_OPTIONS = [
  "Ao acordar",
  "No trabalho",
  "Ao ficar sentada/o por muito tempo",
  "Ao treinar / atividade física",
  "Em períodos de estresse",
  "Durante o sono",
  "Ao dirigir",
  "Após esforço repetitivo"
];

const GOAL_OPTIONS = [
  { value: "relaxation", label: "Relaxamento geral" },
  { value: "specific_tension", label: "Foco em área de tensão específica" },
  { value: "both", label: "Ambos" }
];

const SPORT_OPTIONS = [
  "Musculação",
  "Corrida",
  "Ciclismo",
  "Crossfit",
  "Pilates",
  "Yoga",
  "Natação",
  "Esportes de quadra"
];

const PREVIOUS_TREATMENT_OPTIONS = [
  "Massagem relaxante",
  "Massagem terapêutica",
  "Fisioterapia",
  "Quiropraxia",
  "Acupuntura",
  "Drenagem linfática"
];

const AESTHETIC_GOAL_OPTIONS = [
  "Redução de medidas",
  "Melhora da firmeza",
  "Redução de inchaço",
  "Melhora de celulite",
  "Modelagem corporal",
  "Melhora de circulação"
];

const HABIT_OPTIONS = [
  "Postura inadequada",
  "Sedentarismo",
  "Estresse elevado",
  "Sono insuficiente",
  "Movimentos repetitivos",
  "Uso excessivo de celular/computador"
];

const PAIN_RADIATION_VALUES = PAIN_RADIATION_OPTIONS.map((option) => option.value);
const GOAL_OPTION_VALUES = GOAL_OPTIONS.map((option) => option.value);

const HEALTH_CONDITIONS = [
  "Tendinite",
  "Bursite",
  "Diabetes",
  "Cardiopatia",
  "Trombose",
  "Lipedema",
  "Gota",
  "Epilepsia",
  "Fibromialgia",
  "Câncer / Tumores",
  "Fratura",
  "Sinusite",
  "Rinite",
  "Enxaqueca",
  "Bruxismo",
  "Depressão",
  "Insônia",
  "Pressão alterada"
];

const SESSION_TYPES = ["Miofascial", "Relaxante", "Facial", "Drenagem", "Esportiva"];

function sortAppointments(items) {
  return [...items].sort((a, b) => {
    const first = new Date(`${a.date || "1970-01-01"}T${a.time || "00:00"}`);
    const second = new Date(`${b.date || "1970-01-01"}T${b.time || "00:00"}`);
    return first - second;
  });
}

function sortByDate(items) {
  return [...items].sort((a, b) => {
    const first = new Date(a.date || "1970-01-01");
    const second = new Date(b.date || "1970-01-01");
    return first - second;
  });
}

function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultPainSelection(label, laterality = "both") {
  const frontRegion = FRONT_PAIN_REGIONS.find((region) => region.label === label);
  if (frontRegion) {
    return { label, side: "front", x: frontRegion.x, y: frontRegion.y, laterality };
  }
  const backRegion = BACK_PAIN_REGIONS.find((region) => region.label === label);
  if (backRegion) {
    return { label, side: "back", x: backRegion.x, y: backRegion.y, laterality };
  }
  return null;
}

function formatLateralityLabel(laterality) {
  const option = LATERALITY_OPTIONS.find((item) => item.value === laterality);
  return option ? option.label : "Ambos";
}

function formatLateralityShort(laterality) {
  const option = LATERALITY_OPTIONS.find((item) => item.value === laterality);
  return option ? option.short : "A";
}

function formatPainSelectionLocation(selection, showCoordinates = false) {
  const sideLabel = selection.side === "front" ? "Frente" : "Costas";
  if (!showCoordinates) {
    return sideLabel;
  }
  const x = Number(selection.x);
  const y = Number(selection.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return sideLabel;
  }
  return `${sideLabel} (${x.toFixed(1)}%, ${y.toFixed(1)}%)`;
}

function inferLateralityByCoordinate(x) {
  if (x < 47.5) {
    return "left";
  }
  if (x > 52.5) {
    return "right";
  }
  return "both";
}

function formatSexLabel(sex) {
  const option = SEX_OPTIONS.find((item) => item.value === sex);
  return option ? option.label : "Não informado";
}

function formatChoiceLabel(options, value) {
  const option = options.find((item) => item.value === value);
  return option ? option.label : "Não informado";
}

function formatYesNo(value) {
  if (value === "yes" || value === "sim") {
    return "Sim";
  }
  if (value === "no" || value === "nao") {
    return "Não";
  }
  return "Não informado";
}

function formatListOrFallback(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "Não informado";
  }
  return values.join(", ");
}

function formatTextOrFallback(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "Não informado";
  }
  return value.trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlWithLineBreaks(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function buildPdfSection(title, rows) {
  const renderedRows = rows
    .map(([label, value]) => {
      const safeValue = escapeHtmlWithLineBreaks(value || "Não informado");
      return `<tr><th>${escapeHtml(label)}</th><td>${safeValue}</td></tr>`;
    })
    .join("");

  return `
    <section class="pdf-section">
      <h2>${escapeHtml(title)}</h2>
      <table>
        <tbody>
          ${renderedRows}
        </tbody>
      </table>
    </section>
  `;
}

function buildAnamnesePdfHtml(client, anamnese) {
  const painSelectionsDescription = normalizePainSelections(anamnese.painSelections).map(
    (selection) =>
      `${selection.label} (${formatPainSelectionLocation(selection, true)} - ${formatLateralityLabel(
        selection.laterality
      )})`
  );

  const sections = [
    buildPdfSection("Dados da cliente", [
      ["Nome", formatTextOrFallback(client.name)],
      ["Telefone", formatTextOrFallback(client.phone)],
      ["E-mail", formatTextOrFallback(client.email)],
      ["Data de nascimento", client.birthDate ? formatDatePt(client.birthDate) : "Não informado"],
      ["Sexo", formatSexLabel(client.sex)],
      ["Endereço", formatTextOrFallback(client.address)]
    ]),
    buildPdfSection("Círculo das dores principais", [
      ["Regiões marcadas", formatListOrFallback(painSelectionsDescription)],
      ["Intensidade da dor (0 a 10)", formatTextOrFallback(anamnese.painScale)]
    ]),
    buildPdfSection("Perguntas-chave", [
      [
        "Dor em ponto específico ou irradiada",
        formatChoiceLabel(PAIN_RADIATION_OPTIONS, anamnese.painRadiatesOption)
      ],
      ["Detalhes de localização/irradiação", formatTextOrFallback(anamnese.painRadiatesDetails)],
      ["Primeiro episódio", formatTextOrFallback(anamnese.firstPainEpisode)],
      ["Tipos de dor", formatListOrFallback(anamnese.painTypeOptions)],
      ["Outro tipo de dor", formatTextOrFallback(anamnese.painTypeOther)],
      ["Situações com maior dor", formatListOrFallback(anamnese.painTriggerOptions)],
      ["Outra situação que piora", formatTextOrFallback(anamnese.painTriggerOther)],
      ["Objetivo principal", formatChoiceLabel(GOAL_OPTIONS, anamnese.goalOption)],
      ["Detalhes do objetivo", formatTextOrFallback(anamnese.goalDetails)],
      ["Pratica esporte?", formatYesNo(anamnese.playsSport)],
      ["Esportes", formatListOrFallback(anamnese.sportOptions)],
      ["Outro esporte", formatTextOrFallback(anamnese.sportOther)],
      ["Já fez outro tratamento/massagem?", formatYesNo(anamnese.hadPreviousTreatment)],
      ["Tratamentos anteriores", formatListOrFallback(anamnese.previousTreatmentTypes)],
      [
        "Experiência em tratamentos anteriores",
        formatTextOrFallback(anamnese.previousTreatmentExperience)
      ],
      ["Objetivos estéticos", formatListOrFallback(anamnese.aestheticGoalOptions)],
      ["Outro objetivo estético", formatTextOrFallback(anamnese.aestheticGoalsOther)],
      ["Hábitos que contribuem para dor", formatListOrFallback(anamnese.habitOptions)],
      ["Outros hábitos", formatTextOrFallback(anamnese.habitsContributingOther)]
    ]),
    buildPdfSection("Condições de saúde", [
      ["Condições selecionadas", formatListOrFallback(anamnese.healthConditions)],
      ["Outras observações de saúde", formatTextOrFallback(anamnese.healthOther)]
    ])
  ];

  if (client.sex === "female") {
    sections.push(
      buildPdfSection("Para mulheres", [
        ["Período menstrual", formatTextOrFallback(anamnese.menstrualPeriod)],
        ["Gestante?", formatYesNo(anamnese.pregnant)],
        ["Tempo de gestação", formatTextOrFallback(anamnese.gestatingTime)],
        ["Lactante?", formatYesNo(anamnese.lactating)]
      ])
    );
  }

  sections.push(
    buildPdfSection("Conclusão da ficha", [
      ["Área com mais atenção", formatTextOrFallback(anamnese.bodyFocus)],
      ["Observações gerais", formatTextOrFallback(anamnese.observations)],
      ["Assinatura (nome)", formatTextOrFallback(anamnese.signatureName)]
    ])
  );

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Anamnese - ${escapeHtml(client.name || "Cliente")}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #16252b;
            background: #ffffff;
            line-height: 1.35;
          }
          .pdf-container {
            max-width: 900px;
            margin: 0 auto;
            padding: 24px;
          }
          .pdf-title {
            border-bottom: 2px solid #24695c;
            padding-bottom: 10px;
            margin-bottom: 16px;
          }
          .pdf-title h1 {
            margin: 0;
            font-size: 24px;
          }
          .pdf-title p {
            margin: 6px 0 0;
            color: #4a5d68;
            font-size: 13px;
          }
          .pdf-section {
            margin-bottom: 16px;
            page-break-inside: avoid;
          }
          .pdf-section h2 {
            margin: 0 0 8px;
            font-size: 17px;
            color: #1f4f45;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #d7dde3;
          }
          th, td {
            border-bottom: 1px solid #e4e9ee;
            padding: 8px;
            text-align: left;
            vertical-align: top;
            font-size: 13px;
          }
          th {
            width: 32%;
            background: #f7fafc;
            color: #2f4957;
          }
          td {
            color: #24343d;
            white-space: pre-wrap;
            word-break: break-word;
          }
          tr:last-child th, tr:last-child td {
            border-bottom: none;
          }
          .pdf-footer {
            margin-top: 12px;
            color: #54656f;
            font-size: 12px;
          }
          @page {
            size: A4;
            margin: 12mm;
          }
        </style>
      </head>
      <body>
        <div class="pdf-container">
          <header class="pdf-title">
            <h1>Ficha de Anamnese</h1>
            <p>Clínica Estética • Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</p>
          </header>
          ${sections.join("")}
          <p class="pdf-footer">
            Dica: na janela de impressão, selecione "Salvar como PDF" para exportar o arquivo.
          </p>
        </div>
      </body>
    </html>
  `;
}

function normalizeStringArray(rawValues, allowedValues) {
  if (!Array.isArray(rawValues)) {
    return [];
  }
  return rawValues.filter(
    (value) => typeof value === "string" && allowedValues.includes(value)
  );
}

function normalizeSingleChoice(rawValue, allowedValues) {
  if (typeof rawValue !== "string") {
    return "";
  }
  return allowedValues.includes(rawValue) ? rawValue : "";
}

function normalizePainSelections(rawSelections) {
  if (!Array.isArray(rawSelections)) {
    return [];
  }

  const deduplicatedByLabel = new Map();

  rawSelections.forEach((selection) => {
    if (!selection || typeof selection !== "object") {
      return;
    }
    if (!PAIN_AREAS.includes(selection.label)) {
      return;
    }
    if (selection.side !== "front" && selection.side !== "back") {
      return;
    }
    const laterality = LATERALITY_OPTIONS.some((item) => item.value === selection.laterality)
      ? selection.laterality
      : "both";
    const x = Number(selection.x);
    const y = Number(selection.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    deduplicatedByLabel.set(selection.label, {
      label: selection.label,
      side: selection.side,
      x: Number(Math.min(100, Math.max(0, x)).toFixed(2)),
      y: Number(Math.min(100, Math.max(0, y)).toFixed(2)),
      laterality
    });
  });

  return Array.from(deduplicatedByLabel.values());
}

function buildEmptyAnamnese(client) {
  return {
    painAreas: [],
    painSelections: [],
    painRadiatesOption: "",
    painRadiatesDetails: "",
    firstPainEpisode: "",
    painTypeOptions: [],
    painTypeOther: "",
    painTriggerOptions: [],
    painTriggerOther: "",
    painScale: "",
    goalOption: "",
    goalDetails: "",
    playsSport: "",
    sportOptions: [],
    sportOther: "",
    hadPreviousTreatment: "",
    previousTreatmentTypes: [],
    previousTreatmentExperience: "",
    aestheticGoalOptions: [],
    aestheticGoalsOther: "",
    habitOptions: [],
    habitsContributingOther: "",
    bodyFocus: "",
    healthConditions: [],
    healthOther: "",
    menstrualPeriod: "",
    pregnant: "",
    gestatingTime: "",
    lactating: "",
    observations: "",
    signatureName: ""
  };
}

function normalizeAnamneseRecord(rawData = {}, client = null) {
  const data = rawData || {};
  const normalizedPainSelections = normalizePainSelections(data.painSelections);
  const fallbackSelectionsFromLegacyPainAreas = Array.isArray(data.painAreas)
    ? data.painAreas
        .filter((area) => PAIN_AREAS.includes(area))
        .map((area) => getDefaultPainSelection(area))
        .filter(Boolean)
    : [];
  const resolvedPainSelections =
    normalizedPainSelections.length > 0
      ? normalizedPainSelections
      : fallbackSelectionsFromLegacyPainAreas;

  return {
    ...buildEmptyAnamnese(client),
    painSelections: resolvedPainSelections,
    painAreas: resolvedPainSelections.map((selection) => selection.label),
    painRadiatesOption: normalizeSingleChoice(data.painRadiatesOption, PAIN_RADIATION_VALUES),
    painRadiatesDetails: data.painRadiatesDetails || data.painRadiates || "",
    firstPainEpisode: data.firstPainEpisode || "",
    painTypeOptions: normalizeStringArray(data.painTypeOptions, PAIN_TYPE_OPTIONS),
    painTypeOther: data.painTypeOther || data.painType || "",
    painTriggerOptions: normalizeStringArray(data.painTriggerOptions, PAIN_TRIGGER_OPTIONS),
    painTriggerOther: data.painTriggerOther || data.painTriggers || "",
    painScale: data.painScale || "",
    goalOption: normalizeSingleChoice(data.goalOption, GOAL_OPTION_VALUES),
    goalDetails: data.goalDetails || data.goal || "",
    playsSport: normalizeSingleChoice(data.playsSport, ["yes", "no"]),
    sportOptions: normalizeStringArray(data.sportOptions, SPORT_OPTIONS),
    sportOther: data.sportOther || data.practicesSport || "",
    hadPreviousTreatment: normalizeSingleChoice(data.hadPreviousTreatment, ["yes", "no"]),
    previousTreatmentTypes: normalizeStringArray(
      data.previousTreatmentTypes,
      PREVIOUS_TREATMENT_OPTIONS
    ),
    previousTreatmentExperience: data.previousTreatmentExperience || "",
    aestheticGoalOptions: normalizeStringArray(
      data.aestheticGoalOptions,
      AESTHETIC_GOAL_OPTIONS
    ),
    aestheticGoalsOther: data.aestheticGoalsOther || data.aestheticGoals || "",
    habitOptions: normalizeStringArray(data.habitOptions, HABIT_OPTIONS),
    habitsContributingOther: data.habitsContributingOther || data.habitsContributing || "",
    bodyFocus: data.bodyFocus || "",
    healthConditions: normalizeStringArray(data.healthConditions, HEALTH_CONDITIONS),
    healthOther: data.healthOther || "",
    menstrualPeriod: data.menstrualPeriod || "",
    pregnant: normalizeSingleChoice(data.pregnant, ["sim", "nao"]),
    gestatingTime: data.gestatingTime || "",
    lactating: normalizeSingleChoice(data.lactating, ["sim", "nao"]),
    observations: data.observations || "",
    signatureName: data.signatureName || ""
  };
}

function buildEmptyCheckpoint() {
  return {
    date: getTodayISODate(),
    sessionNumber: "",
    sessionType: "",
    painLevel: "",
    stressLevel: "",
    sleepHours: "",
    observations: ""
  };
}

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

function PainMapSelector({ painSelections, onSelectRegion, onRemoveRegion, isEditable }) {
  const [pendingSelection, setPendingSelection] = useState(null);

  useEffect(() => {
    if (!isEditable) {
      setPendingSelection(null);
    }
  }, [isEditable]);

  const getClosestRegion = (x, y, regions) => {
    let closestRegion = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    regions.forEach((region) => {
      const distance = Math.hypot(x - region.x, y - region.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestRegion = region;
      }
    });

    return closestRegion;
  };

  const handleMapClick = (event, regions, side) => {
    if (!isEditable) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const selectedRegion = getClosestRegion(x, y, regions);

    if (!selectedRegion) {
      return;
    }
    setPendingSelection({
      label: selectedRegion.label,
      side,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      laterality: inferLateralityByCoordinate(x)
    });
  };

  const handleConfirmSelection = (laterality) => {
    if (!isEditable) {
      return;
    }

    if (!pendingSelection) {
      return;
    }

    onSelectRegion({ ...pendingSelection, laterality });
    setPendingSelection(null);
  };

  const renderLateralityTooltip = (side) => {
    if (!pendingSelection || pendingSelection.side !== side) {
      return null;
    }

    return (
      <>
        <span
          className="pain-dot pending"
          style={{ left: `${pendingSelection.x}%`, top: `${pendingSelection.y}%` }}
          aria-hidden
        />
        <div
          className={`laterality-tooltip ${pendingSelection.y < 18 ? "below" : ""}`}
          style={{ left: `${pendingSelection.x}%`, top: `${pendingSelection.y}%` }}
          onClick={(event) => event.stopPropagation()}
        >
          <p>
            <strong>{pendingSelection.label}</strong> - qual lado?
          </p>
          <div className="laterality-tooltip-actions">
            {LATERALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  pendingSelection.laterality === option.value
                    ? "secondary-btn active-laterality"
                    : "secondary-btn"
                }
                onClick={(event) => {
                  event.stopPropagation();
                  handleConfirmSelection(option.value);
                }}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              className="danger-btn"
              onClick={(event) => {
                event.stopPropagation();
                setPendingSelection(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </>
    );
  };

  const selectedFrontRegions = painSelections.filter(
    (selection) => selection.side === "front"
  );
  const selectedBackRegions = painSelections.filter(
    (selection) => selection.side === "back"
  );

  return (
    <div className="pain-map-section">
      <p className="muted-text">
        {isEditable
          ? "Toque na região do corpo para marcar dor. A lateralidade aparecerá em um tooltip no ponto clicado. Toque na bolinha para desmarcar."
          : "Mapa em modo visualização. Clique em Editar ficha para alterar os pontos de dor."}
      </p>
      <div className="pain-map-grid">
        <figure
          className={`pain-map-card ${
            pendingSelection?.side === "front" ? "has-tooltip" : ""
          }`}
        >
          <div
            className="pain-map-canvas"
            data-editable={isEditable ? "true" : "false"}
            role={isEditable ? "button" : undefined}
            tabIndex={isEditable ? 0 : -1}
            onClick={(event) => handleMapClick(event, FRONT_PAIN_REGIONS, "front")}
          >
            <img src="/pain-map-front.jpg" alt="Mapa corporal frontal para seleção de dor" />
            {selectedFrontRegions.map((selection) => (
              <button
                key={`front-selected-${selection.label}`}
                type="button"
                className="pain-dot selected"
                style={{ left: `${selection.x}%`, top: `${selection.y}%` }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isEditable) {
                    return;
                  }
                  onRemoveRegion(selection.label);
                }}
                title={`${selection.label} (${formatLateralityLabel(
                  selection.laterality
                )} - ${formatPainSelectionLocation(selection)})`}
                aria-label={`Desmarcar ${selection.label}`}
              >
                <span className="pain-dot-label">{formatLateralityShort(selection.laterality)}</span>
              </button>
            ))}
            {renderLateralityTooltip("front")}
          </div>
          <figcaption>Frente</figcaption>
        </figure>
        <figure
          className={`pain-map-card ${
            pendingSelection?.side === "back" ? "has-tooltip" : ""
          }`}
        >
          <div
            className="pain-map-canvas"
            data-editable={isEditable ? "true" : "false"}
            role={isEditable ? "button" : undefined}
            tabIndex={isEditable ? 0 : -1}
            onClick={(event) => handleMapClick(event, BACK_PAIN_REGIONS, "back")}
          >
            <img src="/pain-map-back.jpg" alt="Mapa corporal traseiro para seleção de dor" />
            {selectedBackRegions.map((selection) => (
              <button
                key={`back-selected-${selection.label}`}
                type="button"
                className="pain-dot selected"
                style={{ left: `${selection.x}%`, top: `${selection.y}%` }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isEditable) {
                    return;
                  }
                  onRemoveRegion(selection.label);
                }}
                title={`${selection.label} (${formatLateralityLabel(
                  selection.laterality
                )} - ${formatPainSelectionLocation(selection)})`}
                aria-label={`Desmarcar ${selection.label}`}
              >
                <span className="pain-dot-label">{formatLateralityShort(selection.laterality)}</span>
              </button>
            ))}
            {renderLateralityTooltip("back")}
          </div>
          <figcaption>Costas</figcaption>
        </figure>
      </div>

      {painSelections.length > 0 ? (
        <div className="selected-areas">
          {painSelections.map((selection) => (
            <button
              key={`chip-${selection.label}`}
              type="button"
              className="selected-area-chip"
              onClick={() => {
                if (!isEditable) {
                  return;
                }
                onRemoveRegion(selection.label);
              }}
              title={`Remover ${selection.label}`}
            >
              {selection.label} ({formatLateralityLabel(selection.laterality)} -{" "}
              {formatPainSelectionLocation(selection)}) ×
            </button>
          ))}
        </div>
      ) : (
        <p className="muted-text">Nenhuma região selecionada.</p>
      )}
    </div>
  );
}

function ProgressLineChart({ title, points, firstMetric, secondMetric, maxValue }) {
  if (points.length < 2) {
    return (
      <div className="chart-card">
        <h5>{title}</h5>
        <p className="muted-text">Cadastre pelo menos 2 avaliações para gerar o gráfico.</p>
      </div>
    );
  }

  const width = 420;
  const height = 200;
  const padding = 30;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const midValue = maxValue / 2;
  const yLabels = [0, midValue, maxValue];

  const getX = (index) =>
    points.length === 1 ? padding : padding + (index * plotWidth) / (points.length - 1);

  const getY = (value) =>
    padding + (1 - Math.min(Math.max(Number(value) || 0, 0), maxValue) / maxValue) * plotHeight;

  const linePath = (fieldName) =>
    points
      .map((item, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(item[fieldName])}`)
      .join(" ");

  return (
    <div className="chart-card">
      <h5>{title}</h5>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={title}>
        {yLabels.map((marker) => {
          const y = getY(marker);
          return (
            <g key={marker}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} className="chart-grid" />
              <text x={4} y={y + 4} className="chart-axis">
                {marker}
              </text>
            </g>
          );
        })}

        <path d={linePath(firstMetric.field)} className="chart-line chart-line-primary" />
        <path d={linePath(secondMetric.field)} className="chart-line chart-line-secondary" />

        {points.map((item, index) => (
          <g key={`${item.date}-${index}`}>
            <circle
              cx={getX(index)}
              cy={getY(item[firstMetric.field])}
              r="3"
              className="chart-point-primary"
            />
            <circle
              cx={getX(index)}
              cy={getY(item[secondMetric.field])}
              r="3"
              className="chart-point-secondary"
            />
            <text x={getX(index)} y={height - 8} textAnchor="middle" className="chart-axis-x">
              {formatDatePt(item.date)}
            </text>
          </g>
        ))}
      </svg>
      <div className="chart-legend">
        <span>
          <i className="legend-dot legend-primary" />
          {firstMetric.label}
        </span>
        <span>
          <i className="legend-dot legend-secondary" />
          {secondMetric.label}
        </span>
      </div>
    </div>
  );
}

function SleepBarChart({ points }) {
  if (points.length < 1) {
    return (
      <div className="chart-card">
        <h5>Sono (horas por sessão)</h5>
        <p className="muted-text">Sem dados de sono até o momento.</p>
      </div>
    );
  }

  const width = 420;
  const height = 200;
  const padding = 30;
  const maxValue = 12;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const barWidth = Math.max(14, plotWidth / points.length - 10);

  const getX = (index) =>
    padding +
    index * (plotWidth / points.length) +
    (plotWidth / points.length - barWidth) / 2;

  const barHeight = (value) => (Math.min(Math.max(Number(value) || 0, 0), maxValue) / maxValue) * plotHeight;

  return (
    <div className="chart-card">
      <h5>Sono (horas por sessão)</h5>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Gráfico de sono">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-grid" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="chart-grid" />

        {points.map((item, index) => {
          const currentBarHeight = barHeight(item.sleepHours);
          return (
            <g key={`${item.date}-${index}`}>
              <rect
                x={getX(index)}
                y={height - padding - currentBarHeight}
                width={barWidth}
                height={currentBarHeight}
                className="chart-bar"
              />
              <text x={getX(index) + barWidth / 2} y={height - 8} textAnchor="middle" className="chart-axis-x">
                {formatDatePt(item.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function WellnessScoreChart({ points, className = "" }) {
  if (points.length < 2) {
    return (
      <div className={`chart-card ${className}`.trim()}>
        <h5>Índice de bem-estar por sessão</h5>
        <p className="muted-text">Cadastre pelo menos 2 avaliações para gerar o gráfico.</p>
      </div>
    );
  }

  const scorePoints = points.map((item) => {
    const pain = Math.min(Math.max(Number(item.painLevel) || 0, 0), 10);
    const stress = Math.min(Math.max(Number(item.stressLevel) || 0, 0), 10);
    const sleep = Math.min(Math.max(Number(item.sleepHours) || 0, 0), 10);
    const score = Math.round(((10 - pain) * 0.4 + (10 - stress) * 0.3 + sleep * 0.3) * 10);
    return { ...item, score };
  });

  const width = 420;
  const height = 200;
  const padding = 30;
  const maxValue = 100;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const yLabels = [0, 50, 100];

  const getX = (index) =>
    scorePoints.length === 1
      ? padding
      : padding + (index * plotWidth) / (scorePoints.length - 1);

  const getY = (value) =>
    padding + (1 - Math.min(Math.max(Number(value) || 0, 0), maxValue) / maxValue) * plotHeight;

  const linePath = scorePoints
    .map((item, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(item.score)}`)
    .join(" ");

  return (
    <div className={`chart-card ${className}`.trim()}>
      <h5>Índice de bem-estar por sessão</h5>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        role="img"
        aria-label="Evolução do índice de bem-estar"
      >
        {yLabels.map((marker) => {
          const y = getY(marker);
          return (
            <g key={marker}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} className="chart-grid" />
              <text x={4} y={y + 4} className="chart-axis">
                {marker}
              </text>
            </g>
          );
        })}

        <path d={linePath} className="chart-line chart-line-tertiary" />

        {scorePoints.map((item, index) => (
          <g key={`${item.date}-${index}`}>
            <circle cx={getX(index)} cy={getY(item.score)} r="3" className="chart-point-tertiary" />
            <text x={getX(index)} y={height - 8} textAnchor="middle" className="chart-axis-x">
              {formatDatePt(item.date)}
            </text>
          </g>
        ))}
      </svg>
      <p className="muted-text chart-footnote">
        Índice estimado (0-100) combinando dor, estresse e sono para acompanhamento visual.
      </p>
    </div>
  );
}

function SessionTypeDistributionChart({ points }) {
  if (points.length < 1) {
    return (
      <div className="chart-card">
        <h5>Distribuição por tipo de atendimento</h5>
        <p className="muted-text">Sem sessões registradas para montar distribuição.</p>
      </div>
    );
  }

  const typeCountMap = points.reduce((accumulator, item) => {
    const normalizedType = SESSION_TYPES.includes(item.sessionType)
      ? item.sessionType
      : "Não informado";
    accumulator[normalizedType] = (accumulator[normalizedType] || 0) + 1;
    return accumulator;
  }, {});

  const rows = Object.entries(typeCountMap).sort(([, a], [, b]) => b - a);
  const maxCount = Math.max(...rows.map(([, count]) => count), 1);

  return (
    <div className="chart-card">
      <h5>Distribuição por tipo de atendimento</h5>
      <div className="distribution-chart">
        {rows.map(([type, count]) => (
          <div key={type} className="distribution-row">
            <div className="distribution-label">{type}</div>
            <div className="distribution-track">
              <div
                className="distribution-fill"
                style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
              />
            </div>
            <div className="distribution-count">{count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InitialVsCurrentChart({ points }) {
  if (points.length < 2) {
    return (
      <div className="chart-card">
        <h5>Comparativo inicial x atual</h5>
        <p className="muted-text">Cadastre pelo menos 2 sessões para gerar comparativo.</p>
      </div>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];

  const metricRows = [
    { label: "Dor", field: "painLevel", max: 10, improveWhen: "down" },
    { label: "Estresse", field: "stressLevel", max: 10, improveWhen: "down" },
    { label: "Sono (h)", field: "sleepHours", max: 12, improveWhen: "up" }
  ].map((metric) => {
    const firstValue = Number(first[metric.field]) || 0;
    const lastValue = Number(last[metric.field]) || 0;
    const firstPercent = Math.min(Math.max((firstValue / metric.max) * 100, 0), 100);
    const lastPercent = Math.min(Math.max((lastValue / metric.max) * 100, 0), 100);
    const deltaRaw = Number((lastValue - firstValue).toFixed(1));
    const improved =
      metric.improveWhen === "down" ? deltaRaw <= 0 : deltaRaw >= 0;

    return {
      ...metric,
      firstValue,
      lastValue,
      firstPercent,
      lastPercent,
      deltaRaw,
      improved
    };
  });

  return (
    <div className="chart-card">
      <h5>Comparativo inicial x atual</h5>
      <div className="comparison-chart">
        {metricRows.map((metric) => (
          <div key={metric.field} className="comparison-row">
            <div className="comparison-header">
              <strong>{metric.label}</strong>
              <span className={metric.improved ? "delta-good" : "delta-alert"}>
                Δ {metric.deltaRaw > 0 ? "+" : ""}
                {metric.deltaRaw}
              </span>
            </div>
            <div className="comparison-track">
              <div className="comparison-fill comparison-fill-initial" style={{ width: `${metric.firstPercent}%` }} />
            </div>
            <div className="comparison-meta">Início: {metric.firstValue}</div>
            <div className="comparison-track">
              <div className="comparison-fill comparison-fill-current" style={{ width: `${metric.lastPercent}%` }} />
            </div>
            <div className="comparison-meta">Atual: {metric.lastValue}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState(TABS.AGENDA);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientBirthDate, setClientBirthDate] = useState("");
  const [clientSex, setClientSex] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [editingClientId, setEditingClientId] = useState("");
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [clientFormMessage, setClientFormMessage] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [appointmentClient, setAppointmentClient] = useState("");
  const [appointmentService, setAppointmentService] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientView, setSelectedClientView] = useState(null);
  const [openClientMenuId, setOpenClientMenuId] = useState("");
  const [anamneseForm, setAnamneseForm] = useState(buildEmptyAnamnese());
  const [anamneseSnapshot, setAnamneseSnapshot] = useState(buildEmptyAnamnese());
  const [isEditingAnamnese, setIsEditingAnamnese] = useState(false);
  const [clientHasAnamnese, setClientHasAnamnese] = useState(false);
  const [checkpoints, setCheckpoints] = useState([]);
  const [checkpointForm, setCheckpointForm] = useState(buildEmptyCheckpoint());
  const [anamneseMessage, setAnamneseMessage] = useState("");

  const resetClientForm = () => {
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setClientBirthDate("");
    setClientSex("");
    setClientAddress("");
    setEditingClientId("");
    setIsClientFormOpen(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setClients([]);
      setServices([]);
      setAppointments([]);
      resetClientForm();
      setClientFormMessage("");
      setSelectedClientId("");
      setSelectedClientView(null);
      setOpenClientMenuId("");
      setAnamneseForm(buildEmptyAnamnese());
      setAnamneseSnapshot(buildEmptyAnamnese());
      setIsEditingAnamnese(false);
      setClientHasAnamnese(false);
      setCheckpoints([]);
      return undefined;
    }

    const clientsRef = collection(db, "users", user.uid, "clients");
    const servicesRef = collection(db, "users", user.uid, "services");
    const appointmentsRef = collection(db, "users", user.uid, "appointments");

    const unsubscribeClients = onSnapshot(clientsRef, (snapshot) => {
      setClients(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    const unsubscribeServices = onSnapshot(servicesRef, (snapshot) => {
      setServices(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    const unsubscribeAppointments = onSnapshot(appointmentsRef, (snapshot) => {
      const loadedAppointments = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));
      setAppointments(sortAppointments(loadedAppointments));
    });

    return () => {
      unsubscribeClients();
      unsubscribeServices();
      unsubscribeAppointments();
    };
  }, [user]);

  useEffect(() => {
    if (!selectedClientId) {
      return;
    }
    const numericSessionNumbers = checkpoints
      .map((item) => Number(item.sessionNumber))
      .filter((value) => Number.isFinite(value) && value > 0);
    const nextSessionNumber = numericSessionNumbers.length > 0
      ? Math.max(...numericSessionNumbers) + 1
      : checkpoints.length + 1;
    setCheckpointForm((previous) => ({
      ...previous,
      sessionNumber: String(nextSessionNumber)
    }));
  }, [checkpoints, selectedClientId]);


  useEffect(() => {
    if (!selectedClientId) {
      return;
    }
    if (!clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId("");
      setSelectedClientView(null);
      setOpenClientMenuId("");
      setAnamneseForm(buildEmptyAnamnese());
      setAnamneseSnapshot(buildEmptyAnamnese());
      setIsEditingAnamnese(false);
      setClientHasAnamnese(false);
      setCheckpoints([]);
    }
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (!editingClientId) {
      return;
    }
    if (!clients.some((client) => client.id === editingClientId)) {
      resetClientForm();
    }
  }, [clients, editingClientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  useEffect(() => {
    if (!user || !selectedClient) {
      setAnamneseForm(buildEmptyAnamnese(selectedClient));
      setAnamneseSnapshot(buildEmptyAnamnese(selectedClient));
      setIsEditingAnamnese(false);
      setClientHasAnamnese(false);
      setCheckpoints([]);
      return undefined;
    }

    setIsEditingAnamnese(false);

    const anamneseRef = doc(db, "users", user.uid, "anamneses", selectedClient.id);
    const checkpointsRef = collection(db, "users", user.uid, "anamneses", selectedClient.id, "checkpoints");

    const unsubscribeAnamnese = onSnapshot(anamneseRef, (snapshot) => {
      if (!snapshot.exists()) {
        const emptyRecord = buildEmptyAnamnese(selectedClient);
        setClientHasAnamnese(false);
        setAnamneseForm(emptyRecord);
        setAnamneseSnapshot(emptyRecord);
        setIsEditingAnamnese(true);
        return;
      }

      const normalizedRecord = normalizeAnamneseRecord(snapshot.data(), selectedClient);
      setClientHasAnamnese(true);
      setAnamneseForm(normalizedRecord);
      setAnamneseSnapshot(normalizedRecord);
      setIsEditingAnamnese(false);
    });

    const unsubscribeCheckpoints = onSnapshot(checkpointsRef, (snapshot) => {
      const loaded = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setCheckpoints(sortByDate(loaded));
    });

    return () => {
      unsubscribeAnamnese();
      unsubscribeCheckpoints();
    };
  }, [user, selectedClient]);

  const formattedUserName = useMemo(() => {
    if (!user?.email) {
      return "";
    }
    return user.email.split("@")[0];
  }, [user]);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");

    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }

      setAuthEmail("");
      setAuthPassword("");
    } catch (error) {
      setAuthError("Não foi possível concluir a autenticação. Verifique os dados.");
    }
  };

  const handleSaveClient = async (event) => {
    event.preventDefault();
    if (!clientName.trim() || !user) {
      return;
    }

    const payload = {
      name: clientName.trim(),
      phone: clientPhone.trim(),
      email: clientEmail.trim(),
      birthDate: clientBirthDate,
      sex: clientSex,
      address: clientAddress.trim(),
      updatedAt: serverTimestamp()
    };

    if (editingClientId) {
      await updateDoc(doc(db, "users", user.uid, "clients", editingClientId), payload);
      setClientFormMessage("Cadastro da cliente atualizado.");
    } else {
      await addDoc(collection(db, "users", user.uid, "clients"), {
        ...payload,
        createdAt: serverTimestamp()
      });
      setClientFormMessage("Cliente adicionada com sucesso.");
    }

    resetClientForm();
    setTimeout(() => setClientFormMessage(""), 2500);
  };

  const handleStartCreateClient = () => {
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setClientBirthDate("");
    setClientSex("");
    setClientAddress("");
    setEditingClientId("");
    setIsClientFormOpen(true);
    setClientFormMessage("");
  };

  const handleEditClient = (client) => {
    setClientName(client.name || "");
    setClientPhone(client.phone || "");
    setClientEmail(client.email || "");
    setClientBirthDate(client.birthDate || "");
    setClientSex(client.sex || "");
    setClientAddress(client.address || "");
    setEditingClientId(client.id);
    setIsClientFormOpen(true);
    setClientFormMessage("");
    setOpenClientMenuId("");
  };

  const handleOpenClientView = (clientId, view) => {
    setSelectedClientId(clientId);
    setSelectedClientView(view);
    setOpenClientMenuId("");
    setAnamneseMessage("");
  };

  const handleToggleClientMenu = (clientId) => {
    setOpenClientMenuId((previous) => (previous === clientId ? "" : clientId));
  };

  const handleCloseClientView = () => {
    setSelectedClientId("");
    setSelectedClientView(null);
    setAnamneseMessage("");
  };

  const handleStartEditAnamnese = () => {
    setIsEditingAnamnese(true);
    setAnamneseMessage("");
  };

  const handleCancelEditAnamnese = () => {
    if (clientHasAnamnese) {
      setAnamneseForm(anamneseSnapshot);
      setIsEditingAnamnese(false);
    }
  };

  const handleAddService = async (event) => {
    event.preventDefault();
    if (!serviceTitle.trim() || !user) {
      return;
    }

    await addDoc(collection(db, "users", user.uid, "services"), {
      title: serviceTitle.trim(),
      price: Number(servicePrice || 0),
      createdAt: serverTimestamp()
    });

    setServiceTitle("");
    setServicePrice("");
  };

  const handleAddAppointment = async (event) => {
    event.preventDefault();
    if (!user || !appointmentClient.trim() || !appointmentService.trim() || !appointmentDate) {
      return;
    }

    await addDoc(collection(db, "users", user.uid, "appointments"), {
      client: appointmentClient.trim(),
      service: appointmentService.trim(),
      date: appointmentDate,
      time: appointmentTime,
      notes: appointmentNotes.trim(),
      createdAt: serverTimestamp()
    });

    setAppointmentClient("");
    setAppointmentService("");
    setAppointmentDate("");
    setAppointmentTime("");
    setAppointmentNotes("");
  };

  const handleDeleteByCollection = async (collectionName, itemId) => {
    if (!user) {
      return;
    }

    await deleteDoc(doc(db, "users", user.uid, collectionName, itemId));
  };

  const handleAnamneseFieldChange = (fieldName, value) => {
    setAnamneseForm((previous) => ({ ...previous, [fieldName]: value }));
  };

  const toggleArrayValue = (fieldName, value) => {
    setAnamneseForm((previous) => {
      const currentValues = Array.isArray(previous[fieldName]) ? previous[fieldName] : [];
      const exists = currentValues.includes(value);
      return {
        ...previous,
        [fieldName]: exists
          ? currentValues.filter((item) => item !== value)
          : [...currentValues, value]
      };
    });
  };

  const handleUpsertPainSelection = (newSelection) => {
    setAnamneseForm((previous) => {
      const currentSelections = normalizePainSelections(previous.painSelections);
      const selectionsWithoutCurrentLabel = currentSelections.filter(
        (selection) => selection.label !== newSelection.label
      );
      const nextSelections = [...selectionsWithoutCurrentLabel, newSelection];
      return {
        ...previous,
        painSelections: nextSelections,
        painAreas: nextSelections.map((selection) => selection.label)
      };
    });
  };

  const handleRemovePainSelection = (label) => {
    setAnamneseForm((previous) => {
      const currentSelections = normalizePainSelections(previous.painSelections);
      const nextSelections = currentSelections.filter(
        (selection) => selection.label !== label
      );
      return {
        ...previous,
        painSelections: nextSelections,
        painAreas: nextSelections.map((selection) => selection.label)
      };
    });
  };

  const handleExportAnamnesePdf = () => {
    if (!selectedClient) {
      return;
    }

    const normalizedAnamnese = normalizeAnamneseRecord(anamneseForm, selectedClient);
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");

    if (!printWindow) {
      setAnamneseMessage("Não foi possível abrir a janela de exportação. Libere pop-ups e tente novamente.");
      setTimeout(() => setAnamneseMessage(""), 3500);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildAnamnesePdfHtml(selectedClient, normalizedAnamnese));
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  const handleSaveAnamnese = async (event) => {
    event.preventDefault();
    if (!user || !selectedClient) {
      return;
    }

    const anamneseRef = doc(db, "users", user.uid, "anamneses", selectedClient.id);
    const normalizedPainSelections = normalizePainSelections(anamneseForm.painSelections);
    const normalizedPainTypeOptions = normalizeStringArray(
      anamneseForm.painTypeOptions,
      PAIN_TYPE_OPTIONS
    );
    const normalizedPainTriggerOptions = normalizeStringArray(
      anamneseForm.painTriggerOptions,
      PAIN_TRIGGER_OPTIONS
    );
    const normalizedSportOptions = normalizeStringArray(
      anamneseForm.sportOptions,
      SPORT_OPTIONS
    );
    const normalizedTreatmentTypes = normalizeStringArray(
      anamneseForm.previousTreatmentTypes,
      PREVIOUS_TREATMENT_OPTIONS
    );
    const normalizedAestheticGoalOptions = normalizeStringArray(
      anamneseForm.aestheticGoalOptions,
      AESTHETIC_GOAL_OPTIONS
    );
    const normalizedHabitOptions = normalizeStringArray(
      anamneseForm.habitOptions,
      HABIT_OPTIONS
    );

    const legacyPainType = [
      ...normalizedPainTypeOptions,
      anamneseForm.painTypeOther.trim()
    ]
      .filter(Boolean)
      .join(", ");
    const legacyPainTrigger = [
      ...normalizedPainTriggerOptions,
      anamneseForm.painTriggerOther.trim()
    ]
      .filter(Boolean)
      .join(", ");
    const legacyGoal = [anamneseForm.goalOption, anamneseForm.goalDetails.trim()]
      .filter(Boolean)
      .join(" - ");
    const legacySport = [
      anamneseForm.playsSport === "yes" ? "Pratica esporte" : "",
      ...normalizedSportOptions,
      anamneseForm.sportOther.trim()
    ]
      .filter(Boolean)
      .join(", ");
    const legacyAestheticGoal = [
      ...normalizedAestheticGoalOptions,
      anamneseForm.aestheticGoalsOther.trim()
    ]
      .filter(Boolean)
      .join(", ");
    const legacyHabits = [
      ...normalizedHabitOptions,
      anamneseForm.habitsContributingOther.trim()
    ]
      .filter(Boolean)
      .join(", ");

    const payload = {
      ...anamneseForm,
      painSelections: normalizedPainSelections,
      painAreas: normalizedPainSelections.map((selection) => selection.label),
      painTypeOptions: normalizedPainTypeOptions,
      painTriggerOptions: normalizedPainTriggerOptions,
      sportOptions: normalizedSportOptions,
      previousTreatmentTypes: normalizedTreatmentTypes,
      aestheticGoalOptions: normalizedAestheticGoalOptions,
      habitOptions: normalizedHabitOptions,
      painType: legacyPainType,
      painTriggers: legacyPainTrigger,
      painRadiates: anamneseForm.painRadiatesDetails,
      goal: legacyGoal,
      practicesSport: legacySport,
      aestheticGoals: legacyAestheticGoal,
      habitsContributing: legacyHabits,
      clientId: selectedClient.id,
      clientName: selectedClient.name || "",
      updatedAt: serverTimestamp()
    };

    await setDoc(
      anamneseRef,
      {
        ...payload,
        ...(clientHasAnamnese ? {} : { createdAt: serverTimestamp() })
      },
      { merge: true }
    );

    setIsEditingAnamnese(false);
    setAnamneseMessage(
      clientHasAnamnese ? "Ficha atualizada com sucesso." : "Ficha salva com sucesso."
    );
    setTimeout(() => setAnamneseMessage(""), 2500);
  };

  const handleCheckpointFieldChange = (fieldName, value) => {
    setCheckpointForm((previous) => ({ ...previous, [fieldName]: value }));
  };

  const handleAddCheckpoint = async (event) => {
    event.preventDefault();
    if (!user || !selectedClient || !checkpointForm.date || checkpointForm.painLevel === "") {
      return;
    }

    await addDoc(
      collection(db, "users", user.uid, "anamneses", selectedClient.id, "checkpoints"),
      {
        date: checkpointForm.date,
        sessionNumber: checkpointForm.sessionNumber.trim(),
        sessionType: checkpointForm.sessionType,
        painLevel: Number(checkpointForm.painLevel),
        stressLevel: Number(checkpointForm.stressLevel || 0),
        sleepHours: Number(checkpointForm.sleepHours || 0),
        observations: checkpointForm.observations.trim(),
        createdAt: serverTimestamp()
      }
    );

    setCheckpointForm(buildEmptyCheckpoint());
  };

  const handleDeleteCheckpoint = async (checkpointId) => {
    if (!user || !selectedClient) {
      return;
    }
    await deleteDoc(
      doc(db, "users", user.uid, "anamneses", selectedClient.id, "checkpoints", checkpointId)
    );
  };

  const checkpointChartData = useMemo(() => {
    return sortByDate(checkpoints).filter((item) => item.date);
  }, [checkpoints]);

  const isAnamneseViewOpen = selectedClientView === CLIENT_VIEWS.ANAMNESE;
  const isFollowupViewOpen = selectedClientView === CLIENT_VIEWS.FOLLOWUP;
  const isChartsViewOpen = selectedClientView === CLIENT_VIEWS.CHARTS;

  if (isLoadingAuth) {
    return <main className="page loading">Carregando...</main>;
  }

  if (!user) {
    return (
      <main className="page auth-page">
        <section className="card auth-card">
          <h1>Gestão da Clínica</h1>
          <p className="subtitle">Acesse para gerenciar agenda, clientes e serviços.</p>

          <div className="auth-switch">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={authMode === "register" ? "active" : ""}
              onClick={() => setAuthMode("register")}
            >
              Cadastro
            </button>
          </div>

          <form className="form" onSubmit={handleAuthSubmit}>
            <label>
              E-mail
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="voce@clinica.com"
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="********"
                minLength={6}
                required
              />
            </label>

            {authError ? <p className="error-text">{authError}</p> : null}

            <button className="primary-btn" type="submit">
              {authMode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page app-page">
      <header className="topbar">
        <div>
          <h2>Clínica Estética</h2>
          <p>Olá, {formattedUserName}</p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => signOut(auth)}>
          Sair
        </button>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={activeTab === TABS.AGENDA ? "active" : ""}
          onClick={() => setActiveTab(TABS.AGENDA)}
        >
          Agenda
        </button>
        <button
          type="button"
          className={activeTab === TABS.CLIENTES ? "active" : ""}
          onClick={() => setActiveTab(TABS.CLIENTES)}
        >
          Clientes
        </button>
        <button
          type="button"
          className={activeTab === TABS.SERVICOS ? "active" : ""}
          onClick={() => setActiveTab(TABS.SERVICOS)}
        >
          Serviços
        </button>
      </nav>

      {activeTab === TABS.AGENDA ? (
        <section className="card">
          <h3>Agenda</h3>
          <form className="form grid-form" onSubmit={handleAddAppointment}>
            <label>
              Cliente
              <input
                value={appointmentClient}
                onChange={(event) => setAppointmentClient(event.target.value)}
                placeholder="Nome da cliente"
                required
              />
            </label>
            <label>
              Serviço
              <input
                value={appointmentService}
                onChange={(event) => setAppointmentService(event.target.value)}
                placeholder="Serviço"
                required
              />
            </label>
            <label>
              Data
              <input
                type="date"
                value={appointmentDate}
                onChange={(event) => setAppointmentDate(event.target.value)}
                required
              />
            </label>
            <label>
              Horário
              <input
                type="time"
                value={appointmentTime}
                onChange={(event) => setAppointmentTime(event.target.value)}
              />
            </label>
            <label className="full-row">
              Observações
              <input
                value={appointmentNotes}
                onChange={(event) => setAppointmentNotes(event.target.value)}
                placeholder="Opcional"
              />
            </label>
            <button className="primary-btn full-row" type="submit">
              Adicionar horário
            </button>
          </form>

          <ul className="list">
            {appointments.length === 0 ? (
              <li className="empty">Nenhum horário cadastrado.</li>
            ) : (
              appointments.map((appointment) => (
                <li key={appointment.id}>
                  <div>
                    <strong>{appointment.client}</strong> - {appointment.service}
                    <p>
                      {appointment.date} {appointment.time ? `às ${appointment.time}` : ""}
                    </p>
                    {appointment.notes ? <p>{appointment.notes}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => handleDeleteByCollection("appointments", appointment.id)}
                  >
                    Excluir
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {activeTab === TABS.CLIENTES ? (
        <section className="card">
          <div className="section-header">
            <h3>Clientes</h3>
            <button type="button" className="primary-btn" onClick={handleStartCreateClient}>
              Nova cliente
            </button>
          </div>

          {clientFormMessage ? <p className="success-text">{clientFormMessage}</p> : null}

          <ul className="list">
            {clients.length === 0 ? (
              <li className="empty">Nenhuma cliente cadastrada.</li>
            ) : (
              clients.map((client) => (
                <li key={client.id} className="client-card">
                  <button
                    type="button"
                    className="client-menu-trigger"
                    aria-label={`Abrir opções de ${client.name}`}
                    onClick={() => handleToggleClientMenu(client.id)}
                  >
                    ☰
                  </button>
                  {openClientMenuId === client.id ? (
                    <div className="client-menu-dropdown">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => handleEditClient(client)}
                      >
                        Editar cadastro
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => {
                          setOpenClientMenuId("");
                          handleDeleteByCollection("clients", client.id);
                        }}
                      >
                        Excluir cliente
                      </button>
                    </div>
                  ) : null}

                  <div className="client-card-content">
                    <div>
                      <strong>{client.name}</strong>
                      <p>{client.phone || "Sem telefone"}</p>
                      {client.email ? <p>{client.email}</p> : null}
                      {client.birthDate ? <p>Nascimento: {formatDatePt(client.birthDate)}</p> : null}
                      {client.sex ? <p>Sexo: {formatSexLabel(client.sex)}</p> : null}
                    </div>
                    <div className="client-tab-actions" role="tablist" aria-label={`Abrir prontuário de ${client.name}`}>
                      <button
                        type="button"
                        className={
                          selectedClientId === client.id && isAnamneseViewOpen
                            ? "client-tab-btn active"
                            : "client-tab-btn"
                        }
                        onClick={() => handleOpenClientView(client.id, CLIENT_VIEWS.ANAMNESE)}
                      >
                        Anamnese
                      </button>
                      <button
                        type="button"
                        className={
                          selectedClientId === client.id && isFollowupViewOpen
                            ? "client-tab-btn active"
                            : "client-tab-btn"
                        }
                        onClick={() => handleOpenClientView(client.id, CLIENT_VIEWS.FOLLOWUP)}
                      >
                        Acompanhamentos
                      </button>
                      <button
                        type="button"
                        className={
                          selectedClientId === client.id && isChartsViewOpen
                            ? "client-tab-btn active"
                            : "client-tab-btn"
                        }
                        onClick={() => handleOpenClientView(client.id, CLIENT_VIEWS.CHARTS)}
                      >
                        Gráficos
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>

          {isClientFormOpen ? (
            <section className="client-form-panel">
              <h4>{editingClientId ? "Editar cadastro da cliente" : "Adicionar nova cliente"}</h4>
              <form className="form grid-form" onSubmit={handleSaveClient}>
                <label>
                  Nome
                  <input
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="Nome completo"
                    required
                  />
                </label>
                <label>
                  Telefone
                  <input
                    value={clientPhone}
                    onChange={(event) => setClientPhone(event.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </label>
                <label>
                  E-mail
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                    placeholder="cliente@email.com"
                  />
                </label>
                <label>
                  Data de nascimento
                  <input
                    type="date"
                    value={clientBirthDate}
                    onChange={(event) => setClientBirthDate(event.target.value)}
                  />
                </label>
                <label>
                  Sexo
                  <select value={clientSex} onChange={(event) => setClientSex(event.target.value)}>
                    {SEX_OPTIONS.map((option) => (
                      <option key={option.value || "empty"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full-row">
                  Endereço
                  <input
                    value={clientAddress}
                    onChange={(event) => setClientAddress(event.target.value)}
                    placeholder="Rua, número, bairro e cidade"
                  />
                </label>

                <button className="primary-btn full-row" type="submit">
                  {editingClientId ? "Salvar alterações da cliente" : "Adicionar cliente"}
                </button>
                <button
                  type="button"
                  className="secondary-btn full-row"
                  onClick={resetClientForm}
                >
                  Cancelar
                </button>
              </form>
            </section>
          ) : null}

          {selectedClient && selectedClientView ? (
            <div className="client-modal-backdrop" onClick={handleCloseClientView}>
              <section
                className="client-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`Prontuário de ${selectedClient.name}`}
                onClick={(event) => event.stopPropagation()}
              >
                <header className="client-modal-header">
                  <div>
                    <h4>{selectedClient.name}</h4>
                    <p>Prontuário da cliente</p>
                  </div>
                  <button type="button" className="secondary-btn" onClick={handleCloseClientView}>
                    Fechar
                  </button>
                </header>
                <div className="client-modal-tabs" role="tablist" aria-label="Abas do prontuário">
                  <button
                    type="button"
                    className={isAnamneseViewOpen ? "client-modal-tab active" : "client-modal-tab"}
                    onClick={() => setSelectedClientView(CLIENT_VIEWS.ANAMNESE)}
                  >
                    Anamnese
                  </button>
                  <button
                    type="button"
                    className={isFollowupViewOpen ? "client-modal-tab active" : "client-modal-tab"}
                    onClick={() => setSelectedClientView(CLIENT_VIEWS.FOLLOWUP)}
                  >
                    Acompanhamentos
                  </button>
                  <button
                    type="button"
                    className={isChartsViewOpen ? "client-modal-tab active" : "client-modal-tab"}
                    onClick={() => setSelectedClientView(CLIENT_VIEWS.CHARTS)}
                  >
                    Gráficos
                  </button>
                </div>
                <div className="client-modal-content">
              {isAnamneseViewOpen ? (
                <section className="anamnese-panel">
                  <div className="panel-header">
                    <div>
                      <h4>Ficha de Anamnese - {selectedClient.name}</h4>
                      <p>Dados pessoais ficam no cadastro da cliente e são fixos.</p>
                      {!isEditingAnamnese ? (
                        <p className="muted-text">Modo visualização ativado (somente leitura).</p>
                      ) : null}
                    </div>
                    <div className="inline-actions">
                      <button type="button" className="secondary-btn" onClick={handleExportAnamnesePdf}>
                        Exportar PDF
                      </button>
                      {clientHasAnamnese && !isEditingAnamnese ? (
                        <button type="button" className="secondary-btn" onClick={handleStartEditAnamnese}>
                          Editar ficha
                        </button>
                      ) : null}
                      {clientHasAnamnese && isEditingAnamnese ? (
                        <button type="button" className="secondary-btn" onClick={handleCancelEditAnamnese}>
                          Cancelar edição
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <form className="form" onSubmit={handleSaveAnamnese}>
                    <fieldset className="anamnese-fieldset" disabled={!isEditingAnamnese}>
                <h5>Círculo das dores principais</h5>
                <PainMapSelector
                  painSelections={anamneseForm.painSelections}
                  onSelectRegion={handleUpsertPainSelection}
                  onRemoveRegion={handleRemovePainSelection}
                  isEditable={isEditingAnamnese}
                />

                <h5>Perguntas-chave</h5>
                <div className="form">
                  <div className="question-block">
                    <p className="question-title">
                      A dor está em ponto específico ou irradia para outra área?
                    </p>
                    <div className="option-row">
                      {PAIN_RADIATION_OPTIONS.map((option) => (
                        <label key={option.value} className="checkbox-field">
                          <input
                            type="radio"
                            name="pain-radiation"
                            checked={anamneseForm.painRadiatesOption === option.value}
                            onChange={() =>
                              handleAnamneseFieldChange("painRadiatesOption", option.value)
                            }
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label>
                    Detalhes sobre localização/irradiação
                    <textarea
                      value={anamneseForm.painRadiatesDetails}
                      onChange={(event) =>
                        handleAnamneseFieldChange("painRadiatesDetails", event.target.value)
                      }
                      placeholder="Descreva com mais detalhes, se necessário."
                    />
                  </label>
                  <label>
                    Quando percebeu esse incômodo pela primeira vez?
                    <textarea
                      value={anamneseForm.firstPainEpisode}
                      onChange={(event) => handleAnamneseFieldChange("firstPainEpisode", event.target.value)}
                    />
                  </label>
                  <div className="question-block">
                    <p className="question-title">
                      Tipo de dor (queimação, fisgada, pontada, constante)?
                    </p>
                    <div className="checkbox-grid">
                      {PAIN_TYPE_OPTIONS.map((option) => (
                        <label key={option} className="checkbox-field">
                          <input
                            type="checkbox"
                            checked={anamneseForm.painTypeOptions.includes(option)}
                            onChange={() => toggleArrayValue("painTypeOptions", option)}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label>
                    Outro tipo de dor
                    <input
                      value={anamneseForm.painTypeOther}
                      onChange={(event) =>
                        handleAnamneseFieldChange("painTypeOther", event.target.value)
                      }
                      placeholder="Opcional"
                    />
                  </label>
                  <div className="question-block">
                    <p className="question-title">Em quais situações sente mais dor?</p>
                    <div className="checkbox-grid">
                      {PAIN_TRIGGER_OPTIONS.map((option) => (
                        <label key={option} className="checkbox-field">
                          <input
                            type="checkbox"
                            checked={anamneseForm.painTriggerOptions.includes(option)}
                            onChange={() => toggleArrayValue("painTriggerOptions", option)}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label>
                    Outra situação que piora a dor
                    <input
                      value={anamneseForm.painTriggerOther}
                      onChange={(event) =>
                        handleAnamneseFieldChange("painTriggerOther", event.target.value)
                      }
                      placeholder="Opcional"
                    />
                  </label>
                  <label>
                    Intensidade da dor (0 a 10)
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={anamneseForm.painScale}
                      onChange={(event) => handleAnamneseFieldChange("painScale", event.target.value)}
                    />
                  </label>
                  <div className="question-block">
                    <p className="question-title">
                      Busca mais relaxamento geral ou foco em tensão específica?
                    </p>
                    <div className="option-row">
                      {GOAL_OPTIONS.map((option) => (
                        <label key={option.value} className="checkbox-field">
                          <input
                            type="radio"
                            name="goal-option"
                            checked={anamneseForm.goalOption === option.value}
                            onChange={() => handleAnamneseFieldChange("goalOption", option.value)}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label>
                    Detalhes do objetivo
                    <textarea
                      value={anamneseForm.goalDetails}
                      onChange={(event) =>
                        handleAnamneseFieldChange("goalDetails", event.target.value)
                      }
                      placeholder="Opcional"
                    />
                  </label>
                  <div className="question-block">
                    <p className="question-title">Pratica esporte? Qual?</p>
                    <div className="option-row">
                      <label className="checkbox-field">
                        <input
                          type="radio"
                          name="plays-sport"
                          checked={anamneseForm.playsSport === "yes"}
                          onChange={() => handleAnamneseFieldChange("playsSport", "yes")}
                        />
                        Sim
                      </label>
                      <label className="checkbox-field">
                        <input
                          type="radio"
                          name="plays-sport"
                          checked={anamneseForm.playsSport === "no"}
                          onChange={() => handleAnamneseFieldChange("playsSport", "no")}
                        />
                        Não
                      </label>
                    </div>
                  </div>
                  {anamneseForm.playsSport === "yes" ? (
                    <>
                      <div className="question-block">
                        <p className="question-title">Quais esportes?</p>
                        <div className="checkbox-grid">
                          {SPORT_OPTIONS.map((option) => (
                            <label key={option} className="checkbox-field">
                              <input
                                type="checkbox"
                                checked={anamneseForm.sportOptions.includes(option)}
                                onChange={() => toggleArrayValue("sportOptions", option)}
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </div>
                      <label>
                        Outro esporte
                        <input
                          value={anamneseForm.sportOther}
                          onChange={(event) =>
                            handleAnamneseFieldChange("sportOther", event.target.value)
                          }
                          placeholder="Opcional"
                        />
                      </label>
                    </>
                  ) : null}
                  <div className="question-block">
                    <p className="question-title">Fez outro tratamento/massagem?</p>
                    <div className="option-row">
                      <label className="checkbox-field">
                        <input
                          type="radio"
                          name="previous-treatment"
                          checked={anamneseForm.hadPreviousTreatment === "yes"}
                          onChange={() =>
                            handleAnamneseFieldChange("hadPreviousTreatment", "yes")
                          }
                        />
                        Sim
                      </label>
                      <label className="checkbox-field">
                        <input
                          type="radio"
                          name="previous-treatment"
                          checked={anamneseForm.hadPreviousTreatment === "no"}
                          onChange={() =>
                            handleAnamneseFieldChange("hadPreviousTreatment", "no")
                          }
                        />
                        Não
                      </label>
                    </div>
                  </div>
                  {anamneseForm.hadPreviousTreatment === "yes" ? (
                    <div className="question-block">
                      <p className="question-title">Quais tratamentos já realizou?</p>
                      <div className="checkbox-grid">
                        {PREVIOUS_TREATMENT_OPTIONS.map((option) => (
                          <label key={option} className="checkbox-field">
                            <input
                              type="checkbox"
                              checked={anamneseForm.previousTreatmentTypes.includes(option)}
                              onChange={() =>
                                toggleArrayValue("previousTreatmentTypes", option)
                              }
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <label>
                    Como foi a experiência em tratamentos anteriores?
                    <textarea
                      value={anamneseForm.previousTreatmentExperience}
                      onChange={(event) =>
                        handleAnamneseFieldChange("previousTreatmentExperience", event.target.value)
                      }
                      placeholder="Opcional"
                    />
                  </label>
                  <div className="question-block">
                    <p className="question-title">Objetivos estéticos com a massagem</p>
                    <div className="checkbox-grid">
                      {AESTHETIC_GOAL_OPTIONS.map((option) => (
                        <label key={option} className="checkbox-field">
                          <input
                            type="checkbox"
                            checked={anamneseForm.aestheticGoalOptions.includes(option)}
                            onChange={() => toggleArrayValue("aestheticGoalOptions", option)}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label>
                    Outro objetivo estético
                    <input
                      value={anamneseForm.aestheticGoalsOther}
                      onChange={(event) =>
                        handleAnamneseFieldChange("aestheticGoalsOther", event.target.value)
                      }
                      placeholder="Opcional"
                    />
                  </label>
                  <div className="question-block">
                    <p className="question-title">
                      Hábitos/atividades que podem estar contribuindo para dor
                    </p>
                    <div className="checkbox-grid">
                      {HABIT_OPTIONS.map((option) => (
                        <label key={option} className="checkbox-field">
                          <input
                            type="checkbox"
                            checked={anamneseForm.habitOptions.includes(option)}
                            onChange={() => toggleArrayValue("habitOptions", option)}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label>
                    Outros hábitos/atividades
                    <textarea
                      value={anamneseForm.habitsContributingOther}
                      onChange={(event) =>
                        handleAnamneseFieldChange("habitsContributingOther", event.target.value)
                      }
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                <h5>Condições de saúde</h5>
                <div className="checkbox-grid">
                  {HEALTH_CONDITIONS.map((condition) => (
                    <label key={condition} className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={anamneseForm.healthConditions.includes(condition)}
                        onChange={() => toggleArrayValue("healthConditions", condition)}
                      />
                      {condition}
                    </label>
                  ))}
                </div>
                <label>
                  Outras observações de saúde
                  <textarea
                    value={anamneseForm.healthOther}
                    onChange={(event) => handleAnamneseFieldChange("healthOther", event.target.value)}
                  />
                </label>

                {selectedClient.sex === "female" ? (
                  <>
                    <h5>Para mulheres</h5>
                    <div className="grid-form">
                      <label>
                        Período menstrual
                        <input
                          value={anamneseForm.menstrualPeriod}
                          onChange={(event) =>
                            handleAnamneseFieldChange("menstrualPeriod", event.target.value)
                          }
                          placeholder="Regular, irregular, etc."
                        />
                      </label>
                      <label>
                        Gestante?
                        <select
                          value={anamneseForm.pregnant}
                          onChange={(event) => handleAnamneseFieldChange("pregnant", event.target.value)}
                        >
                          <option value="">Selecionar</option>
                          <option value="sim">Sim</option>
                          <option value="nao">Não</option>
                        </select>
                      </label>
                      <label>
                        Tempo de gestação (se aplicável)
                        <input
                          value={anamneseForm.gestatingTime}
                          onChange={(event) =>
                            handleAnamneseFieldChange("gestatingTime", event.target.value)
                          }
                          placeholder="Ex: 24 semanas"
                        />
                      </label>
                      <label>
                        Lactante?
                        <select
                          value={anamneseForm.lactating}
                          onChange={(event) => handleAnamneseFieldChange("lactating", event.target.value)}
                        >
                          <option value="">Selecionar</option>
                          <option value="sim">Sim</option>
                          <option value="nao">Não</option>
                        </select>
                      </label>
                    </div>
                  </>
                ) : null}

                <h5>Conclusão da ficha</h5>
                <label>
                  Qual área do corpo gostaria de mais atenção?
                  <textarea
                    value={anamneseForm.bodyFocus}
                    onChange={(event) => handleAnamneseFieldChange("bodyFocus", event.target.value)}
                  />
                </label>
                <label>
                  Observações gerais
                  <textarea
                    value={anamneseForm.observations}
                    onChange={(event) => handleAnamneseFieldChange("observations", event.target.value)}
                  />
                </label>
                <label>
                  Assinatura (nome digitado)
                  <input
                    value={anamneseForm.signatureName}
                    onChange={(event) => handleAnamneseFieldChange("signatureName", event.target.value)}
                    placeholder="Nome completo da cliente"
                  />
                </label>

                    </fieldset>

                    {anamneseMessage ? <p className="success-text">{anamneseMessage}</p> : null}
                    {isEditingAnamnese ? (
                      <button className="primary-btn" type="submit">
                        {clientHasAnamnese ? "Salvar edição da ficha" : "Salvar ficha de anamnese"}
                      </button>
                    ) : null}
                  </form>
                </section>
              ) : null}

              {isFollowupViewOpen ? (
                <section className="followup-panel">
                  <div className="panel-header">
                    <div>
                      <h4>Acompanhamento - {selectedClient.name}</h4>
                      <p>
                        Histórico de atendimentos independente da anamnese.
                      </p>
                    </div>
                  </div>

                  <form className="form grid-form" onSubmit={handleAddCheckpoint}>
                    <label>
                      Data do atendimento
                      <input
                        type="date"
                        value={checkpointForm.date}
                        onChange={(event) => handleCheckpointFieldChange("date", event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Sessão nº
                      <input
                        value={checkpointForm.sessionNumber}
                        readOnly
                        placeholder="Auto"
                      />
                    </label>
                    <label>
                      Tipo de atendimento
                      <select
                        value={checkpointForm.sessionType}
                        onChange={(event) => handleCheckpointFieldChange("sessionType", event.target.value)}
                      >
                        <option value="">Selecionar</option>
                        {SESSION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Dor (0-10)
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={checkpointForm.painLevel}
                        onChange={(event) => handleCheckpointFieldChange("painLevel", event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Estresse/Tensão (0-10)
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={checkpointForm.stressLevel}
                        onChange={(event) => handleCheckpointFieldChange("stressLevel", event.target.value)}
                      />
                    </label>
                    <label>
                      Sono (horas)
                      <input
                        type="number"
                        min="0"
                        max="12"
                        step="0.5"
                        value={checkpointForm.sleepHours}
                        onChange={(event) => handleCheckpointFieldChange("sleepHours", event.target.value)}
                      />
                    </label>
                    <label className="full-row">
                      Observações da sessão
                      <textarea
                        value={checkpointForm.observations}
                        onChange={(event) => handleCheckpointFieldChange("observations", event.target.value)}
                      />
                    </label>
                    <button className="primary-btn full-row" type="submit">
                      Registrar evolução
                    </button>
                  </form>

                  <ul className="list">
                    {checkpoints.length === 0 ? (
                      <li className="empty">Sem sessões registradas para acompanhamento.</li>
                    ) : (
                      checkpoints.map((checkpoint) => (
                        <li key={checkpoint.id}>
                          <div>
                            <strong>
                              {formatDatePt(checkpoint.date)}
                              {checkpoint.sessionNumber ? ` - Sessão ${checkpoint.sessionNumber}` : ""}
                            </strong>
                            <p>
                              Tipo: {checkpoint.sessionType || "Não informado"} | Dor: {checkpoint.painLevel ?? 0} |
                              Estresse: {checkpoint.stressLevel ?? 0} | Sono: {checkpoint.sleepHours ?? 0}h
                            </p>
                            {checkpoint.observations ? <p>{checkpoint.observations}</p> : null}
                          </div>
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() => handleDeleteCheckpoint(checkpoint.id)}
                          >
                            Excluir
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </section>
              ) : null}

              {isChartsViewOpen ? (
                <section className="followup-panel">
                  <div className="panel-header">
                    <div>
                      <h4>Gráficos de Evolução - {selectedClient.name}</h4>
                      <p>Visualização da evolução com base no histórico dos atendimentos.</p>
                    </div>
                  </div>
                  <div className="charts-grid">
                    <ProgressLineChart
                      title="Evolução da dor x estresse"
                      points={checkpointChartData}
                      firstMetric={{ field: "painLevel", label: "Dor" }}
                      secondMetric={{ field: "stressLevel", label: "Estresse" }}
                      maxValue={10}
                    />
                    <SleepBarChart points={checkpointChartData} />
                    <WellnessScoreChart
                      points={checkpointChartData}
                      className="chart-card-span-2"
                    />
                    <SessionTypeDistributionChart points={checkpointChartData} />
                    <InitialVsCurrentChart points={checkpointChartData} />
                  </div>
                </section>
              ) : null}
                </div>
              </section>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === TABS.SERVICOS ? (
        <section className="card">
          <h3>Serviços</h3>
          <form className="form" onSubmit={handleAddService}>
            <label>
              Nome do serviço
              <input
                value={serviceTitle}
                onChange={(event) => setServiceTitle(event.target.value)}
                placeholder="Ex: Limpeza de pele"
                required
              />
            </label>
            <label>
              Preço (R$)
              <input
                type="number"
                min="0"
                step="0.01"
                value={servicePrice}
                onChange={(event) => setServicePrice(event.target.value)}
                placeholder="0,00"
              />
            </label>
            <button className="primary-btn" type="submit">
              Adicionar serviço
            </button>
          </form>

          <ul className="list">
            {services.length === 0 ? (
              <li className="empty">Nenhum serviço cadastrado.</li>
            ) : (
              services.map((service) => (
                <li key={service.id}>
                  <div>
                    <strong>{service.title}</strong>
                    <p>R$ {Number(service.price || 0).toFixed(2)}</p>
                  </div>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => handleDeleteByCollection("services", service.id)}
                  >
                    Excluir
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
