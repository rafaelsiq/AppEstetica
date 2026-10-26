import { useEffect, useMemo, useRef, useState } from "react";
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
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { auth, db } from "./firebase";
import ModalClose from "./ModalClose";
import { phoneKey } from "./clientQuiz";
import { applyClinicIcon } from "./pageIcon";
import NotificationLists from "./NotificationLists.jsx";
import ClinicNoticeRunner from "./ClinicNoticeRunner";
import { createFirstContactLink, createShareLink, importFirstContactRequest, importSubmittedLink, isClientFeedback, sanitizeLogoDataUrl, shareUrl, syncClinicLogo, syncEvolutionInstagram, updateEvolutionLink } from "./shareLinks";
import { EVOLUTION_HIGHLIGHT_LIMIT, EVOLUTION_TEXT_LIMIT, sanitizeEvolutionStory, wellnessScore } from "./evolutionStory";
import {
  appointmentAgendaDate,
  approvalMessage,
  formatPhoneBr,
  readMaskedPhone,
  periodLabel,
  refusalMessage,
  rescheduleMessage,
  shareWhatsAppMessage,
  whatsAppUrl
} from "./firstContact";
import { consentDecisionLabel, consentSummary } from "./imageConsent";
import {
  buildAvailability,
  closureApplies,
  closureLabel,
  closedPeriods,
  isDayClosed,
  localTodayIso,
  MAX_CLOSURES,
  minutesOf,
  normalizeClosure
} from "./agendaOff";
import { publishAgendaAvailability } from "./agendaAvailability";
import {
  checkpointParameterSummary,
  emptyParameterForm,
  formatParameterValue,
  normalizeParameter,
  normalizeReadings,
  parameterSeries,
  readingsFromForm,
  validateParameter
} from "./trackingParameters";

const TABS = {
  INICIO: "inicio",
  AGENDA: "agenda",
  CLIENTES: "clientes",
  SERVICOS: "servicos",
  AVISOS: "avisos"
};

const UNDETERMINED_SERVICE_LABEL = "Serviço indeterminado";

const CLIENT_VIEWS = {
  ANAMNESE: "anamnese",
  FOLLOWUP: "followup",
  CHARTS: "charts",
  TERMS: "terms"
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

const CLIENT_SORT_OPTIONS = [
  { value: "name_asc", label: "Nome (A–Z)" },
  { value: "name_desc", label: "Nome (Z–A)" },
  { value: "last_appointment_desc", label: "Último atendimento (mais recente)" },
  { value: "last_appointment_asc", label: "Último atendimento (mais antigo)" },
  { value: "updated_desc", label: "Atualização mais recente" },
  { value: "updated_asc", label: "Atualização mais antiga" }
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
const PHOTO_POSITION_OPTIONS = ["Frente", "Costas", "Perfil esquerdo", "Perfil direito"];
const PHOTO_POSITION_OTHER = "Outra posição";
const MEASUREMENT_COLORS = ["#24695c", "#c06b19", "#3a5ac7", "#9b3d6b", "#1f7a8c", "#6b4c9a"];

const NAV_ITEMS = [
  { tab: TABS.INICIO, label: "Início" },
  { tab: TABS.AGENDA, label: "Agenda" },
  { tab: TABS.CLIENTES, label: "Clientes" },
  { tab: TABS.SERVICOS, label: "Serviços" },
  { tab: TABS.AVISOS, label: "Avisos" }
];

function NavIcon({ tab }) {
  if (tab === TABS.AGENDA) {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3.5v3M16 3.5v3M4 9.5h16" />
      </svg>
    );
  }
  if (tab === TABS.CLIENTES) {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="9" r="3.2" />
        <path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
        <circle cx="17" cy="9.5" r="2.4" />
        <path d="M16 14.6c2.3 0 4 1.3 4.6 3.9" />
      </svg>
    );
  }
  if (tab === TABS.SERVICOS) {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8z" />
        <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      </svg>
    );
  }
  if (tab === TABS.AVISOS) {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9.5a6 6 0 1 1 12 0c0 4 1.5 5.2 1.5 5.2H4.5S6 13.5 6 9.5Z" />
        <path d="M10 18.5a2 2 0 0 0 4 0" />
      </svg>
    );
  }
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M7 10.5V20h10v-9.5" />
    </svg>
  );
}

function nameInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function appointmentStatusInfo(appointment) {
  if (appointment?.status === "pendente") {
    return { label: "Aguardando aprovação", tone: "waiting" };
  }
  if (appointment?.status === "remarcacao") {
    return { label: "Aguardando confirmação", tone: "waiting" };
  }
  if (appointment?.status === "recusado") {
    return { label: "Recusado", tone: "refused" };
  }
  return { label: "Confirmado", tone: "confirmed" };
}

function AppointmentStatusTag({ appointment, compact = false }) {
  const info = appointmentStatusInfo(appointment);
  const label = !compact
    ? info.label
    : info.tone === "waiting"
      ? "Aguardando"
      : info.tone === "refused"
        ? "Recusado"
        : "Confirmado";
  return <span className={`status-tag is-${info.tone}`}>{label}</span>;
}

function shortClientName(name) {
  const parts = String(name || "").split(" ").filter(Boolean);
  if (parts.length < 2) {
    return parts[0] || "";
  }
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

function formatPainChip(selection) {
  const laterality = selection.laterality === "left"
    ? "esquerdo"
    : selection.laterality === "right"
      ? "direito"
      : "centro";
  return `${selection.label} · ${laterality}`;
}

function formatTimestampDate(value) {
  const millis = getTimestampMillis(value);
  if (!millis) {
    return "";
  }
  return new Date(millis).toLocaleDateString("pt-BR");
}

function formatConsentStamp(value) {
  const millis = getTimestampMillis(value);
  if (!millis) {
    return "";
  }
  const date = new Date(millis);
  const day = date.toLocaleDateString("pt-BR");
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} às ${time}`;
}

function formatDayMonthStamp(value) {
  const millis = getTimestampMillis(value);
  if (!millis) {
    return "";
  }
  const date = new Date(millis);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function OtherDetail({ value, onChange, label }) {
  const [open, setOpen] = useState(Boolean(String(value || "").trim()));

  useEffect(() => {
    if (String(value || "").trim()) {
      setOpen(true);
    }
  }, [value]);

  if (!open) {
    return (
      <button type="button" className="choice-pill is-dashed" onClick={() => setOpen(true)}>
        + {label}
      </button>
    );
  }

  return (
    <input
      className="choice-other-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={label}
      aria-label={label}
    />
  );
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

function normalizeFileName(value) {
  return String(value || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
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
    painLevel: "0",
    stressLevel: "0",
    sleepHours: "",
    observations: "",
    parameterValues: {}
  };
}

function getNextSessionNumber(items) {
  const sessions = items.filter((item) => !isClientFeedback(item));
  const numericSessionNumbers = sessions
    .map((item) => Number(item.sessionNumber))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (numericSessionNumbers.length > 0) {
    return Math.max(...numericSessionNumbers) + 1;
  }
  return sessions.length + 1;
}

function ScaleChoice({ label, hint, value, onChange }) {
  const selected = Math.min(10, Math.max(0, Number(value) || 0));
  return (
    <div className="scale-choice">
      <div className="scale-choice-label">
        <span>{label}</span>
        <span>{hint}</span>
      </div>
      <div className="scale-choice-row" role="radiogroup" aria-label={label}>
        {Array.from({ length: 11 }, (_, level) => (
          <button
            key={level}
            type="button"
            className={selected === level ? "is-selected" : ""}
            aria-pressed={selected === level}
            onClick={() => onChange(String(level))}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

function buildEmptyPhotoAnalysis() {
  return {
    date: getTodayISODate(),
    positionLabel: "",
    positionCustom: "",
    notes: "",
    imageDataUrl: "",
    measurements: [],
    activeMeasurementType: "line",
    activePoints: []
  };
}

function getMeasurementPointLabel(index) {
  return ["A", "B", "C"][index] || `P${index + 1}`;
}

function normalizeMeasurementPoints(rawPoints, measurementType = "line") {
  if (!Array.isArray(rawPoints)) {
    return [];
  }
  const maxPoints = measurementType === "angle" ? 3 : 2;
  return rawPoints
    .slice(0, maxPoints)
    .map((point, index) => {
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      return {
        label: getMeasurementPointLabel(index),
        x: Number(Math.min(100, Math.max(0, x)).toFixed(2)),
        y: Number(Math.min(100, Math.max(0, y)).toFixed(2))
      };
    })
    .filter(Boolean);
}

function getLineDistancePercent(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }
  const [a, b] = points;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getAngleDegrees(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return null;
  }
  const [a, b, c] = points;
  const baX = a.x - b.x;
  const baY = a.y - b.y;
  const bcX = c.x - b.x;
  const bcY = c.y - b.y;
  const baLength = Math.sqrt(baX * baX + baY * baY);
  const bcLength = Math.sqrt(bcX * bcX + bcY * bcY);
  if (baLength === 0 || bcLength === 0) {
    return null;
  }
  const cosTheta = Math.min(1, Math.max(-1, (baX * bcX + baY * bcY) / (baLength * bcLength)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

function createMeasurementId() {
  return `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getRequiredMeasurementPoints(measurementType) {
  return measurementType === "angle" ? 3 : 2;
}

function buildMeasurement(measurementType, rawPoints) {
  const type = measurementType === "angle" ? "angle" : "line";
  const points = normalizeMeasurementPoints(rawPoints, type);
  if (points.length < getRequiredMeasurementPoints(type)) {
    return null;
  }
  const lineDistancePercent = type === "line" ? getLineDistancePercent(points) : null;
  const angleDegrees = type === "angle" ? getAngleDegrees(points) : null;
  return {
    id: createMeasurementId(),
    type,
    points,
    lineDistancePercent: lineDistancePercent === null ? null : Number(lineDistancePercent.toFixed(2)),
    angleDegrees: angleDegrees === null ? null : Number(angleDegrees.toFixed(2))
  };
}

function getStoredMeasurements(analysis) {
  if (Array.isArray(analysis?.measurements) && analysis.measurements.length > 0) {
    return analysis.measurements
      .map((item) => {
        const type = item?.type === "angle" || item?.measurementType === "angle" ? "angle" : "line";
        const points = normalizeMeasurementPoints(item?.points, type);
        if (points.length < getRequiredMeasurementPoints(type)) {
          return null;
        }
        const fallbackLine = type === "line" ? getLineDistancePercent(points) : null;
        const fallbackAngle = type === "angle" ? getAngleDegrees(points) : null;
        const lineDistancePercent = Number.isFinite(Number(item?.lineDistancePercent))
          ? Number(item.lineDistancePercent)
          : fallbackLine;
        const angleDegrees = Number.isFinite(Number(item?.angleDegrees))
          ? Number(item.angleDegrees)
          : fallbackAngle;
        return {
          id: item?.id || createMeasurementId(),
          type,
          points,
          lineDistancePercent:
            lineDistancePercent === null ? null : Number(Number(lineDistancePercent).toFixed(2)),
          angleDegrees: angleDegrees === null ? null : Number(Number(angleDegrees).toFixed(2))
        };
      })
      .filter(Boolean);
  }

  if (analysis?.measurementType && Array.isArray(analysis?.points)) {
    const measurement = buildMeasurement(analysis.measurementType, analysis.points);
    if (!measurement) {
      return [];
    }
    return [
      {
        ...measurement,
        lineDistancePercent: Number.isFinite(Number(analysis.lineDistancePercent))
          ? Number(analysis.lineDistancePercent)
          : measurement.lineDistancePercent,
        angleDegrees: Number.isFinite(Number(analysis.angleDegrees))
          ? Number(analysis.angleDegrees)
          : measurement.angleDegrees
      }
    ];
  }

  return [];
}

function isCustomPhotoPosition(positionLabel) {
  return positionLabel === PHOTO_POSITION_OTHER || positionLabel === "Outro";
}

function resolvePhotoPositionLabel(positionLabel, positionCustom) {
  if (isCustomPhotoPosition(positionLabel)) {
    return positionCustom.trim();
  }
  return positionLabel.trim();
}

function formatMeasureNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return numeric.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function formatMeasurementValue(measurement) {
  if (measurement.type === "angle") {
    return `Ângulo ${formatMeasureNumber(measurement.angleDegrees)}°`;
  }
  return `Linha ${formatMeasureNumber(measurement.lineDistancePercent)}%`;
}

function measurementKindLabel(measurement) {
  return measurement?.type === "angle" ? "Ângulo A–B–C" : "Linha A–B";
}

function measurementBadgeText(measurement) {
  if (measurement?.type === "angle") {
    return `${formatMeasureNumber(measurement.angleDegrees)}°`;
  }
  return `${formatMeasureNumber(measurement.lineDistancePercent)}%`;
}

function measurementBadgePosition(measurement) {
  const points = measurement?.points || [];
  if (measurement?.type === "angle" && points[1]) {
    return {
      x: Number(points[1].x),
      y: Math.max(8, Number(points[1].y) - 8)
    };
  }
  if (points.length >= 2) {
    return {
      x: (Number(points[0].x) + Number(points[1].x)) / 2,
      y: (Number(points[0].y) + Number(points[1].y)) / 2
    };
  }
  return null;
}

function photoDraftHasProgress(form) {
  return Boolean(
    form?.imageDataUrl ||
      form?.activePoints?.length ||
      form?.measurements?.length ||
      form?.positionLabel ||
      form?.positionCustom ||
      String(form?.notes || "").trim()
  );
}

function buildPhotoDraft(photoForm) {
  if (!photoForm.imageDataUrl) {
    return { error: "Adicione uma foto para incluir neste acompanhamento." };
  }
  const positionLabel = resolvePhotoPositionLabel(photoForm.positionLabel, photoForm.positionCustom);
  if (!positionLabel) {
    return {
      error: isCustomPhotoPosition(photoForm.positionLabel)
        ? "Escreva qual foi a posição da foto."
        : "Selecione a posição da foto."
    };
  }
  const requiredPoints = getRequiredMeasurementPoints(photoForm.activeMeasurementType);
  if (photoForm.activePoints.length > 0 && photoForm.activePoints.length < requiredPoints) {
    return { error: "Termine a medição atual ou desfaça os pontos antes de continuar." };
  }
  const draftMeasurement = buildMeasurement(photoForm.activeMeasurementType, photoForm.activePoints);
  const measurements = draftMeasurement
    ? [...photoForm.measurements, draftMeasurement]
    : photoForm.measurements;
  if (measurements.length === 0) {
    return { error: "Inclua pelo menos uma medição na foto." };
  }
  const firstAngle = measurements.find((item) => item.type === "angle" && item.angleDegrees !== null);
  return {
    photo: {
      localId: createMeasurementId(),
      positionLabel,
      positionOption: photoForm.positionLabel,
      notes: photoForm.notes.trim(),
      imageDataUrl: photoForm.imageDataUrl,
      measurements: measurements.map((item) => ({
        id: item.id,
        type: item.type,
        points: item.points,
        lineDistancePercent: item.lineDistancePercent,
        angleDegrees: item.angleDegrees
      })),
      measurementType: measurements[0].type,
      points: measurements[0].points,
      lineDistancePercent: measurements[0].lineDistancePercent,
      angleDegrees: firstAngle ? firstAngle.angleDegrees : null
    }
  };
}

function toFirestorePhoto(photo, checkpointId, date) {
  return {
    date,
    checkpointId,
    positionLabel: photo.positionLabel,
    positionOption: photo.positionOption || "",
    notes: photo.notes || "",
    imageDataUrl: photo.imageDataUrl,
    measurements: photo.measurements,
    measurementType: photo.measurementType,
    points: photo.points,
    lineDistancePercent: photo.lineDistancePercent,
    angleDegrees: photo.angleDegrees,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function groupPhotosByCheckpoint(checkpoints, photos) {
  const grouped = new Map(checkpoints.map((checkpoint) => [checkpoint.id, []]));
  const checkpointsByDate = new Map();
  checkpoints.forEach((checkpoint) => {
    if (isClientFeedback(checkpoint)) {
      return;
    }
    const matches = checkpointsByDate.get(checkpoint.date) || [];
    matches.push(checkpoint);
    checkpointsByDate.set(checkpoint.date, matches);
  });

  const unlinked = [];
  photos.forEach((photo) => {
    if (photo.checkpointId && grouped.has(photo.checkpointId)) {
      grouped.get(photo.checkpointId).push(photo);
      return;
    }
    const matches = checkpointsByDate.get(photo.date) || [];
    if (!photo.checkpointId && matches.length === 1) {
      grouped.get(matches[0].id).push(photo);
      return;
    }
    unlinked.push(photo);
  });

  return { grouped, unlinked };
}

async function compressImageFile(file, maxDimension = 1280, quality = 0.82) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = dataUrl;
  });

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Não foi possível preparar a imagem para upload.");
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function compressLogoFile(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a logo."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a logo."));
    img.src = dataUrl;
  });
  const scale = Math.min(1, 512 / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Não foi possível preparar a logo.");
  }
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const png = canvas.toDataURL("image/png");
  if (png.length <= 700000) {
    return png;
  }
  return canvas.toDataURL("image/jpeg", 0.82);
}

function socialHandle(value, host) {
  const escapedHost = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .replace(new RegExp(`^(https?:\\/\\/)?(www\\.)?${escapedHost}\\/`, "i"), "")
    .replace(/^@+/, "")
    .split(/[/?#\s]/)[0]
    .replace(/[^A-Za-z0-9._]/g, "")
    .slice(0, 30);
}

function buildEmptyUserProfile() {
  return {
    fullName: "",
    clinicName: "",
    phone: "",
    professionalRole: "",
    instagram: "",
    tiktok: "",
    facebook: "",
    website: "",
    logoDataUrl: "",
    whatsappMessage: ""
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

function formatBookingDay(isoDate) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "—";
  }
  const weekday = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][parsed.getDay()];
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${weekday}, ${day}/${month}`;
}

function bookingReviewPill(status) {
  if (status === "aprovado") {
    return "Primeiro atendimento · aprovado";
  }
  if (status === "recusado") {
    return "Primeiro atendimento · recusado";
  }
  if (status === "remarcacao") {
    return "Primeiro atendimento · aguardando a cliente";
  }
  return "Primeiro atendimento · aguardando você";
}

const MONTH_LABELS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro"
];
const WEEKDAY_LABELS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WEEKDAY_SHORT_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function parseIsoDate(isoDate) {
  const [year, month, day] = String(isoDate || "").split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAgendaDayLabel(isoDate) {
  const date = parseIsoDate(isoDate);
  const weekday = WEEKDAY_LABELS[date.getDay()];
  const label = `${weekday}, ${date.getDate()} de ${MONTH_LABELS[date.getMonth()]}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatAwayClosure(closure) {
  const normalized = normalizeClosure(closure);
  if (!normalized) {
    return "Bloqueio";
  }
  const day = WEEKDAY_LABELS[normalized.weekday] || "";
  if (normalized.allDay && normalized.recurring) {
    return `Toda ${day}`;
  }
  if (normalized.allDay) {
    return "Este dia inteiro";
  }
  const range = `${normalized.start} às ${normalized.end}`;
  return normalized.recurring ? `Toda ${day} · ${range}` : range;
}

const AGENDA_DAY_START = 8 * 60;
const AGENDA_DAY_END = 19 * 60;

function agendaPlacement(startMinutes, durationMinutes) {
  const start = Math.max(AGENDA_DAY_START, Math.min(startMinutes, AGENDA_DAY_END - 30));
  const end = Math.min(AGENDA_DAY_END, Math.max(start + 45, startMinutes + durationMinutes));
  return {
    hoursFromStart: (start - AGENDA_DAY_START) / 60,
    spanHours: (end - start) / 60
  };
}

function agendaHourStyle(hoursFromStart, spanHours) {
  return {
    top: `calc(${hoursFromStart} * var(--agenda-hour))`,
    height: spanHours == null ? undefined : `calc(${spanHours} * var(--agenda-hour))`
  };
}

function appointmentStartMinutes(appointment) {
  const timed = minutesOf(appointment?.time);
  if (timed != null) {
    return timed;
  }
  if (appointment?.period === "tarde") {
    return 14 * 60;
  }
  if (appointment?.period === "noite") {
    return 18 * 60;
  }
  if (appointment?.period === "manha") {
    return 10 * 60;
  }
  return 9 * 60;
}

function buildMonthDays(visibleMonthDate) {
  const year = visibleMonthDate.getFullYear();
  const month = visibleMonthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(toIsoDate(new Date(year, month, day)));
  }
  return days;
}

function getTimestampMillis(value) {
  if (!value) {
    return 0;
  }
  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function getAppointmentDateTimeMillis(appointment) {
  if (!appointment?.date) {
    return 0;
  }
  const isoDateTime = `${appointment.date}T${appointment.time || "00:00"}`;
  const parsed = Date.parse(isoDateTime);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeClientNameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const PAIN_LOUPE_SIZE = 120;
const PAIN_LOUPE_ZOOM = 2.5;
const PAIN_LOUPE_HOLD_MS = 180;

function PainMapSelector({ painSelections, onSelectRegion, onRemoveRegion, isEditable }) {
  const [pendingSelection, setPendingSelection] = useState(null);
  const [mapSide, setMapSide] = useState("front");
  const [press, setPress] = useState(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const pressRef = useRef(null);

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

  const activeRegions = mapSide === "front" ? FRONT_PAIN_REGIONS : BACK_PAIN_REGIONS;

  // Segurar sobre o mapa mostra uma lupa; o ponto é escolhido onde o dedo/mouse é solto.
  // No toque, a lupa só aparece depois de um instante parado, para não travar a rolagem da página.
  const pointFromClient = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const px = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const py = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    return { px, py, width: rect.width, x: (px / rect.width) * 100, y: (py / rect.height) * 100 };
  };

  const commitPoint = (point) => {
    const selectedRegion = getClosestRegion(point.x, point.y, activeRegions);
    if (!selectedRegion) {
      return;
    }
    setPendingSelection({
      label: selectedRegion.label,
      side: mapSide,
      x: Number(point.x.toFixed(2)),
      y: Number(point.y.toFixed(2)),
      laterality: inferLateralityByCoordinate(point.x)
    });
  };

  const endPress = () => {
    const state = pressRef.current;
    if (state) {
      clearTimeout(state.timer);
    }
    pressRef.current = null;
    setPress(null);
    return state;
  };

  const handlePointerDown = (event) => {
    if (!isEditable || event.button > 0 || event.target.closest("button, .laterality-tooltip")) {
      return;
    }
    endPress();
    const point = pointFromClient(event.clientX, event.clientY);
    const isTouch = event.pointerType === "touch";
    const state = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: !isTouch,
      last: point,
      timer: null
    };
    pressRef.current = state;
    setPendingSelection(null);
    if (isTouch) {
      state.timer = setTimeout(() => {
        state.active = true;
        setPress(state.last);
      }, PAIN_LOUPE_HOLD_MS);
    } else {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setPress(point);
    }
  };

  const handlePointerMove = (event) => {
    const state = pressRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    state.last = pointFromClient(event.clientX, event.clientY);
    if (state.active) {
      setPress(state.last);
    } else if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) > 10) {
      // Arrastou antes de segurar: é rolagem da página, não seleção.
      endPress();
    }
  };

  const handlePointerUp = (event) => {
    if (!pressRef.current || pressRef.current.pointerId !== event.pointerId) {
      return;
    }
    const state = endPress();
    commitPoint(state.active ? state.last : pointFromClient(event.clientX, event.clientY));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const blockScrollWhileAiming = (event) => {
      if (pressRef.current?.active) {
        event.preventDefault();
      }
    };
    canvas.addEventListener("touchmove", blockScrollWhileAiming, { passive: false });
    return () => canvas.removeEventListener("touchmove", blockScrollWhileAiming);
  }, []);

  useEffect(() => () => clearTimeout(pressRef.current?.timer), []);

  const renderLoupe = () => {
    const image = imageRef.current;
    if (!press || !image || !image.naturalWidth) {
      return null;
    }
    // A imagem usa object-fit: contain, então calcula a área realmente desenhada dentro da caixa.
    const boxWidth = image.clientWidth;
    const boxHeight = image.clientHeight;
    const scale = Math.min(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
    const drawnWidth = image.naturalWidth * scale;
    const drawnHeight = image.naturalHeight * scale;
    const offsetX = (boxWidth - drawnWidth) / 2;
    const offsetY = (boxHeight - drawnHeight) / 2;
    const half = PAIN_LOUPE_SIZE / 2;
    const placeBelow = press.py < PAIN_LOUPE_SIZE + 48;
    const loupeLeft = Math.min(Math.max(press.px, half), Math.max(half, press.width - half));
    const region = getClosestRegion(press.x, press.y, activeRegions);

    return (
      <>
        <span className="pain-dot pending" style={{ left: `${press.x}%`, top: `${press.y}%` }} aria-hidden />
        <div
          className={`pain-map-loupe ${placeBelow ? "below" : ""}`}
          style={{ left: `${loupeLeft}px`, top: `${press.py}px`, width: PAIN_LOUPE_SIZE, height: PAIN_LOUPE_SIZE }}
          aria-hidden
        >
          <div
            className="pain-map-loupe-lens"
            style={{
              backgroundImage: `url(${image.currentSrc || image.src})`,
              backgroundSize: `${drawnWidth * PAIN_LOUPE_ZOOM}px ${drawnHeight * PAIN_LOUPE_ZOOM}px`,
              backgroundPosition: `${half - (press.px - offsetX) * PAIN_LOUPE_ZOOM}px ${half - (press.py - offsetY) * PAIN_LOUPE_ZOOM}px`
            }}
          />
          {region ? <span className="pain-map-loupe-label">{region.label}</span> : null}
        </div>
      </>
    );
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

  const selectedOnSide = painSelections.filter((selection) => selection.side === mapSide);
  const showMapSide = (side) => {
    endPress();
    setMapSide(side);
    setPendingSelection(null);
  };

  return (
    <div className="pain-map-card anamnese-map-card">
      <div className="pain-map-heading">
        <h3>Mapa de dores</h3>
        <div className="pain-map-switch" role="group" aria-label="Lado do corpo">
          <button
            type="button"
            className={mapSide === "front" ? "active" : ""}
            aria-pressed={mapSide === "front"}
            onClick={() => showMapSide("front")}
          >
            Frente
          </button>
          <button
            type="button"
            className={mapSide === "back" ? "active" : ""}
            aria-pressed={mapSide === "back"}
            onClick={() => showMapSide("back")}
          >
            Costas
          </button>
        </div>
      </div>
      <div className="pain-map-body">
        <figure className={`pain-map-figure ${pendingSelection?.side === mapSide ? "has-tooltip" : ""}`}>
          <div
            ref={canvasRef}
            className="pain-map-canvas"
            data-editable={isEditable ? "true" : "false"}
            role={isEditable ? "button" : undefined}
            tabIndex={isEditable ? 0 : -1}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={endPress}
            onContextMenu={(event) => {
              if (isEditable) {
                event.preventDefault();
              }
            }}
          >
            <img
              ref={imageRef}
              draggable={false}
              src={mapSide === "front" ? "/pain-map-front.jpg" : "/pain-map-back.jpg"}
              alt={mapSide === "front" ? "Mapa corporal frontal para seleção de dor" : "Mapa corporal traseiro para seleção de dor"}
            />
            {selectedOnSide.map((selection) => (
              <button
                key={`${mapSide}-selected-${selection.label}`}
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
                title={`${selection.label} (${formatLateralityLabel(selection.laterality)})`}
                aria-label={`Desmarcar ${selection.label}`}
              />
            ))}
            {renderLateralityTooltip(mapSide)}
            {renderLoupe()}
          </div>
        </figure>
        <div className="pain-map-regions">
          <button type="button" className="pain-map-edit" onClick={() => canvasRef.current?.focus()}>
            Editar mapa
          </button>
          {painSelections.length > 0 ? (
            <>
              <p className="pain-map-regions-label">Regiões marcadas</p>
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
                    {formatPainChip(selection)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="muted-text pain-map-empty">Nenhuma região marcada.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MeasurementMarks({ measurements = [], activePoints = [], activeType = "line", showIndex = true }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="photo-overlay-svg">
      {measurements.map((measurement, index) => {
        const color = MEASUREMENT_COLORS[index % MEASUREMENT_COLORS.length];
        const points = measurement.points || [];
        return (
          <g key={measurement.id || `measurement-${index}`}>
            {points.length >= 2 ? (
              <line
                x1={points[0].x}
                y1={points[0].y}
                x2={points[1].x}
                y2={points[1].y}
                className="measurement-line"
                style={{ stroke: color }}
              />
            ) : null}
            {measurement.type === "angle" && points.length >= 3 ? (
              <line
                x1={points[1].x}
                y1={points[1].y}
                x2={points[2].x}
                y2={points[2].y}
                className="measurement-line"
                style={{ stroke: color }}
              />
            ) : null}
            {points.map((point) => (
              <g key={`${measurement.id || index}-${point.label}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="2.3"
                  className="measurement-point"
                  style={{ fill: color }}
                />
                <text x={point.x} y={point.y - 3.4} className="measurement-point-label">
                  {showIndex ? `${index + 1}${point.label}` : point.label}
                </text>
              </g>
            ))}
          </g>
        );
      })}
      {activePoints.length >= 2 ? (
        <line
          x1={activePoints[0].x}
          y1={activePoints[0].y}
          x2={activePoints[1].x}
          y2={activePoints[1].y}
          className="measurement-line draft"
        />
      ) : null}
      {activeType === "angle" && activePoints.length >= 3 ? (
        <line
          x1={activePoints[1].x}
          y1={activePoints[1].y}
          x2={activePoints[2].x}
          y2={activePoints[2].y}
          className="measurement-line draft"
        />
      ) : null}
      {activePoints.map((point) => (
        <g key={`active-${point.label}-${point.x}-${point.y}`}>
          <circle cx={point.x} cy={point.y} r="2.5" className="measurement-point draft" />
          <text x={point.x} y={point.y - 3.4} className="measurement-point-label">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function PhotoMeasurementEditor({
  imageDataUrl,
  measurements,
  activeMeasurementType,
  activePoints,
  onSelectFile,
  onChangeActivePoints,
  onMeasurementTypeChange,
  onUndoActivePoint
}) {
  const [isDragging, setIsDragging] = useState(false);
  const requiredPoints = getRequiredMeasurementPoints(activeMeasurementType);
  const hint = activeMeasurementType === "angle"
    ? "Toque em três pontos para medir um ângulo"
    : "Toque em dois pontos para medir uma linha";

  const handleIncomingFile = (fileList) => {
    const file = fileList?.[0];
    if (file) {
      onSelectFile(file);
    }
  };

  const handleImageClick = (event) => {
    if (!imageDataUrl || activePoints.length >= requiredPoints) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    onChangeActivePoints([
      ...activePoints,
      {
        label: getMeasurementPointLabel(activePoints.length),
        x: Number(Math.min(100, Math.max(0, x)).toFixed(2)),
        y: Number(Math.min(100, Math.max(0, y)).toFixed(2))
      }
    ]);
  };

  return (
    <div
      className={`photo-composer-stage ${isDragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleIncomingFile(event.dataTransfer.files);
      }}
    >
      <div className="photo-composer-tools">
        <div className="photo-measure-tabs" role="radiogroup" aria-label="Tipo de medição">
          <button
            type="button"
            role="radio"
            aria-checked={activeMeasurementType !== "angle"}
            className={activeMeasurementType !== "angle" ? "is-selected" : ""}
            onClick={() => onMeasurementTypeChange("line")}
          >
            Linha A–B
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={activeMeasurementType === "angle"}
            className={activeMeasurementType === "angle" ? "is-selected" : ""}
            onClick={() => onMeasurementTypeChange("angle")}
          >
            Ângulo A–B–C
          </button>
        </div>
        <button type="button" className="secondary-btn" onClick={onUndoActivePoint} disabled={!activePoints.length}>
          Desfazer ponto
        </button>
        <label className="secondary-btn photo-replace-btn">
          Trocar foto
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              handleIncomingFile(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {!imageDataUrl ? (
        <label className={`photo-dropzone ${isDragging ? "is-dragging" : ""}`}>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              handleIncomingFile(event.target.files);
              event.target.value = "";
            }}
          />
          <strong>Adicionar foto</strong>
          <span>Arraste a imagem aqui ou clique para escolher do dispositivo.</span>
        </label>
      ) : (
        <div
          className={`photo-measurement-canvas ${activePoints.length >= requiredPoints ? "is-complete" : ""}`}
          onClick={handleImageClick}
        >
          <img src={imageDataUrl} alt="Foto de acompanhamento para medição" />
          <MeasurementMarks
            measurements={measurements}
            activePoints={activePoints}
            activeType={activeMeasurementType}
            showIndex={false}
          />
          {measurements.map((measurement) => {
            const position = measurementBadgePosition(measurement);
            if (!position) {
              return null;
            }
            return (
              <span
                key={`badge-${measurement.id}`}
                className="photo-measure-badge"
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
              >
                {measurementBadgeText(measurement)}
              </span>
            );
          })}
          <p className="photo-canvas-hint">{hint}</p>
        </div>
      )}
    </div>
  );
}

const PARAMETER_UNIT_PRESETS = ["cm", "graus", "kg", "%"];

function TrackingParameterEditor({ parameters, form, error, busy, onChange, onAdd, onRemove, onClose }) {
  const [customUnit, setCustomUnit] = useState(false);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (PARAMETER_UNIT_PRESETS.includes(form.unit)) {
      setCustomUnit(false);
    }
  }, [form.unit]);

  const selectPreset = (unit) => {
    setCustomUnit(false);
    onChange({ unit });
  };

  const selectCustomUnit = () => {
    setCustomUnit(true);
    if (PARAMETER_UNIT_PRESETS.includes(form.unit)) {
      onChange({ unit: "" });
    }
  };

  return (
    <form className="tracking-parameter-form" onSubmit={onAdd}>
      {parameters.length > 0 ? (
        <>
          <ul className="tracking-parameter-list">
            {parameters.map((parameter) => (
              <li key={parameter.id}>
                <strong>{parameter.name}</strong>
                <span className="parameter-row-meta">
                  <span className="parameter-unit-chip">{parameter.unit}</span>
                  <button
                    type="button"
                    className="parameter-remove"
                    onClick={() => onRemove(parameter.id)}
                    disabled={busy}
                    aria-label={`Remover ${parameter.name}`}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <hr className="parameter-divider" />
        </>
      ) : null}
      <label>
        Nova medida
        <input
          value={form.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Ex.: alcance do ombro esquerdo"
          maxLength={60}
          required
        />
      </label>
      <div className="parameter-unit-field">
        <span>Unidade</span>
        <div className="parameter-unit-options" role="radiogroup" aria-label="Unidade">
          {PARAMETER_UNIT_PRESETS.map((unit) => (
            <button
              key={unit}
              type="button"
              role="radio"
              aria-checked={!customUnit && form.unit === unit}
              className={`parameter-unit-choice${!customUnit && form.unit === unit ? " is-selected" : ""}`}
              onClick={() => selectPreset(unit)}
            >
              {unit}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={customUnit}
            className={`parameter-unit-choice is-other${customUnit ? " is-selected" : ""}`}
            onClick={selectCustomUnit}
          >
            Outra
          </button>
        </div>
        {customUnit ? (
          <input
            value={form.unit}
            onChange={(event) => onChange({ unit: event.target.value })}
            placeholder="Ex.: mm"
            maxLength={16}
            aria-label="Unidade personalizada"
            required
          />
        ) : null}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <footer className="parameter-modal-footer">
        <button type="button" className="secondary-btn" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button className="primary-btn" type="submit" disabled={busy}>
          {busy ? "Salvando..." : "Adicionar medida"}
        </button>
      </footer>
    </form>
  );
}

function formatChartNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  const rounded = Math.round(numeric * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function niceStep(raw) {
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const nice = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return nice * magnitude;
}

function roundedDomain(values, divisions = 2) {
  const nums = values.map((value) => Number(value)).filter(Number.isFinite);
  if (nums.length === 0) {
    return { min: 0, max: 10, ticks: [0, 5, 10] };
  }
  let low = Math.min(...nums);
  let high = Math.max(...nums);
  if (high === low) {
    low -= 5;
    high += 5;
  }
  const pad = Math.max((high - low) * 0.22, 1);
  low -= pad;
  high += pad;
  const step = niceStep((high - low) / divisions);
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const ticks = [];
  for (let value = min; value <= max + step / 100; value += step) {
    ticks.push(Math.round(value * 100) / 100);
    if (ticks.length > 6) {
      break;
    }
  }
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

function chartLabelIndexes(count) {
  if (count <= 5) {
    return Array.from({ length: count }, (_, index) => index);
  }
  const indexes = new Set([0, count - 1]);
  for (let step = 1; step <= 3; step += 1) {
    indexes.add(Math.round((step * (count - 1)) / 4));
  }
  return [...indexes].sort((first, second) => first - second);
}

function EvolutionPhonePreview({ clinicName, clientName, highlight, comments, homeCare, latest }) {
  const firstName = String(clientName || "").trim().split(" ")[0] || "cliente";
  const careLines = String(homeCare || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const note = String(comments || "").trim();
  const phrase = String(highlight || "").trim();
  return (
    <aside className="evolution-preview" aria-label="Prévia no celular">
      <p className="evolution-preview-kicker">Prévia no celular</p>
      <div className="evolution-phone">
        <header className="evolution-phone-hero">
          <p className="evolution-phone-clinic">{clinicName || "Clínica Estética"}</p>
          <h5>Sua evolução, {firstName}</h5>
          {phrase ? <p className="evolution-phone-highlight">{phrase}</p> : null}
        </header>
        <div className="evolution-phone-body">
          {latest ? (
            <div className="evolution-phone-stats">
              <div>
                <span>Bem-estar</span>
                <strong>{wellnessScore(latest)}</strong>
              </div>
              <div>
                <span>Dor</span>
                <strong>{latest.painLevel ?? 0}</strong>
              </div>
              <div>
                <span>Estresse</span>
                <strong>{latest.stressLevel ?? 0}</strong>
              </div>
              <div>
                <span>Sono</span>
                <strong>{formatChartNumber(latest.sleepHours)} h</strong>
              </div>
            </div>
          ) : (
            <p className="evolution-phone-note">Ainda não há sessão para mostrar os números.</p>
          )}
          {note ? <p className="evolution-phone-note">{note}</p> : null}
          {careLines.length ? (
            <div className="evolution-phone-note">
              <span>Cuidados em casa</span>
              <ul>
                {careLines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function ChartDelta({ from, to, suffix = "", positiveIsGood = true, tone = "" }) {
  const delta = (Number(to) || 0) - (Number(from) || 0);
  const rounded = Math.round(delta * 10) / 10;
  const text = `${rounded > 0 ? "+" : ""}${formatChartNumber(rounded)}${suffix}`;
  let className = "record-chart-delta";
  if (tone) {
    className += ` ${tone}`;
  } else if (Math.abs(rounded) >= 0.05) {
    const improved = positiveIsGood ? rounded > 0 : rounded < 0;
    className += improved ? " is-up" : " is-down";
  }
  return <strong className={className}>{text}</strong>;
}

function RecordChart({ title, aside, children }) {
  return (
    <article className="record-chart">
      <header className="record-chart-head">
        <h5>{title}</h5>
        {aside || null}
      </header>
      {children}
    </article>
  );
}

const RECORD_CHART = { width: 360, height: 168, top: 16, right: 12, bottom: 28, left: 36 };

function chartGeometry(count, domain) {
  const { width, height, top, right, bottom, left } = RECORD_CHART;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const span = domain.max - domain.min || 1;
  const x = (index) => (count <= 1 ? left + plotWidth / 2 : left + (index * plotWidth) / (count - 1));
  const y = (value) => {
    const clamped = Math.min(Math.max(Number(value) || 0, domain.min), domain.max);
    return top + (1 - (clamped - domain.min) / span) * plotHeight;
  };
  return { width, height, top, right, bottom, left, plotWidth, plotHeight, x, y };
}

function ChartAxes({ geometry, domain, count, dates, formatY }) {
  const labels = chartLabelIndexes(count);
  return (
    <>
      {domain.ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={geometry.left}
            y1={geometry.y(tick)}
            x2={RECORD_CHART.width - geometry.right}
            y2={geometry.y(tick)}
            stroke="#eceae4"
            strokeWidth="1"
          />
          <text
            x={geometry.left - 8}
            y={geometry.y(tick) + 4}
            textAnchor="end"
            fill="#8b9691"
            fontSize="11"
            fontWeight="600"
          >
            {formatY(tick)}
          </text>
        </g>
      ))}
      {labels.map((index) => {
        const atStart = count > 1 && index === 0;
        const atEnd = count > 1 && index === count - 1;
        return (
          <text
            key={`${dates[index]}-${index}`}
            x={atStart ? geometry.left : atEnd ? RECORD_CHART.width - geometry.right : geometry.x(index)}
            y={RECORD_CHART.height - 8}
            textAnchor={atStart ? "start" : atEnd ? "end" : "middle"}
            fill="#8b9691"
            fontSize="11"
            fontWeight="600"
          >
            {formatDayMonth(dates[index])}
          </text>
        );
      })}
    </>
  );
}

function MetricLineChart({
  title,
  points,
  empty,
  color = "#1f4d43",
  area = false,
  pointStyle = "end",
  domain,
  formatY = formatChartNumber,
  aside
}) {
  if (points.length < 2) {
    return (
      <RecordChart title={title}>
        <p className="muted-text">{empty}</p>
      </RecordChart>
    );
  }

  const resolvedDomain = domain || roundedDomain(points.map((item) => item.value));
  const geometry = chartGeometry(points.length, resolvedDomain);
  const line = points
    .map((item, index) => `${index === 0 ? "M" : "L"} ${geometry.x(index)} ${geometry.y(item.value)}`)
    .join(" ");
  const baseline = geometry.y(resolvedDomain.min);
  const areaPath = `${line} L ${geometry.x(points.length - 1)} ${baseline} L ${geometry.x(0)} ${baseline} Z`;

  return (
    <RecordChart title={title} aside={aside}>
      <svg viewBox={`0 0 ${RECORD_CHART.width} ${RECORD_CHART.height}`} role="img" aria-label={title}>
        {area ? <path d={areaPath} fill="#e6eeea" /> : null}
        <ChartAxes
          geometry={geometry}
          domain={resolvedDomain}
          count={points.length}
          dates={points.map((item) => item.date)}
          formatY={formatY}
        />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((item, index) => {
          const show = pointStyle !== "end" || index === points.length - 1;
          if (!show) {
            return null;
          }
          const open = pointStyle === "open";
          return (
            <circle
              key={`${item.date}-${index}`}
              cx={geometry.x(index)}
              cy={geometry.y(item.value)}
              r={open ? 4 : 4.5}
              fill={open ? "#ffffff" : color}
              stroke={open ? color : "#ffffff"}
              strokeWidth="2"
            />
          );
        })}
      </svg>
    </RecordChart>
  );
}

function ParameterProgressChart({ series }) {
  const points = series.points || [];
  const last = points[points.length - 1];
  const first = points[0];
  return (
    <MetricLineChart
      title={series.name}
      points={points}
      empty={points.length === 0
        ? "Ainda não há medição deste parâmetro."
        : "Registre esta medida em outra sessão para ver a evolução."}
      pointStyle="open"
      color="#b8946a"
      aside={points.length >= 2 ? (
        <ChartDelta
          from={first?.value}
          to={last?.value}
          suffix={series.unit ? ` ${series.unit}` : ""}
          positiveIsGood={series.improveWhen !== "down"}
        />
      ) : null}
    />
  );
}

function formatDayMonth(dateValue) {
  const parsed = new Date(`${dateValue}T00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function formatSleepChip(hours, feedback) {
  const numeric = Number(hours);
  if (feedback) {
    if (numeric === 7.5) return "7 a 8 h";
    if (numeric === 6) return "5 a 6 h";
    if (numeric === 4) return "menos de 5 h";
    if (numeric === 9) return "mais de 8 h";
  }
  if (!Number.isFinite(numeric) || hours === "" || hours === null || hours === undefined) {
    return "—";
  }
  const text = Number.isInteger(numeric) ? String(numeric) : String(Math.round(numeric * 10) / 10).replace(".", ",");
  return `${text} h`;
}

function SessionDetail({ checkpoint, photos, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!checkpoint) {
    return (
      <article className="session-detail-card is-empty">
        <p className="muted-text">Nenhum registro ainda. Use Nova sessão para começar o acompanhamento.</p>
      </article>
    );
  }

  const feedback = isClientFeedback(checkpoint);
  const readings = normalizeReadings(checkpoint.parameters);
  const title = feedback
    ? "Feedback da cliente"
    : checkpoint.sessionNumber
      ? `Sessão ${checkpoint.sessionNumber} · ${formatDatePt(checkpoint.date)}`
      : formatDatePt(checkpoint.date);

  return (
    <article className="session-detail-card">
      <header className="session-detail-header">
        <div>
          <h3>{title}</h3>
          <p>{checkpoint.sessionType || (feedback ? "Enviado pelo link" : "Tipo não informado")}</p>
        </div>
        <div className="session-detail-menu">
          <button
            type="button"
            className="icon-btn"
            aria-label={feedback ? "Opções do feedback" : "Opções da sessão"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((previous) => !previous)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="session-detail-menu-dropdown">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(checkpoint.id);
                }}
              >
                {feedback ? "Excluir feedback" : "Excluir sessão"}
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <div className="session-stat-grid">
        <div>
          <span>Bem-estar</span>
          <strong>{wellnessScore(checkpoint)}</strong>
        </div>
        <div>
          <span>Dor</span>
          <strong>{checkpoint.painLevel ?? 0}</strong>
        </div>
        <div>
          <span>Estresse</span>
          <strong>{checkpoint.stressLevel ?? 0}</strong>
        </div>
        <div>
          <span>Sono</span>
          <strong>{formatSleepChip(checkpoint.sleepHours, feedback)}</strong>
        </div>
      </div>
      <section className="session-detail-block">
        <h4>Observações</h4>
        <p>{checkpoint.observations?.trim() ? checkpoint.observations : "Sem observações nesta sessão."}</p>
      </section>
      {feedback ? null : (
        <section className="session-detail-block">
          <h4>Fotos e medições</h4>
          {photos.length === 0 ? (
            <p className="muted-text">Nenhuma foto nesta sessão.</p>
          ) : (
            <div className="session-photo-grid">
              {photos.map((analysis) => {
                const measurements = getStoredMeasurements(analysis);
                const measurementLabel = measurements[0] ? formatMeasurementValue(measurements[0]) : "";
                return (
                  <figure key={analysis.id} className="session-photo-card">
                    <div className="photo-measurement-canvas photo-analysis-preview">
                      {analysis.imageDataUrl ? (
                        <>
                          <img src={analysis.imageDataUrl} alt={analysis.positionLabel || "Foto da sessão"} />
                          <MeasurementMarks measurements={measurements} />
                        </>
                      ) : null}
                    </div>
                    <figcaption>
                      {analysis.positionLabel || "Foto"}
                      {measurementLabel ? ` · ${measurementLabel}` : ""}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </section>
      )}
      {readings.length > 0 ? (
        <ul className="session-reading-list">
          {readings.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <strong>{formatParameterValue(item.value, item.unit)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function PhotoAnalysisSummary({ analysis, onRemove, removeLabel = "Excluir" }) {
  const measurements = getStoredMeasurements(analysis);
  return (
    <li>
      <div className="photo-analysis-item">
        <div className="photo-measurement-canvas photo-analysis-preview">
          {analysis.imageDataUrl ? (
            <>
              <img
                src={analysis.imageDataUrl}
                alt={`Foto de acompanhamento em ${analysis.date || analysis.positionLabel || "posição informada"}`}
              />
              <MeasurementMarks measurements={measurements} />
            </>
          ) : null}
        </div>
        <div>
          <strong>{analysis.positionLabel || "Posição não informada"}</strong>
          {measurements.length === 0 ? (
            <p>Sem medições registradas.</p>
          ) : (
            measurements.map((measurement, index) => (
              <p key={measurement.id}>
                {index + 1}. {formatMeasurementValue(measurement)}
              </p>
            ))
          )}
          {analysis.notes ? <p>{analysis.notes}</p> : null}
        </div>
      </div>
      {onRemove ? (
        <button type="button" className="danger-btn" onClick={onRemove}>
          {removeLabel}
        </button>
      ) : null}
    </li>
  );
}

function ProgressLineChart({ title, points, firstMetric, secondMetric, maxValue }) {
  const domain = { min: 0, max: maxValue, ticks: [0, maxValue / 2, maxValue] };
  if (points.length < 2) {
    return (
      <RecordChart
        title={title}
        aside={(
          <div className="record-chart-legend">
            <span><i className="record-swatch is-pain" />{firstMetric.label}</span>
            <span><i className="record-swatch is-stress" />{secondMetric.label}</span>
          </div>
        )}
      >
        <p className="muted-text">Cadastre pelo menos 2 avaliações para ver a evolução.</p>
      </RecordChart>
    );
  }

  const geometry = chartGeometry(points.length, domain);
  const line = (fieldName) => points
    .map((item, index) => `${index === 0 ? "M" : "L"} ${geometry.x(index)} ${geometry.y(item[fieldName])}`)
    .join(" ");

  return (
    <RecordChart
      title={title}
      aside={(
        <div className="record-chart-legend">
          <span><i className="record-swatch is-pain" />{firstMetric.label}</span>
          <span><i className="record-swatch is-stress" />{secondMetric.label}</span>
        </div>
      )}
    >
      <svg viewBox={`0 0 ${RECORD_CHART.width} ${RECORD_CHART.height}`} role="img" aria-label={title}>
        <ChartAxes
          geometry={geometry}
          domain={domain}
          count={points.length}
          dates={points.map((item) => item.date)}
          formatY={(value) => formatChartNumber(value)}
        />
        <path d={line(firstMetric.field)} fill="none" stroke="#1f4d43" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <path d={line(secondMetric.field)} fill="none" stroke="#b8946a" strokeWidth="2.2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((item, index) => (
          <g key={`${item.date}-${index}`}>
            <circle cx={geometry.x(index)} cy={geometry.y(item[firstMetric.field])} r="3.5" fill="#1f4d43" />
            <circle cx={geometry.x(index)} cy={geometry.y(item[secondMetric.field])} r="3.5" fill="#b8946a" />
          </g>
        ))}
      </svg>
    </RecordChart>
  );
}

function SleepBarChart({ points }) {
  const average = points.length
    ? points.reduce((sum, item) => sum + (Number(item.sleepHours) || 0), 0) / points.length
    : 0;
  const aside = points.length ? (
    <span className="record-chart-aside">média {formatChartNumber(average)} h</span>
  ) : null;

  if (points.length < 1) {
    return (
      <RecordChart title="Sono por registro">
        <p className="muted-text">Sem dados de sono até o momento.</p>
      </RecordChart>
    );
  }

  const { width, height, top, right, bottom, left } = RECORD_CHART;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = 12;
  const slot = plotWidth / points.length;
  const barWidth = Math.min(42, slot * 0.46);
  const labels = chartLabelIndexes(points.length);

  return (
    <RecordChart title="Sono por registro" aside={aside}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sono por registro">
        <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} stroke="#eceae4" strokeWidth="1" />
        {points.map((item, index) => {
          const value = Math.min(Math.max(Number(item.sleepHours) || 0, 0), maxValue);
          const barHeight = (value / maxValue) * plotHeight;
          const x = left + index * slot + (slot - barWidth) / 2;
          const y = height - bottom - barHeight;
          return (
            <g key={`${item.date}-${index}`}>
              <rect
                x={x}
                y={barHeight < 1 ? height - bottom - 2 : y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx="5"
                fill={index === points.length - 1 ? "#1f4d43" : "#d5e4dc"}
              />
              <text x={x + barWidth / 2} y={Math.max(y - 8, 12)} textAnchor="middle" fill="#1c2421" fontSize="12" fontWeight="700">
                {formatChartNumber(item.sleepHours)}
              </text>
            </g>
          );
        })}
        {labels.map((index) => {
          const atStart = points.length > 1 && index === 0;
          const atEnd = points.length > 1 && index === points.length - 1;
          return (
            <text
              key={`${points[index].date}-${index}`}
              x={atStart ? left : atEnd ? width - right : left + index * slot + slot / 2}
              y={height - 8}
              textAnchor={atStart ? "start" : atEnd ? "end" : "middle"}
              fill="#8b9691"
              fontSize="11"
              fontWeight="600"
            >
              {formatDayMonth(points[index].date)}
            </text>
          );
        })}
      </svg>
    </RecordChart>
  );
}

function WellnessScoreChart({ points }) {
  const scorePoints = points.map((item) => ({ date: item.date, value: wellnessScore(item) }));
  const first = scorePoints[0];
  const last = scorePoints[scorePoints.length - 1];
  return (
    <MetricLineChart
      title="Índice de bem-estar"
      points={scorePoints}
      empty="Cadastre pelo menos 2 avaliações para ver a evolução."
      area
      aside={scorePoints.length >= 2 ? <ChartDelta from={first.value} to={last.value} /> : null}
    />
  );
}

function AngleProgressChart({ series }) {
  const points = series?.points || [];
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <MetricLineChart
      title={series?.label || "Ângulo"}
      points={points}
      empty="Marque este ângulo em outra data para ver a evolução."
      color="#b8946a"
      pointStyle="open"
      formatY={(value) => `${formatChartNumber(value)}°`}
      aside={points.length >= 2 ? (
        <ChartDelta from={first?.value} to={last?.value} suffix="°" tone="is-measure" />
      ) : null}
    />
  );
}

function SessionTypeDistributionChart({ points }) {
  if (points.length < 1) {
    return (
      <RecordChart title="Tipos de atendimento">
        <p className="muted-text">Sem sessões registradas para montar a distribuição.</p>
      </RecordChart>
    );
  }

  const typeCountMap = points.reduce((accumulator, item) => {
    const normalizedType = SESSION_TYPES.includes(item.sessionType) ? item.sessionType : "Não informado";
    accumulator[normalizedType] = (accumulator[normalizedType] || 0) + 1;
    return accumulator;
  }, {});
  const rows = [
    ...SESSION_TYPES.map((type) => ({ type, count: typeCountMap[type] || 0 })),
    ...(typeCountMap["Não informado"] ? [{ type: "Não informado", count: typeCountMap["Não informado"] }] : [])
  ].sort((first, second) => second.count - first.count);
  const maxCount = Math.max(...rows.map((row) => row.count), 1);

  return (
    <RecordChart title="Tipos de atendimento">
      <div className="record-dist">
        {rows.map((row) => {
          const percent = Math.round((row.count / maxCount) * 100);
          return (
            <div key={row.type} className="record-dist-row">
              <span>{row.type}</span>
              <div className="record-dist-track">
                <div className="record-dist-fill" style={{ width: `${percent}%` }} />
                <strong className={percent >= 28 ? "is-on-fill" : ""} style={percent >= 28 ? { left: `calc(${percent}% - 22px)` } : undefined}>
                  {row.count}
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </RecordChart>
  );
}

function InitialVsCurrentChart({ points }) {
  if (points.length < 2) {
    return (
      <RecordChart title="Inicial x atual">
        <p className="muted-text">Cadastre pelo menos 2 registros para comparar.</p>
      </RecordChart>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const metricRows = [
    { label: "Dor", field: "painLevel", max: 10, suffix: "" },
    { label: "Estresse", field: "stressLevel", max: 10, suffix: "" },
    { label: "Sono", field: "sleepHours", max: 12, suffix: " h" }
  ].map((metric) => {
    const firstValue = Number(first[metric.field]) || 0;
    const lastValue = Number(last[metric.field]) || 0;
    return {
      ...metric,
      firstValue,
      lastValue,
      firstPercent: Math.min(Math.max((firstValue / metric.max) * 100, 0), 100),
      lastPercent: Math.min(Math.max((lastValue / metric.max) * 100, 0), 100)
    };
  });

  return (
    <RecordChart title="Inicial x atual">
      <div className="record-compare">
        {metricRows.map((metric) => {
          const firstWider = metric.firstPercent >= metric.lastPercent;
          const formatValue = (value) => `${formatChartNumber(value)}${metric.suffix}`;
          return (
            <div key={metric.field} className="record-compare-row">
              <span>{metric.label}</span>
              <div className="record-compare-track">
                <i
                  className={firstWider ? "is-first" : "is-last"}
                  style={{ width: `${Math.max(metric.firstPercent, metric.lastPercent)}%` }}
                />
                <i
                  className={firstWider ? "is-last" : "is-first"}
                  style={{ width: `${Math.min(metric.firstPercent, metric.lastPercent)}%` }}
                />
              </div>
              <strong>{formatValue(metric.firstValue)} → {formatValue(metric.lastValue)}</strong>
            </div>
          );
        })}
      </div>
      <div className="record-compare-legend">
        <span><i className="is-first" />Primeiro registro</span>
        <span><i className="is-last" />Último registro</span>
      </div>
    </RecordChart>
  );
}

function linkSortTime(link) {
  const created = link?.createdAt;
  if (!created) {
    return Date.now();
  }
  if (typeof created.toMillis === "function") {
    return created.toMillis();
  }
  if (typeof created.seconds === "number") {
    return created.seconds * 1000;
  }
  return 0;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.2a8.3 8.3 0 0 0-7.2 12.4L3.8 20.7l5.2-1A8.3 8.3 0 1 0 12 3.2Zm4.7 11.7c-.2.6-1.1 1-1.6 1.1-.4 0-.9.2-3.1-.7-2.6-1.1-4.2-3.7-4.3-3.9-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.6.7 1.8.8 1.9.1.2 0 .4-.2.6l-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.5-.6c.2-.2.3-.2.6-.1.2.1 1.5.7 1.8.8.2.1.4.2.4.4.1.3 0 .8-.2 1.1Z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M6 16.2H5.4A1.4 1.4 0 0 1 4 14.8v-9A1.4 1.4 0 0 1 5.4 4.4h9A1.4 1.4 0 0 1 15.8 5.8V6" />
    </svg>
  );
}

function RenewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.2 12a7.2 7.2 0 1 1-2.1-5" />
      <path d="M19.2 4.2V8h-3.8" />
    </svg>
  );
}

function RecordLinkRow({ label, link, busy, phone, messageTemplate, onCreate, onCopy }) {
  const url = link?.id ? shareUrl(link.id) : "";
  const whatsApp = url ? whatsAppUrl(phone, shareWhatsAppMessage(messageTemplate, url)) : "";
  return (
    <div className="record-menu-row">
      <span>{label}</span>
      <span className="record-menu-row-actions">
        {whatsApp ? (
          <a className="link-action" href={whatsApp} target="_blank" rel="noreferrer" aria-label={`Enviar ${label} no WhatsApp`}>
            <WhatsAppIcon />
          </a>
        ) : (
          <button type="button" className="link-action" disabled aria-label={`Enviar ${label} no WhatsApp`}>
            <WhatsAppIcon />
          </button>
        )}
        <button type="button" className="link-action" disabled={!url || busy} aria-label={`Copiar link de ${label}`} onClick={onCopy}>
          <CopyIcon />
        </button>
        <button type="button" className="link-action" disabled={busy} aria-label={`Gerar link novo de ${label}`} onClick={onCreate}>
          <RenewIcon />
        </button>
      </span>
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

  const [activeTab, setActiveTab] = useState(TABS.INICIO);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isHeaderAlertsOpen, setIsHeaderAlertsOpen] = useState(false);
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
  const [isServiceSheetOpen, setIsServiceSheetOpen] = useState(false);
  const [noticeSummary, setNoticeSummary] = useState(null);
  const [openServiceMenuId, setOpenServiceMenuId] = useState("");
  const [appointmentClient, setAppointmentClient] = useState("");
  const [isAppointmentClientListOpen, setIsAppointmentClientListOpen] = useState(false);
  const [appointmentAwaitingClient, setAppointmentAwaitingClient] = useState(false);
  const [isCreatingAppointmentClient, setIsCreatingAppointmentClient] = useState(false);
  const [appointmentClientNotice, setAppointmentClientNotice] = useState("");
  const [savedAppointmentClientNames, setSavedAppointmentClientNames] = useState([]);
  const clientCreatePromisesRef = useRef(new Map());
  const [appointmentService, setAppointmentService] = useState("");
  const [isAppointmentServiceListOpen, setIsAppointmentServiceListOpen] = useState(false);
  const [isCreatingAppointmentService, setIsCreatingAppointmentService] = useState(false);
  const [appointmentServiceNotice, setAppointmentServiceNotice] = useState("");
  const [savedAppointmentServiceTitles, setSavedAppointmentServiceTitles] = useState([]);
  const serviceCreatePromisesRef = useRef(new Map());
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [agendaNotice, setAgendaNotice] = useState("");
  const [feedbackCopyId, setFeedbackCopyId] = useState("");
  const feedbackCopyRef = useRef(false);
  const [firstContactBusy, setFirstContactBusy] = useState(false);
  const [bookingReview, setBookingReview] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [bookingNotice, setBookingNotice] = useState("");
  const [bookingBusy, setBookingBusy] = useState("");
  const [bookingWhatsAppUrl, setBookingWhatsAppUrl] = useState("");
  const [agendaMode, setAgendaMode] = useState("month");
  const [selectedAgendaAppointmentId, setSelectedAgendaAppointmentId] = useState("");
  const [agendaClosures, setAgendaClosures] = useState([]);
  const [offStart, setOffStart] = useState("");
  const [offEnd, setOffEnd] = useState("");
  const [offRepeat, setOffRepeat] = useState(false);
  const [offMode, setOffMode] = useState("interval");
  const [offBusy, setOffBusy] = useState(false);
  const [offError, setOffError] = useState("");
  const [isAgendaOffOpen, setIsAgendaOffOpen] = useState(false);
  const publishedAvailabilityRef = useRef("");
  const availabilityQueueRef = useRef(Promise.resolve());
  const [agendaSelectedDate, setAgendaSelectedDate] = useState("");
  const [agendaVisibleMonth, setAgendaVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientView, setSelectedClientView] = useState(null);
  const [openClientMenuId, setOpenClientMenuId] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(buildEmptyUserProfile());
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientSexFilter, setClientSexFilter] = useState("all");
  const [clientSortMode, setClientSortMode] = useState("name_asc");
  const [isClientSortMenuOpen, setIsClientSortMenuOpen] = useState(false);
  const [anamneseForm, setAnamneseForm] = useState(buildEmptyAnamnese());
  const [anamneseSnapshot, setAnamneseSnapshot] = useState(buildEmptyAnamnese());
  const [isEditingAnamnese, setIsEditingAnamnese] = useState(false);
  const [clientHasAnamnese, setClientHasAnamnese] = useState(false);
  const [checkpoints, setCheckpoints] = useState([]);
  const [trackingParameters, setTrackingParameters] = useState([]);
  const [parameterForm, setParameterForm] = useState(() => emptyParameterForm());
  const [parameterError, setParameterError] = useState("");
  const [parameterBusy, setParameterBusy] = useState(false);
  const [isParameterEditorOpen, setIsParameterEditorOpen] = useState(false);
  const [checkpointError, setCheckpointError] = useState("");
  const [photoAnalyses, setPhotoAnalyses] = useState([]);
  const [checkpointForm, setCheckpointForm] = useState(buildEmptyCheckpoint());
  const [photoForm, setPhotoForm] = useState(buildEmptyPhotoAnalysis());
  const [draftPhotos, setDraftPhotos] = useState([]);
  const [isSavingCheckpoint, setIsSavingCheckpoint] = useState(false);
  const [followupScreen, setFollowupScreen] = useState("list");
  const [selectedCheckpointId, setSelectedCheckpointId] = useState("");
  const [isPhotoComposerOpen, setIsPhotoComposerOpen] = useState(false);
  const [isRecordMenuOpen, setIsRecordMenuOpen] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [photoMessageTone, setPhotoMessageTone] = useState("success");
  const [anamneseMessage, setAnamneseMessage] = useState("");
  const [shareLinks, setShareLinks] = useState([]);
  const [shareNotice, setShareNotice] = useState(null);
  const [shareBusy, setShareBusy] = useState("");
  const [evolutionDraft, setEvolutionDraft] = useState({ highlight: "", comments: "", homeCare: "" });
  const [isEvolutionComposerOpen, setIsEvolutionComposerOpen] = useState(false);
  const [composerLinkReady, setComposerLinkReady] = useState(false);
  const pendingEvolutionTokenRef = useRef("");
  const syncedLogoRef = useRef(null);
  const importingLinksRef = useRef(new Set());
  const importingRequestsRef = useRef(new Set());
  const shareLinksRef = useRef([]);
  const shareBusyRef = useRef(false);

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
      setUserProfile(null);
      setIsProfileModalOpen(false);
      setProfileForm(buildEmptyUserProfile());
      setProfileMessage("");
      setProfileError("");
      setClientSearchTerm("");
      setClientSexFilter("all");
      setClientSortMode("name_asc");
      setAnamneseForm(buildEmptyAnamnese());
      setAnamneseSnapshot(buildEmptyAnamnese());
      setIsEditingAnamnese(false);
      setClientHasAnamnese(false);
      setCheckpoints([]);
      setPhotoAnalyses([]);
      setPhotoForm(buildEmptyPhotoAnalysis());
      setDraftPhotos([]);
      setPhotoMessage("");
      setShareLinks([]);
      setShareNotice(null);
      setShareBusy("");
      setEvolutionDraft({ highlight: "", comments: "", homeCare: "" });
      setIsEvolutionComposerOpen(false);
      setAgendaNotice("");
      setFeedbackCopyId("");
      feedbackCopyRef.current = false;
      setFirstContactBusy(false);
      setBookingReview(null);
      setBookingNotice("");
      setBookingWhatsAppUrl("");
      setAgendaClosures([]);
      setOffError("");
      setIsAgendaOffOpen(false);
      publishedAvailabilityRef.current = "";
      availabilityQueueRef.current = Promise.resolve();
      importingLinksRef.current.clear();
      importingRequestsRef.current.clear();
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

    const shareLinksCollection = collection(db, "users", user.uid, "shareLinks");
    const unsubscribeShareLinks = onSnapshot(shareLinksCollection, (snapshot) => {
      const links = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setShareLinks(links);
    });

    const closuresCollection = collection(db, "users", user.uid, "agendaClosures");
    const unsubscribeClosures = onSnapshot(closuresCollection, (snapshot) => {
      setAgendaClosures(snapshot.docs.map((item) => {
        const closure = normalizeClosure(item.data());
        return closure ? { ...closure, id: item.id } : null;
      }).filter(Boolean));
    });

    return () => {
      unsubscribeClients();
      unsubscribeServices();
      unsubscribeAppointments();
      unsubscribeShareLinks();
      unsubscribeClosures();
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    const tokens = shareLinks
      .filter((link) => link.type === "primeiro" && link.id)
      .map((link) => link.id)
      .sort();
    if (!tokens.length) {
      return undefined;
    }
    const availability = buildAvailability(agendaClosures, localTodayIso());
    const key = JSON.stringify({ tokens, availability });
    if (publishedAvailabilityRef.current === key) {
      return undefined;
    }
    availabilityQueueRef.current = availabilityQueueRef.current
      .catch(() => {})
      .then(async () => {
        if (publishedAvailabilityRef.current === key) {
          return;
        }
        await publishAgendaAvailability(tokens, availability);
        publishedAvailabilityRef.current = key;
      });
    return undefined;
  }, [user, shareLinks, agendaClosures]);

  useEffect(() => {
    if (activeTab !== TABS.AGENDA && isAgendaOffOpen) {
      setIsAgendaOffOpen(false);
    }
  }, [activeTab, isAgendaOffOpen]);

  useEffect(() => {
    if (!isAgendaOffOpen) {
      return undefined;
    }
    const onKey = (event) => {
      if (event.key === "Escape" && !offBusy) {
        setIsAgendaOffOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isAgendaOffOpen, offBusy]);

  useEffect(() => {
    if (!selectedClientId) {
      return;
    }
    setCheckpointForm((previous) => ({
      ...previous,
      sessionNumber: String(getNextSessionNumber(checkpoints))
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
      setPhotoAnalyses([]);
      setPhotoForm(buildEmptyPhotoAnalysis());
      setDraftPhotos([]);
      setPhotoMessage("");
    }
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const profileRef = doc(db, "users", user.uid, "settings", "profile");
    const unsubscribe = onSnapshot(profileRef, (snapshot) => {
      if (!snapshot.exists()) {
        setUserProfile(null);
        return;
      }
      setUserProfile({ id: snapshot.id, ...snapshot.data() });
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    applyClinicIcon(userProfile?.logoDataUrl || "");
  }, [userProfile?.logoDataUrl]);

  useEffect(() => {
    if (!user || !userProfile) {
      if (!user) {
        syncedLogoRef.current = null;
      }
      return undefined;
    }
    const logo = sanitizeLogoDataUrl(userProfile.logoDataUrl);
    if (syncedLogoRef.current === logo) {
      return undefined;
    }
    syncedLogoRef.current = logo;
    let active = true;
    syncClinicLogo(user.uid, logo).catch((error) => {
      console.error(error);
      if (active && syncedLogoRef.current === logo) {
        syncedLogoRef.current = null;
      }
    });
    return () => {
      active = false;
    };
  }, [user, userProfile]);

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

  const selectedClientLinks = useMemo(
    () => shareLinks
      .filter((link) => link.clientId === selectedClientId)
      .sort((first, second) => linkSortTime(second) - linkSortTime(first)),
    [shareLinks, selectedClientId]
  );
  const anamneseLinks = useMemo(
    () => selectedClientLinks.filter((link) => link.type === "anamnese"),
    [selectedClientLinks]
  );
  const answeredAnamneseLink = useMemo(
    () => anamneseLinks.find((link) => link.imported || link.respondedAt || link.status === "importado" || link.status === "respondido") || null,
    [anamneseLinks]
  );
  const anamneseLinkIds = useMemo(
    () => anamneseLinks.map((link) => link.id).filter(Boolean).sort().join(","),
    [anamneseLinks]
  );
  const [clientAnamneseAnswer, setClientAnamneseAnswer] = useState(null);
  const followupLinks = useMemo(
    () => selectedClientLinks.filter((link) => link.type === "acompanhamento"),
    [selectedClientLinks]
  );
  const evolutionLink = useMemo(
    () => selectedClientLinks.find((link) => link.type === "evolucao") || null,
    [selectedClientLinks]
  );
  const consentLinks = useMemo(
    () => selectedClientLinks.filter((link) => link.type === "consentimento"),
    [selectedClientLinks]
  );

  useEffect(() => {
    pendingEvolutionTokenRef.current = "";
    setClientAnamneseAnswer(null);
  }, [selectedClientId]);

  useEffect(() => {
    if (!anamneseLinkIds) {
      setClientAnamneseAnswer(null);
      return undefined;
    }
    const stamps = new Map();
    const publish = () => {
      if (stamps.size === 0) {
        setClientAnamneseAnswer(null);
        return;
      }
      const latest = [...stamps.values()].sort((first, second) => getTimestampMillis(second) - getTimestampMillis(first))[0] || null;
      setClientAnamneseAnswer({ at: latest });
    };
    const unsubscribers = anamneseLinkIds.split(",").map((id) => onSnapshot(doc(db, "clientLinks", id), (snapshot) => {
      if (!snapshot.exists() || snapshot.data().status !== "respondido") {
        stamps.delete(id);
      } else {
        stamps.set(id, snapshot.data().submittedAt || snapshot.data().respondedAt || null);
      }
      publish();
    }));
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [anamneseLinkIds]);

  const pendingClientLinkIds = useMemo(
    () => shareLinks
      .filter((link) => !link.imported && link.status !== "importado" && (link.type === "anamnese" || link.type === "acompanhamento" || link.type === "consentimento"))
      .map((link) => link.id)
      .sort()
      .join(","),
    [shareLinks]
  );

  useEffect(() => {
    shareLinksRef.current = shareLinks;
  }, [shareLinks]);

  useEffect(() => {
    if (!user || !pendingClientLinkIds) {
      return undefined;
    }
    const unsubscribers = pendingClientLinkIds.split(",").map((id) => onSnapshot(doc(db, "clientLinks", id), (snapshot) => {
      if (!snapshot.exists() || snapshot.data().status !== "respondido") {
        return;
      }
      if (importingLinksRef.current.has(id)) {
        return;
      }
      const link = shareLinksRef.current.find((item) => item.id === id);
      if (!link || link.imported) {
        return;
      }
      importingLinksRef.current.add(id);
      importSubmittedLink(user.uid, link, {
        defaultPain: getDefaultPainSelection,
        nextSession: getNextSessionNumber
      }).catch(() => {
        importingLinksRef.current.delete(id);
      });
    }));
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user, pendingClientLinkIds]);

  const firstContactTokenIds = useMemo(
    () => shareLinks
      .filter((link) => link.type === "primeiro")
      .map((link) => link.id)
      .sort()
      .join(","),
    [shareLinks]
  );

  const firstContactLink = useMemo(
    () => shareLinks
      .filter((link) => link.type === "primeiro")
      .sort((first, second) => linkSortTime(second) - linkSortTime(first))[0] || null,
    [shareLinks]
  );

  useEffect(() => {
    if (!user || !firstContactTokenIds) {
      return undefined;
    }
    const unsubscribers = firstContactTokenIds.split(",").map((token) => onSnapshot(
      collection(db, "clientLinks", token, "requests"),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "removed") {
            return;
          }
          const requestId = change.doc.id;
          if (importingRequestsRef.current.has(requestId)) {
            return;
          }
          importingRequestsRef.current.add(requestId);
          importFirstContactRequest(user.uid, token, requestId, change.doc.data()).catch((error) => {
            console.error(error);
            importingRequestsRef.current.delete(requestId);
          });
        });
      }
    ));
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user, firstContactTokenIds]);

  const lastAppointmentByClientName = useMemo(() => {
    const summaryMap = new Map();

    appointments.forEach((appointment) => {
      const nameKey = normalizeClientNameKey(appointment.client);
      if (!nameKey) {
        return;
      }
      const timestamp = getAppointmentDateTimeMillis(appointment);
      if (timestamp <= 0) {
        return;
      }
      const previous = summaryMap.get(nameKey);
      if (!previous || timestamp > previous.timestamp) {
        summaryMap.set(nameKey, {
          timestamp,
          date: appointment.date || "",
          time: appointment.time || ""
        });
      }
    });

    return summaryMap;
  }, [appointments]);

  const visibleClients = useMemo(() => {
    const normalizedSearch = clientSearchTerm.trim().toLowerCase();

    const filtered = clients.filter((client) => {
      if (clientSexFilter !== "all" && (client.sex || "") !== clientSexFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableFields = [client.name, client.phone, client.email, client.address]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return searchableFields.some((value) => value.includes(normalizedSearch));
    });

    return [...filtered].sort((first, second) => {
      const firstName = String(first.name || "");
      const secondName = String(second.name || "");
      const firstLastAppointment =
        lastAppointmentByClientName.get(normalizeClientNameKey(firstName))?.timestamp || 0;
      const secondLastAppointment =
        lastAppointmentByClientName.get(normalizeClientNameKey(secondName))?.timestamp || 0;
      const firstHasAppointment = firstLastAppointment > 0;
      const secondHasAppointment = secondLastAppointment > 0;

      if (clientSortMode === "name_desc") {
        return secondName.localeCompare(firstName, "pt-BR", { sensitivity: "base" });
      }

      if (
        clientSortMode === "last_appointment_desc" ||
        clientSortMode === "last_appointment_asc"
      ) {
        if (firstHasAppointment !== secondHasAppointment) {
          return firstHasAppointment ? -1 : 1;
        }
        if (firstHasAppointment && secondHasAppointment && firstLastAppointment !== secondLastAppointment) {
          return clientSortMode === "last_appointment_desc"
            ? secondLastAppointment - firstLastAppointment
            : firstLastAppointment - secondLastAppointment;
        }
      }

      if (clientSortMode === "updated_desc" || clientSortMode === "updated_asc") {
        const firstTime = getTimestampMillis(first.updatedAt || first.createdAt);
        const secondTime = getTimestampMillis(second.updatedAt || second.createdAt);
        const difference = firstTime - secondTime;

        if (difference !== 0) {
          return clientSortMode === "updated_desc" ? -difference : difference;
        }
      }

      return firstName.localeCompare(secondName, "pt-BR", { sensitivity: "base" });
    });
  }, [clients, clientSearchTerm, clientSexFilter, clientSortMode, lastAppointmentByClientName]);

  useEffect(() => {
    if (!user || !selectedClient) {
      setAnamneseForm(buildEmptyAnamnese(selectedClient));
      setAnamneseSnapshot(buildEmptyAnamnese(selectedClient));
      setIsEditingAnamnese(false);
      setClientHasAnamnese(false);
      setCheckpoints([]);
      setTrackingParameters([]);
      setParameterForm(emptyParameterForm());
      setParameterError("");
      setIsParameterEditorOpen(false);
      setPhotoAnalyses([]);
      setPhotoForm(buildEmptyPhotoAnalysis());
      setDraftPhotos([]);
      setPhotoMessage("");
      return undefined;
    }

    setIsEditingAnamnese(true);

    const anamneseRef = doc(db, "users", user.uid, "anamneses", selectedClient.id);
    const checkpointsRef = collection(db, "users", user.uid, "anamneses", selectedClient.id, "checkpoints");
    const parametersRef = collection(db, "users", user.uid, "anamneses", selectedClient.id, "parameters");
    const photoAnalysesRef = collection(
      db,
      "users",
      user.uid,
      "anamneses",
      selectedClient.id,
      "photoAnalyses"
    );

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
      setIsEditingAnamnese(true);
    });

    const unsubscribeCheckpoints = onSnapshot(checkpointsRef, (snapshot) => {
      const loaded = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setCheckpoints(sortByDate(loaded));
    });

    const unsubscribeParameters = onSnapshot(parametersRef, (snapshot) => {
      const loaded = snapshot.docs
        .map((item) => normalizeParameter(item.id, item.data()))
        .filter(Boolean);
      loaded.sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
      setTrackingParameters(loaded);
    });

    const unsubscribePhotoAnalyses = onSnapshot(photoAnalysesRef, (snapshot) => {
      const loaded = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setPhotoAnalyses(sortByDate(loaded));
    });

    return () => {
      unsubscribeAnamnese();
      unsubscribeCheckpoints();
      unsubscribeParameters();
      unsubscribePhotoAnalyses();
    };
  }, [user, selectedClient]);

  const linkingPhotoIdsRef = useRef(new Set());
  const linkingClientIdRef = useRef("");

  useEffect(() => {
    const clientId = selectedClient?.id || "";
    if (linkingClientIdRef.current !== clientId) {
      linkingClientIdRef.current = clientId;
      linkingPhotoIdsRef.current = new Set();
    }
    if (!user || !selectedClient || checkpoints.length === 0 || photoAnalyses.length === 0) {
      return;
    }

    const checkpointsByDate = new Map();
    checkpoints.forEach((checkpoint) => {
      if (isClientFeedback(checkpoint)) {
        return;
      }
      const matches = checkpointsByDate.get(checkpoint.date) || [];
      matches.push(checkpoint);
      checkpointsByDate.set(checkpoint.date, matches);
    });

    photoAnalyses.forEach((photo) => {
      if (photo.checkpointId || linkingPhotoIdsRef.current.has(photo.id)) {
        return;
      }
      const matches = checkpointsByDate.get(photo.date) || [];
      if (matches.length !== 1) {
        return;
      }
      linkingPhotoIdsRef.current.add(photo.id);
      updateDoc(
        doc(db, "users", user.uid, "anamneses", selectedClient.id, "photoAnalyses", photo.id),
        {
          checkpointId: matches[0].id,
          updatedAt: serverTimestamp()
        }
      ).catch(() => {
        linkingPhotoIdsRef.current.delete(photo.id);
      });
    });
  }, [user, selectedClient, checkpoints, photoAnalyses]);

  const formattedUserName = useMemo(() => {
    if (!user?.email) {
      return "";
    }
    return user.email.split("@")[0];
  }, [user]);

  const currentUserDisplayName = useMemo(() => {
    if (userProfile?.fullName && userProfile.fullName.trim()) {
      return userProfile.fullName.trim();
    }
    return formattedUserName;
  }, [userProfile, formattedUserName]);

  const currentClinicName = useMemo(() => {
    if (userProfile?.clinicName && userProfile.clinicName.trim()) {
      return userProfile.clinicName.trim();
    }
    return "Clínica Estética";
  }, [userProfile]);

  const publishShareNotice = (scope, text, tone = "success") => {
    setShareNotice({ scope, text, tone });
  };

  const copyShareLink = async (token, scope) => {
    const url = shareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      publishShareNotice(scope, "Link copiado.");
    } catch (copyError) {
      publishShareNotice(scope, "Não foi possível copiar.", "error");
    }
  };

  const handleCreateClientLink = async (type, moment = "") => {
    if (!user || !selectedClient || shareBusyRef.current) {
      return;
    }
    const scope = type === "anamnese"
      ? "anamnese"
      : type === "evolucao"
        ? "charts"
        : type === "consentimento"
          ? "consent"
          : "followup";
    const busyKey = type === "acompanhamento" ? `followup-${moment}` : scope;
    shareBusyRef.current = true;
    setShareBusy(busyKey);
    try {
      const token = await createShareLink({
        uid: user.uid,
        client: selectedClient,
        clinicName: currentClinicName,
        type,
        moment,
        comments: type === "evolucao" ? evolutionDraft.comments : "",
        highlight: type === "evolucao" ? evolutionDraft.highlight : "",
        homeCare: type === "evolucao" ? evolutionDraft.homeCare : "",
        checkpoints: type === "evolucao" ? checkpoints : [],
        instagram: type === "evolucao" ? userProfile?.instagram || "" : "",
        logoDataUrl: userProfile?.logoDataUrl || ""
      });
      if (type === "evolucao") {
        pendingEvolutionTokenRef.current = token;
        setComposerLinkReady(true);
      }
      publishShareNotice(scope, "Link novo gerado.");
    } catch (createError) {
      publishShareNotice(scope, createError.message || "Não foi possível gerar o link.", "error");
    } finally {
      shareBusyRef.current = false;
      setShareBusy("");
    }
  };

  const openEvolutionComposer = () => {
    if (!phoneKey(selectedClient?.phone)) {
      return;
    }
    setEvolutionDraft(sanitizeEvolutionStory({
      highlight: evolutionLink?.highlight || "",
      comments: evolutionLink?.comments || "",
      homeCare: evolutionLink?.homeCare || ""
    }));
    setShareNotice(null);
    setComposerLinkReady(Boolean(evolutionLink || pendingEvolutionTokenRef.current));
    setIsRecordMenuOpen(false);
    setIsEvolutionComposerOpen(true);
  };

  const handleUpdateEvolution = async (event) => {
    event?.preventDefault?.();
    if (!user || !selectedClient || shareBusyRef.current) {
      return;
    }
    const story = sanitizeEvolutionStory(evolutionDraft);
    const token = evolutionLink?.id || pendingEvolutionTokenRef.current;
    if (!token) {
      await handleCreateClientLink("evolucao");
      return;
    }
    shareBusyRef.current = true;
    setShareBusy("charts");
    try {
      await updateEvolutionLink({
        uid: user.uid,
        token,
        phone: selectedClient.phone,
        comments: story.comments,
        highlight: story.highlight,
        homeCare: story.homeCare,
        checkpoints,
        clinicName: currentClinicName,
        clientName: selectedClient.name,
        instagram: userProfile?.instagram || ""
      });
      publishShareNotice("charts", "Link atualizado. A cliente já vê essas informações.");
    } catch (updateError) {
      publishShareNotice("charts", updateError.message || "Não foi possível atualizar o link.", "error");
    } finally {
      shareBusyRef.current = false;
      setShareBusy("");
    }
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");

    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        const defaultName = authEmail.split("@")[0];
        await setDoc(
          doc(db, "users", userCredential.user.uid, "settings", "profile"),
          {
            fullName: defaultName,
            clinicName: "Clínica Estética",
            phone: "",
            professionalRole: "",
            instagram: "",
            tiktok: "",
            facebook: "",
            website: "",
            email: authEmail,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      }

      setAuthEmail("");
      setAuthPassword("");
    } catch (error) {
      setAuthError("Não foi possível concluir a autenticação. Verifique os dados.");
    }
  };

  const handleOpenProfileModal = () => {
    setProfileError("");
    setProfileMessage("");
    setProfileForm({
      fullName: userProfile?.fullName || formattedUserName || "",
      clinicName: userProfile?.clinicName || "Clínica Estética",
      phone: formatPhoneBr(userProfile?.phone || ""),
      professionalRole: userProfile?.professionalRole || "",
      instagram: socialHandle(userProfile?.instagram, "instagram.com"),
      tiktok: socialHandle(userProfile?.tiktok, "tiktok.com"),
      facebook: String(userProfile?.facebook || "").trim().slice(0, 80),
      website: String(userProfile?.website || "").trim().slice(0, 120),
      logoDataUrl: String(userProfile?.logoDataUrl || "").startsWith("data:image/") ? userProfile.logoDataUrl : "",
      whatsappMessage: String(userProfile?.whatsappMessage || "").slice(0, 500)
    });
    setIsProfileModalOpen(true);
  };

  const handleCloseProfileModal = () => {
    setIsProfileModalOpen(false);
    setProfileError("");
    setProfileMessage("");
  };

  const handleProfileFieldChange = (fieldName, value) => {
    setProfileForm((previous) => ({ ...previous, [fieldName]: value }));
  };

  const handleProfileLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setProfileError("Escolha uma imagem para a logo.");
      return;
    }
    try {
      const logoDataUrl = await compressLogoFile(file);
      setProfileError("");
      handleProfileFieldChange("logoDataUrl", logoDataUrl);
    } catch (logoError) {
      setProfileError("Não foi possível usar essa imagem.");
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (!user) {
      return;
    }
    if (!profileForm.fullName.trim()) {
      setProfileError("Informe seu nome para salvar o cadastro.");
      return;
    }

    setProfileError("");
    const profileRef = doc(db, "users", user.uid, "settings", "profile");
    const payload = {
      fullName: profileForm.fullName.trim(),
      clinicName: profileForm.clinicName.trim() || "Clínica Estética",
      phone: profileForm.phone.trim(),
      professionalRole: profileForm.professionalRole.trim(),
      instagram: socialHandle(profileForm.instagram, "instagram.com"),
      tiktok: socialHandle(profileForm.tiktok, "tiktok.com"),
      facebook: profileForm.facebook.trim().slice(0, 80),
      website: profileForm.website.trim().replace(/\s+/g, "").slice(0, 120),
      logoDataUrl: String(profileForm.logoDataUrl || "").startsWith("data:image/") ? profileForm.logoDataUrl : "",
      whatsappMessage: String(profileForm.whatsappMessage || "").trim().slice(0, 500),
      email: user.email || "",
      updatedAt: serverTimestamp()
    };

    await setDoc(
      profileRef,
      {
        ...payload,
        ...(userProfile ? {} : { createdAt: serverTimestamp() })
      },
      { merge: true }
    );
    try {
      await syncEvolutionInstagram(user.uid, payload.instagram);
    } catch {
      setProfileMessage("Cadastro salvo. Abra a evolução da cliente e toque em atualizar para o Instagram entrar na imagem.");
      return;
    }

    setProfileMessage(userProfile ? "Cadastro atualizado com sucesso." : "Cadastro criado com sucesso.");
    setTimeout(() => {
      setIsProfileModalOpen(false);
      setProfileMessage("");
    }, 1200);
  };

  const handleDeleteProfile = async () => {
    if (!user || !userProfile) {
      return;
    }

    const confirmed = window.confirm(
      "Deseja excluir seu cadastro de perfil? Essa ação remove os dados de perfil do cabeçalho."
    );
    if (!confirmed) {
      return;
    }

    await deleteDoc(doc(db, "users", user.uid, "settings", "profile"));
    setProfileMessage("Cadastro removido com sucesso.");
    setTimeout(() => {
      setIsProfileModalOpen(false);
      setProfileMessage("");
    }, 1000);
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

    const savedName = clientName.trim();
    resetClientForm();
    if (appointmentAwaitingClient) {
      setAppointmentClient(savedName);
      setAppointmentAwaitingClient(false);
      setIsAppointmentClientListOpen(false);
      setAppointmentClientNotice("");
    }
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
    setSelectedClientId("");
    setSelectedClientView(null);
  };

  const handleEditClient = (client) => {
    setClientName(client.name || "");
    setClientPhone(formatPhoneBr(client.phone || ""));
    setClientEmail(client.email || "");
    setClientBirthDate(client.birthDate || "");
    setClientSex(client.sex || "");
    setClientAddress(client.address || "");
    setEditingClientId(client.id);
    setIsClientFormOpen(true);
    setClientFormMessage("");
    setOpenClientMenuId("");
    setSelectedClientId("");
    setSelectedClientView(null);
  };

  const handleOpenClientModal = (clientId) => {
    if (isClientFormOpen) {
      return;
    }
    setSelectedClientId(clientId);
    setSelectedClientView(CLIENT_VIEWS.ANAMNESE);
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
    setFollowupScreen("list");
    setSelectedCheckpointId("");
    setIsPhotoComposerOpen(false);
    setIsRecordMenuOpen(false);
    setIsEvolutionComposerOpen(false);
    setIsParameterEditorOpen(false);
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

  const normalizedAppointmentClientName = appointmentClient.trim().toLowerCase();
  const appointmentClientSuggestions = clients
    .filter((client) => {
      const clientName = (client.name || "").trim().toLowerCase();
      if (!clientName) {
        return false;
      }
      return !normalizedAppointmentClientName || clientName.includes(normalizedAppointmentClientName);
    })
    .slice(0, 6);

  const startAppointmentClientRegistration = () => {
    setClientName(appointmentClient.trim());
    setClientPhone("");
    setClientEmail("");
    setClientBirthDate("");
    setClientSex("");
    setClientAddress("");
    setEditingClientId("");
    setClientFormMessage("");
    setAppointmentAwaitingClient(true);
    setIsAppointmentClientListOpen(false);
    setIsClientFormOpen(true);
  };

  const createAppointmentClient = (rawName) => {
    const name = rawName.trim();
    const normalizedName = name.toLowerCase();
    if (!user || !name) {
      return Promise.resolve(false);
    }

    const alreadySaved =
      savedAppointmentClientNames.includes(normalizedName) ||
      clients.some((client) => (client.name || "").trim().toLowerCase() === normalizedName);
    if (alreadySaved) {
      setAppointmentClient(name);
      return Promise.resolve(true);
    }

    const pendingCreate = clientCreatePromisesRef.current.get(normalizedName);
    if (pendingCreate) {
      return pendingCreate;
    }

    const createPromise = (async () => {
      setIsCreatingAppointmentClient(true);
      setSavedAppointmentClientNames((previous) =>
        previous.includes(normalizedName) ? previous : [...previous, normalizedName]
      );
      try {
        await addDoc(collection(db, "users", user.uid, "clients"), {
          name,
          phone: "",
          email: "",
          birthDate: "",
          sex: "",
          address: "",
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        setAppointmentClient(name);
        setAppointmentClientNotice("Cliente adicionada. Os outros dados podem ser preenchidos depois.");
        setIsAppointmentClientListOpen(false);
        return true;
      } catch {
        setSavedAppointmentClientNames((previous) =>
          previous.filter((savedName) => savedName !== normalizedName)
        );
        setAppointmentClientNotice("Não foi possível adicionar a cliente.");
        return false;
      } finally {
        setIsCreatingAppointmentClient(false);
        clientCreatePromisesRef.current.delete(normalizedName);
      }
    })();

    clientCreatePromisesRef.current.set(normalizedName, createPromise);
    return createPromise;
  };

  const handleAddAppointment = async (event) => {
    event.preventDefault();
    const clientName = appointmentClient.trim();
    if (!user || !clientName || !appointmentService.trim() || !appointmentDate) {
      return;
    }

    const rawServiceName = appointmentService.trim();
    const serviceName =
      rawServiceName.toLowerCase() === UNDETERMINED_SERVICE_LABEL.toLowerCase()
        ? UNDETERMINED_SERVICE_LABEL
        : rawServiceName;
    const clientReady = await createAppointmentClient(clientName);
    if (!clientReady) {
      return;
    }

    const serviceReady = await createAppointmentService(serviceName);
    if (!serviceReady) {
      return;
    }

    await addDoc(collection(db, "users", user.uid, "appointments"), {
      client: clientName,
      service: serviceName,
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
    setAppointmentClientNotice("");
    setAppointmentServiceNotice("");
    setIsAppointmentClientListOpen(false);
    setIsAppointmentServiceListOpen(false);
    setAgendaSelectedDate(appointmentDate);
    setAgendaVisibleMonth(
      new Date(parseIsoDate(appointmentDate).getFullYear(), parseIsoDate(appointmentDate).getMonth(), 1)
    );
    setIsAppointmentModalOpen(false);
  };

  const createAppointmentService = (rawTitle) => {
    const title = rawTitle.trim();
    const normalizedTitle = title.toLowerCase();
    if (!user || !title) {
      return Promise.resolve(false);
    }

    if (normalizedTitle === UNDETERMINED_SERVICE_LABEL.toLowerCase()) {
      setAppointmentService(UNDETERMINED_SERVICE_LABEL);
      setIsAppointmentServiceListOpen(false);
      return Promise.resolve(true);
    }

    const alreadySaved =
      savedAppointmentServiceTitles.includes(normalizedTitle) ||
      services.some((service) => (service.title || "").trim().toLowerCase() === normalizedTitle);
    if (alreadySaved) {
      setAppointmentService(title);
      return Promise.resolve(true);
    }

    const pendingCreate = serviceCreatePromisesRef.current.get(normalizedTitle);
    if (pendingCreate) {
      return pendingCreate;
    }

    const createPromise = (async () => {
      setIsCreatingAppointmentService(true);
      setSavedAppointmentServiceTitles((previous) =>
        previous.includes(normalizedTitle) ? previous : [...previous, normalizedTitle]
      );
      try {
        await addDoc(collection(db, "users", user.uid, "services"), {
          title,
          price: 0,
          createdAt: serverTimestamp()
        });
        setAppointmentService(title);
        setAppointmentServiceNotice("Serviço adicionado. O preço pode ser preenchido depois.");
        setIsAppointmentServiceListOpen(false);
        return true;
      } catch {
        setSavedAppointmentServiceTitles((previous) =>
          previous.filter((savedTitle) => savedTitle !== normalizedTitle)
        );
        setAppointmentServiceNotice("Não foi possível adicionar o serviço.");
        return false;
      } finally {
        setIsCreatingAppointmentService(false);
        serviceCreatePromisesRef.current.delete(normalizedTitle);
      }
    })();

    serviceCreatePromisesRef.current.set(normalizedTitle, createPromise);
    return createPromise;
  };

  const handleDeleteByCollection = async (collectionName, itemId) => {
    if (!user) {
      return;
    }

    if (collectionName === "appointments") {
      const appointment = appointments.find((item) => item.id === itemId);
      if (appointment?.shareToken && appointment?.requestId) {
        await updateDoc(doc(db, "clientLinks", appointment.shareToken, "requests", appointment.requestId), {
          hidden: true
        }).catch(() => {});
        if (bookingReview?.id === itemId) {
          closeBookingReview();
        }
      }
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

  const handleExportAnamnesePdf = async () => {
    if (!selectedClient) {
      return;
    }

    const normalizedAnamnese = normalizeAnamneseRecord(anamneseForm, selectedClient);
    const painSelectionsDescription = normalizePainSelections(normalizedAnamnese.painSelections).map(
      (selection) =>
        `${selection.label} (${formatPainSelectionLocation(selection, true)} - ${formatLateralityLabel(
          selection.laterality
        )})`
    );

    const sections = [
      {
        title: "Dados da cliente",
        rows: [
          ["Nome", formatTextOrFallback(selectedClient.name)],
          ["Telefone", selectedClient.phone ? formatPhoneBr(selectedClient.phone) : "Não informado"],
          ["E-mail", formatTextOrFallback(selectedClient.email)],
          [
            "Data de nascimento",
            selectedClient.birthDate ? formatDatePt(selectedClient.birthDate) : "Não informado"
          ],
          ["Sexo", formatSexLabel(selectedClient.sex)],
          ["Endereço", formatTextOrFallback(selectedClient.address)]
        ]
      },
      {
        title: "Círculo das dores principais",
        rows: [
          ["Regiões marcadas", formatListOrFallback(painSelectionsDescription)],
          ["Intensidade da dor (0 a 10)", formatTextOrFallback(normalizedAnamnese.painScale)]
        ]
      },
      {
        title: "Perguntas-chave",
        rows: [
          [
            "Dor em ponto específico ou irradiada",
            formatChoiceLabel(PAIN_RADIATION_OPTIONS, normalizedAnamnese.painRadiatesOption)
          ],
          [
            "Detalhes de localização/irradiação",
            formatTextOrFallback(normalizedAnamnese.painRadiatesDetails)
          ],
          ["Primeiro episódio", formatTextOrFallback(normalizedAnamnese.firstPainEpisode)],
          ["Tipos de dor", formatListOrFallback(normalizedAnamnese.painTypeOptions)],
          ["Outro tipo de dor", formatTextOrFallback(normalizedAnamnese.painTypeOther)],
          ["Situações com maior dor", formatListOrFallback(normalizedAnamnese.painTriggerOptions)],
          ["Outra situação que piora", formatTextOrFallback(normalizedAnamnese.painTriggerOther)],
          ["Objetivo principal", formatChoiceLabel(GOAL_OPTIONS, normalizedAnamnese.goalOption)],
          ["Detalhes do objetivo", formatTextOrFallback(normalizedAnamnese.goalDetails)],
          ["Pratica esporte?", formatYesNo(normalizedAnamnese.playsSport)],
          ["Esportes", formatListOrFallback(normalizedAnamnese.sportOptions)],
          ["Outro esporte", formatTextOrFallback(normalizedAnamnese.sportOther)],
          ["Já fez outro tratamento/massagem?", formatYesNo(normalizedAnamnese.hadPreviousTreatment)],
          [
            "Tratamentos anteriores",
            formatListOrFallback(normalizedAnamnese.previousTreatmentTypes)
          ],
          [
            "Experiência em tratamentos anteriores",
            formatTextOrFallback(normalizedAnamnese.previousTreatmentExperience)
          ],
          ["Objetivos estéticos", formatListOrFallback(normalizedAnamnese.aestheticGoalOptions)],
          ["Outro objetivo estético", formatTextOrFallback(normalizedAnamnese.aestheticGoalsOther)],
          ["Hábitos que contribuem para dor", formatListOrFallback(normalizedAnamnese.habitOptions)],
          ["Outros hábitos", formatTextOrFallback(normalizedAnamnese.habitsContributingOther)]
        ]
      },
      {
        title: "Condições de saúde",
        rows: [
          ["Condições selecionadas", formatListOrFallback(normalizedAnamnese.healthConditions)],
          ["Outras observações de saúde", formatTextOrFallback(normalizedAnamnese.healthOther)]
        ]
      }
    ];

    if (selectedClient.sex === "female") {
      sections.push({
        title: "Para mulheres",
        rows: [
          ["Período menstrual", formatTextOrFallback(normalizedAnamnese.menstrualPeriod)],
          ["Gestante?", formatYesNo(normalizedAnamnese.pregnant)],
          ["Tempo de gestação", formatTextOrFallback(normalizedAnamnese.gestatingTime)],
          ["Lactante?", formatYesNo(normalizedAnamnese.lactating)]
        ]
      });
    }

    sections.push({
      title: "Conclusão da ficha",
      rows: [
        ["Área com mais atenção", formatTextOrFallback(normalizedAnamnese.bodyFocus)],
        ["Observações gerais", formatTextOrFallback(normalizedAnamnese.observations)],
        ["Assinatura (nome)", formatTextOrFallback(normalizedAnamnese.signatureName)]
      ]
    });

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 36;
      const labelWidth = 170;
      const valueX = margin + labelWidth + 14;
      const valueWidth = pageWidth - margin - valueX;
      const rowPadding = 6;
      let y = margin;

      const ensureSpace = (neededHeight) => {
        if (y + neededHeight <= pageHeight - margin) {
          return;
        }
        doc.addPage();
        y = margin;
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("Ficha de Anamnese", margin, y);
      y += 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90, 105, 115);
      doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, y);
      doc.setTextColor(22, 37, 43);
      y += 18;
      doc.setDrawColor(210, 220, 230);
      doc.line(margin, y, pageWidth - margin, y);
      y += 16;

      sections.forEach((section) => {
        ensureSpace(28);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(section.title, margin, y);
        y += 14;

        section.rows.forEach(([label, rawValue]) => {
          const value = String(rawValue || "Não informado");
          const labelLines = doc.splitTextToSize(label, labelWidth);
          const valueLines = doc.splitTextToSize(value, valueWidth);
          const linesCount = Math.max(labelLines.length, valueLines.length);
          const rowHeight = linesCount * 14 + rowPadding * 2;

          ensureSpace(rowHeight + 6);
          doc.setDrawColor(224, 231, 238);
          doc.rect(margin, y - 11, pageWidth - margin * 2, rowHeight);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(labelLines, margin + rowPadding, y + rowPadding);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.text(valueLines, valueX, y + rowPadding);

          y += rowHeight + 4;
        });

        y += 8;
      });

      const normalizedClientName = normalizeFileName(selectedClient.name || "cliente");
      doc.save(`anamnese-${normalizedClientName}.pdf`);
    } catch (error) {
      setAnamneseMessage("Não foi possível gerar o PDF agora. Tente novamente.");
      setTimeout(() => setAnamneseMessage(""), 3500);
    }
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
    setCheckpointError("");
    setCheckpointForm((previous) => ({ ...previous, [fieldName]: value }));
  };

  const openParameterEditor = () => {
    setParameterError("");
    setParameterForm(emptyParameterForm());
    setIsParameterEditorOpen(true);
  };

  const closeParameterEditor = () => {
    if (parameterBusy) {
      return;
    }
    setParameterError("");
    setIsParameterEditorOpen(false);
  };

  const handleParameterFieldChange = (patch) => {
    setParameterError("");
    setParameterForm((previous) => ({ ...previous, ...patch }));
  };

  const handleAddParameter = async (event) => {
    event.preventDefault();
    if (!user || !selectedClient || parameterBusy) {
      return;
    }
    const result = validateParameter(parameterForm, trackingParameters);
    if (result.error) {
      setParameterError(result.error);
      return;
    }
    setParameterBusy(true);
    setParameterError("");
    try {
      await addDoc(collection(db, "users", user.uid, "anamneses", selectedClient.id, "parameters"), {
        ...result.parameter,
        createdAt: serverTimestamp()
      });
      setParameterForm(emptyParameterForm());
      setIsParameterEditorOpen(false);
    } catch (parameterSaveError) {
      setParameterError("Não foi possível salvar o parâmetro. Tente novamente.");
    } finally {
      setParameterBusy(false);
    }
  };

  const handleRemoveParameter = async (parameterId) => {
    if (!user || !selectedClient || parameterBusy) {
      return;
    }
    setParameterBusy(true);
    setParameterError("");
    try {
      await deleteDoc(doc(db, "users", user.uid, "anamneses", selectedClient.id, "parameters", parameterId));
    } catch (parameterDeleteError) {
      setParameterError("Não foi possível remover o parâmetro. Tente novamente.");
    } finally {
      setParameterBusy(false);
    }
  };

  const handleAddCheckpoint = async (event) => {
    event.preventDefault();
    if (!user || !selectedClient || !checkpointForm.date || isSavingCheckpoint) {
      return;
    }

    let photosToSave = [...draftPhotos];
    if (photoDraftHasProgress(photoForm)) {
      const draftResult = buildPhotoDraft(photoForm);
      if (draftResult.error) {
        showPhotoFeedback(draftResult.error, "error");
        return;
      }
      photosToSave = [...photosToSave, draftResult.photo];
    }

    const parsedParameters = readingsFromForm(trackingParameters, checkpointForm.parameterValues);
    if (parsedParameters.error) {
      setCheckpointError(parsedParameters.error);
      return;
    }

    setIsSavingCheckpoint(true);
    setCheckpointError("");
    try {
      const batch = writeBatch(db);
      const checkpointRef = doc(
        collection(db, "users", user.uid, "anamneses", selectedClient.id, "checkpoints")
      );
      batch.set(checkpointRef, {
        date: checkpointForm.date,
        sessionNumber: checkpointForm.sessionNumber.trim() || String(getNextSessionNumber(checkpoints)),
        sessionType: checkpointForm.sessionType,
        painLevel: Number(checkpointForm.painLevel),
        stressLevel: Number(checkpointForm.stressLevel || 0),
        sleepHours: Number(checkpointForm.sleepHours || 0),
        observations: checkpointForm.observations.trim(),
        parameters: parsedParameters.readings,
        createdAt: serverTimestamp()
      });
      photosToSave.forEach((photo) => {
        const photoRef = doc(
          collection(db, "users", user.uid, "anamneses", selectedClient.id, "photoAnalyses")
        );
        batch.set(photoRef, toFirestorePhoto(photo, checkpointRef.id, checkpointForm.date));
      });
      await batch.commit();

      setCheckpointForm(buildEmptyCheckpoint());
      setDraftPhotos([]);
      setPhotoForm((previous) => ({
        ...buildEmptyPhotoAnalysis(),
        date: getTodayISODate()
      }));
      setIsPhotoComposerOpen(false);
      setFollowupScreen("list");
      setSelectedCheckpointId("");
      showPhotoFeedback(
        photosToSave.length > 0
          ? "Acompanhamento registrado com as fotos vinculadas."
          : "Acompanhamento registrado.",
        "success",
        2500
      );
    } catch (error) {
      showPhotoFeedback("Não foi possível salvar o acompanhamento com as fotos. Tente novamente.", "error");
    } finally {
      setIsSavingCheckpoint(false);
    }
  };

  const handleDeleteCheckpoint = async (checkpointId) => {
    if (!user || !selectedClient) {
      return;
    }
    const checkpoint = checkpoints.find((item) => item.id === checkpointId);
    const sameDateCount = checkpoint && !isClientFeedback(checkpoint)
      ? checkpoints.filter((item) => item.date === checkpoint.date && !isClientFeedback(item)).length
      : 0;
    const relatedPhotos = photoAnalyses.filter((photo) => {
      if (photo.checkpointId === checkpointId) {
        return true;
      }
      return Boolean(
        checkpoint && !photo.checkpointId && sameDateCount === 1 && photo.date === checkpoint.date
      );
    });
    const batch = writeBatch(db);
    batch.delete(doc(db, "users", user.uid, "anamneses", selectedClient.id, "checkpoints", checkpointId));
    relatedPhotos.forEach((photo) => {
      batch.delete(doc(db, "users", user.uid, "anamneses", selectedClient.id, "photoAnalyses", photo.id));
    });
    await batch.commit();
  };

  const handlePhotoFieldChange = (fieldName, value) => {
    setPhotoForm((previous) => ({ ...previous, [fieldName]: value }));
  };

  useEffect(() => {
    setPhotoForm((previous) => ({
      ...previous,
      date: checkpointForm.date || getTodayISODate()
    }));
  }, [checkpointForm.date]);

  const handlePhotoMeasurementTypeChange = (measurementType) => {
    setPhotoForm((previous) => ({
      ...previous,
      activeMeasurementType: measurementType,
      activePoints: []
    }));
  };

  const showPhotoFeedback = (message, tone = "success", duration = 3000) => {
    setPhotoMessage(message);
    setPhotoMessageTone(tone);
    setTimeout(() => setPhotoMessage(""), duration);
  };

  const handlePhotoFileSelect = async (file) => {
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      showPhotoFeedback("Selecione um arquivo de imagem.", "error");
      return;
    }

    try {
      const compressedImage = await compressImageFile(file);
      const replacedExisting = Boolean(photoForm.imageDataUrl);
      setPhotoForm((previous) => ({
        ...previous,
        imageDataUrl: compressedImage,
        measurements: [],
        activePoints: []
      }));
      showPhotoFeedback(
        replacedExisting
          ? "Foto substituída. As marcações desta edição foram reiniciadas."
          : "Foto carregada. Clique na imagem para marcar os pontos."
      );
    } catch (error) {
      showPhotoFeedback("Não foi possível carregar a foto. Tente outra imagem.", "error");
    }
  };

  const handlePhotoPointsChange = (points) => {
    setPhotoForm((previous) => {
      const measurement = buildMeasurement(previous.activeMeasurementType, points);
      if (!measurement) {
        return { ...previous, activePoints: points };
      }
      return {
        ...previous,
        measurements: [...previous.measurements, measurement],
        activePoints: []
      };
    });
  };

  const handleRemoveMeasurement = (measurementId) => {
    setPhotoForm((previous) => ({
      ...previous,
      measurements: previous.measurements.filter((item) => item.id !== measurementId)
    }));
  };

  const handleAddPhotoAnalysis = (event) => {
    event.preventDefault();
    if (!user || !selectedClient) {
      return;
    }
    const draftResult = buildPhotoDraft(photoForm);
    if (draftResult.error) {
      showPhotoFeedback(draftResult.error, "error");
      return;
    }

    setDraftPhotos((previous) => [...previous, draftResult.photo]);
    setPhotoForm((previous) => ({
      ...buildEmptyPhotoAnalysis(),
      date: checkpointForm.date || previous.date || getTodayISODate()
    }));
    setIsPhotoComposerOpen(false);
    showPhotoFeedback("Foto incluída neste acompanhamento. Ela será salva ao registrar.", "success", 2500);
  };

  const handleDeletePhotoAnalysis = async (analysisId) => {
    if (!user || !selectedClient) {
      return;
    }
    await deleteDoc(
      doc(db, "users", user.uid, "anamneses", selectedClient.id, "photoAnalyses", analysisId)
    );
  };

  const metricChartData = useMemo(() => {
    return sortByDate(checkpoints).filter((item) => item.date);
  }, [checkpoints]);

  const checkpointChartData = useMemo(() => {
    return metricChartData.filter((item) => !isClientFeedback(item));
  }, [metricChartData]);

  const parameterChartSeries = useMemo(
    () => parameterSeries(checkpointChartData, trackingParameters),
    [checkpointChartData, trackingParameters]
  );

  const photosByCheckpoint = useMemo(
    () => groupPhotosByCheckpoint(checkpoints, photoAnalyses),
    [checkpoints, photoAnalyses]
  );
  const sortedFollowups = useMemo(() => {
    return [...checkpoints].sort((first, second) => {
      const dateDiff = String(second.date || "").localeCompare(String(first.date || ""));
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return Number(second.sessionNumber || 0) - Number(first.sessionNumber || 0);
    });
  }, [checkpoints]);
  const activeFollowup = sortedFollowups.find((item) => item.id === selectedCheckpointId) || sortedFollowups[0] || null;
  const followupSessionCount = sortedFollowups.filter((item) => !isClientFeedback(item)).length;
  const followupFeedbackCount = sortedFollowups.length - followupSessionCount;

  const angleChartSeries = useMemo(() => {
    const groups = new Map();
    sortByDate(photoAnalyses).forEach((item) => {
      if (!item.date) {
        return;
      }
      const angles = getStoredMeasurements(item).filter(
        (measurement) => measurement.type === "angle" && Number.isFinite(Number(measurement.angleDegrees))
      );
      angles.forEach((measurement, index) => {
        const position = String(item.positionLabel || "posição").trim() || "posição";
        const pretty = position.charAt(0).toLowerCase() + position.slice(1);
        const label = index === 0 ? `Ângulo · ${pretty}` : `Ângulo ${index + 1} · ${pretty}`;
        const current = groups.get(`${position}::${index}`) || { label, points: [] };
        current.points.push({ date: item.date, value: Number(measurement.angleDegrees) });
        groups.set(`${position}::${index}`, current);
      });
    });
    return [...groups.values()];
  }, [photoAnalyses]);

  const isAnamneseViewOpen = selectedClientView === CLIENT_VIEWS.ANAMNESE;
  const isFollowupViewOpen = selectedClientView === CLIENT_VIEWS.FOLLOWUP;
  const isChartsViewOpen = selectedClientView === CLIENT_VIEWS.CHARTS;
  const isTermsViewOpen = selectedClientView === CLIENT_VIEWS.TERMS;

  const currentPhotoDraft = photoDraftHasProgress(photoForm) ? buildPhotoDraft(photoForm) : null;
  const pendingPhotoCount = draftPhotos.length + (currentPhotoDraft && !currentPhotoDraft.error ? 1 : 0);

  const todayIsoDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  const todayAppointments = appointments.filter((appointment) => appointmentAgendaDate(appointment) === todayIsoDate);
  const selectedAgendaDate = agendaSelectedDate || todayIsoDate;
  const selectedDayAppointments = appointments.filter((appointment) => appointmentAgendaDate(appointment) === selectedAgendaDate);
  const appointmentCountByDate = new Map();
  const pendingDates = new Set();
  appointments.forEach((appointment) => {
    const date = appointmentAgendaDate(appointment);
    if (!date) {
      return;
    }
    appointmentCountByDate.set(date, (appointmentCountByDate.get(date) || 0) + 1);
    if (appointment.status === "pendente" || appointment.status === "remarcacao") {
      pendingDates.add(date);
    }
  });
  const selectedWeekday = parseIsoDate(selectedAgendaDate).getDay();
  const selectedDayClosures = agendaClosures.filter((closure) => closureApplies(closure, selectedAgendaDate));
  const selectedDayAllDay = selectedDayClosures.find((closure) => closure.allDay && !closure.recurring);
  const selectedWeekAllDay = selectedDayClosures.find((closure) => closure.allDay && closure.recurring);
  const monthDays = buildMonthDays(agendaVisibleMonth);
  const visibleMonthLabel = MONTH_LABELS[agendaVisibleMonth.getMonth()];
  const monthTitle = `${visibleMonthLabel.charAt(0).toUpperCase()}${visibleMonthLabel.slice(1)} ${agendaVisibleMonth.getFullYear()}`;
  const selectedDayLabel = formatAgendaDayLabel(selectedAgendaDate);
  const agendaNavTitle = agendaMode === "month" ? monthTitle : selectedDayLabel;

  const openAgendaOff = () => {
    setOffError("");
    setOffMode("interval");
    setIsAgendaOffOpen(true);
  };

  const closeAgendaOff = () => {
    if (offBusy) {
      return;
    }
    setIsAgendaOffOpen(false);
  };

  const openAppointmentModal = () => {
    setAppointmentDate(selectedAgendaDate);
    setAppointmentClientNotice("");
    setAppointmentServiceNotice("");
    setIsAppointmentClientListOpen(false);
    setIsAppointmentServiceListOpen(false);
    setIsAppointmentModalOpen(true);
  };

  const closeAppointmentModal = () => {
    setIsAppointmentModalOpen(false);
    setIsAppointmentClientListOpen(false);
    setIsAppointmentServiceListOpen(false);
    setAppointmentAwaitingClient(false);
  };

  const openBookingReview = (appointment) => {
    setBookingReview(appointment);
    setRescheduleDate(appointment.suggestedDate || "");
    setRescheduleReason(appointment.rescheduleReason || "");
    setBookingNotice("");
    setBookingWhatsAppUrl("");
    setBookingBusy("");
  };

  const closeBookingReview = () => {
    setBookingReview(null);
    setBookingNotice("");
    setBookingWhatsAppUrl("");
    setBookingBusy("");
  };

  const saveAgendaClosure = async (closure) => {
    if (!user || offBusy) {
      return;
    }
    if (agendaClosures.length >= MAX_CLOSURES) {
      setOffError("Limite de bloqueios atingido.");
      return;
    }
    setOffBusy(true);
    setOffError("");
    try {
      await addDoc(collection(db, "users", user.uid, "agendaClosures"), closure);
      return true;
    } catch (error) {
      setOffError("Não foi possível salvar o bloqueio.");
      return false;
    } finally {
      setOffBusy(false);
    }
  };

  const removeAgendaClosure = async (closureId) => {
    if (!user || offBusy) {
      return;
    }
    setOffBusy(true);
    setOffError("");
    try {
      await deleteDoc(doc(db, "users", user.uid, "agendaClosures", closureId));
    } catch (error) {
      setOffError("Não foi possível remover o bloqueio.");
    } finally {
      setOffBusy(false);
    }
  };

  const handleAddAgendaOff = async () => {
    if (offMode === "day" || offMode === "weekday") {
      const recurring = offMode === "weekday";
      const existing = recurring ? selectedWeekAllDay : selectedDayAllDay;
      if (existing) {
        setOffError(recurring ? "Esse dia da semana já está bloqueado." : "Esse dia já está bloqueado.");
        return;
      }
      await saveAgendaClosure({
        allDay: true,
        recurring,
        date: recurring ? "" : selectedAgendaDate,
        weekday: selectedWeekday,
        start: "",
        end: ""
      });
      return;
    }
    const start = minutesOf(offStart);
    const end = minutesOf(offEnd);
    if (start == null || end == null) {
      setOffError("Informe o início e o fim do horário.");
      return;
    }
    if (start >= end) {
      setOffError("O fim precisa ser depois do início.");
      return;
    }
    const duplicate = selectedDayClosures.some((closure) => (
      !closure.allDay
      && closure.recurring === offRepeat
      && closure.start === offStart
      && closure.end === offEnd
    ));
    if (duplicate) {
      setOffError("Esse horário já está bloqueado.");
      return;
    }
    const saved = await saveAgendaClosure({
      allDay: false,
      recurring: offRepeat,
      date: offRepeat ? "" : selectedAgendaDate,
      weekday: selectedWeekday,
      start: offStart,
      end: offEnd
    });
    if (saved) {
      setOffStart("");
      setOffEnd("");
      setOffRepeat(false);
    }
  };

  const handleFirstContactLink = async () => {
    if (!user || firstContactBusy) {
      return;
    }
    const clinicPhone = phoneKey(userProfile?.phone);
    if (!/^\d{10,13}$/.test(clinicPhone)) {
      setAgendaNotice("Cadastre seu telefone em Meu cadastro para gerar o link.");
      return;
    }
    setFirstContactBusy(true);
    setAgendaNotice("");
    try {
      let token = firstContactLink?.id || "";
      if (!token) {
        token = await createFirstContactLink({
          uid: user.uid,
          clinicName: currentClinicName,
          clinicPhone,
          logoDataUrl: userProfile?.logoDataUrl || ""
        });
      } else {
        await updateDoc(doc(db, "clientLinks", token), {
          clinicPhone,
          clinicName: currentClinicName,
          logoDataUrl: sanitizeLogoDataUrl(userProfile?.logoDataUrl)
        });
      }
      try {
        await navigator.clipboard.writeText(shareUrl(token));
        setAgendaNotice("Link do primeiro atendimento copiado.");
      } catch (copyError) {
        setAgendaNotice(shareUrl(token));
      }
    } catch (createError) {
      setAgendaNotice(createError.message || "Não foi possível gerar o link.");
    } finally {
      setFirstContactBusy(false);
    }
  };

  const handleCopyAppointmentFeedback = async (appointment) => {
    if (!user || feedbackCopyRef.current) {
      return;
    }
    const client = clients.find(
      (item) => normalizeClientNameKey(item.name) === normalizeClientNameKey(appointment.client)
    );
    if (!client) {
      setAgendaNotice("Cadastre a cliente para copiar o link de feedback.");
      return;
    }
    feedbackCopyRef.current = true;
    setFeedbackCopyId(appointment.id);
    setAgendaNotice("");
    try {
      const existing = shareLinks
        .filter((link) => link.clientId === client.id && link.type === "acompanhamento" && link.moment === "feedback")
        .sort((first, second) => linkSortTime(second) - linkSortTime(first))[0];
      const token = existing?.id || await createShareLink({
        uid: user.uid,
        client,
        clinicName: currentClinicName,
        type: "acompanhamento",
        moment: "feedback",
        logoDataUrl: userProfile?.logoDataUrl || ""
      });
      try {
        await navigator.clipboard.writeText(shareUrl(token));
        setAgendaNotice("Link de feedback copiado.");
      } catch (copyError) {
        setAgendaNotice(shareUrl(token));
      }
    } catch (error) {
      setAgendaNotice(error.message || "Não foi possível copiar o link de feedback.");
    } finally {
      feedbackCopyRef.current = false;
      setFeedbackCopyId("");
    }
  };

  const ensureBookingClient = async (name, phone) => {
    const trimmed = String(name || "").trim();
    const normalized = trimmed.toLowerCase();
    if (!user || !trimmed) {
      return;
    }
    const existing = clients.find((client) => (client.name || "").trim().toLowerCase() === normalized);
    if (existing) {
      if (!phoneKey(existing.phone) && phone) {
        await updateDoc(doc(db, "users", user.uid, "clients", existing.id), {
          phone,
          updatedAt: serverTimestamp()
        });
      }
      return;
    }
    await addDoc(collection(db, "users", user.uid, "clients"), {
      name: trimmed,
      phone: phone || "",
      email: "",
      birthDate: "",
      sex: "",
      address: "",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });
  };

  const decideBooking = async (action) => {
    if (!user || !bookingReview || bookingBusy) {
      return;
    }
    const appointment = bookingReview;
    let nextDate = appointment.date;
    let suggestedDate = "";
    let reason = "";
    if (action === "aprovado" && appointment.status === "remarcacao" && appointment.suggestedDate) {
      nextDate = appointment.suggestedDate;
    }
    if (action === "remarcacao") {
      reason = rescheduleReason.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rescheduleDate) || rescheduleDate < todayIsoDate) {
        setBookingNotice("Escolha uma data a partir de hoje.");
        return;
      }
      if (reason.length < 2) {
        setBookingNotice("Escreva o motivo da remarcação.");
        return;
      }
      suggestedDate = rescheduleDate;
    }
    const popup = window.open("", "_blank");
    setBookingBusy(action);
    setBookingNotice("");
    try {
      const patch = {
        status: action,
        date: nextDate,
        suggestedDate,
        rescheduleReason: action === "remarcacao" ? reason : ""
      };
      await updateDoc(doc(db, "users", user.uid, "appointments", appointment.id), patch);
      if (appointment.shareToken && appointment.requestId) {
        await updateDoc(doc(db, "clientLinks", appointment.shareToken, "requests", appointment.requestId), {
          status: action,
          suggestedDate,
          rescheduleReason: action === "remarcacao" ? reason : "",
          decidedAt: serverTimestamp()
        });
      }
      if (action === "aprovado") {
        await ensureBookingClient(appointment.client, appointment.clientPhone).catch(() => {});
      }
      const message = action === "aprovado"
        ? approvalMessage({
          clinicName: currentClinicName,
          clientName: appointment.client,
          date: nextDate,
          period: appointment.period
        })
        : action === "recusado"
          ? refusalMessage({
            clinicName: currentClinicName,
            clientName: appointment.client,
            date: appointment.date
          })
          : rescheduleMessage({
            clinicName: currentClinicName,
            clientName: appointment.client,
            suggestedDate,
            reason
          });
      const url = whatsAppUrl(appointment.clientPhone, message);
      setBookingWhatsAppUrl(url);
      setBookingReview({ ...appointment, ...patch });
      if (popup) {
        popup.location.href = url;
        setBookingNotice(
          action === "aprovado"
            ? "Consulta aprovada. O WhatsApp foi aberto para a cliente."
            : action === "recusado"
              ? "Consulta recusada. O WhatsApp foi aberto para a cliente."
              : "Nova data sugerida. O WhatsApp foi aberto para a cliente confirmar."
        );
      } else {
        setBookingNotice("Pedido atualizado. Toque em Abrir WhatsApp para avisar a cliente.");
      }
      if (action === "remarcacao") {
        setAgendaSelectedDate(suggestedDate);
      }
    } catch (decisionError) {
      if (popup) {
        popup.close();
      }
      setBookingNotice("Não foi possível atualizar o pedido.");
    } finally {
      setBookingBusy("");
    }
  };

  const goToAgendaToday = () => {
    const today = parseIsoDate(todayIsoDate);
    setAgendaSelectedDate(todayIsoDate);
    setAgendaVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const shiftAgenda = (delta) => {
    if (agendaMode === "month") {
      setAgendaVisibleMonth(
        (current) => new Date(current.getFullYear(), current.getMonth() + delta, 1)
      );
      return;
    }

    const nextDate = parseIsoDate(selectedAgendaDate);
    nextDate.setDate(nextDate.getDate() + delta);
    const nextIsoDate = toIsoDate(nextDate);
    setAgendaSelectedDate(nextIsoDate);
    setAgendaVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  };
  const greetingName = currentUserDisplayName.split(" ")[0] || currentUserDisplayName;
  const dayPeriod = new Date().getHours();
  const greetingLabel = dayPeriod < 12 ? "Bom dia" : dayPeriod < 18 ? "Boa tarde" : "Boa noite";
  const userInitials = nameInitials(currentUserDisplayName) || "?";
  const handleStartNewSession = () => {
    setSelectedClientView(CLIENT_VIEWS.FOLLOWUP);
    setIsRecordMenuOpen(false);
    setCheckpointForm({
      ...buildEmptyCheckpoint(),
      sessionNumber: String(getNextSessionNumber(checkpoints))
    });
    setDraftPhotos([]);
    setPhotoForm(buildEmptyPhotoAnalysis());
    setPhotoMessage("");
    setIsPhotoComposerOpen(false);
    setFollowupScreen("create");
  };
  const topbarMobileSubtitle =
    activeTab === TABS.CLIENTES
      ? `${clients.length} cadastrada${clients.length === 1 ? "" : "s"}`
      : activeTab === TABS.SERVICOS
        ? `${services.length} no catálogo`
        : activeTab === TABS.AVISOS && noticeSummary
          ? noticeSummary.active + noticeSummary.paused === 0
            ? "Nenhuma lista criada"
            : `${noticeSummary.active} ativa${noticeSummary.active === 1 ? "" : "s"}, ${noticeSummary.paused} pausada${
                noticeSummary.paused === 1 ? "" : "s"
              }`
          : "";
  const todayWeekdayLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  const todayDateLabel = `${todayWeekdayLabel.charAt(0).toUpperCase()}${todayWeekdayLabel.slice(1)}, ${new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}`;
  const servicePriceByTitle = new Map(services.map((service) => [service.title, Number(service.price || 0)]));
  const todayActive = todayAppointments.filter((appointment) => appointment.status !== "recusado");
  const todayTotal = todayActive.reduce((sum, appointment) => sum + (servicePriceByTitle.get(appointment.service) || 0), 0);
  const nowTime = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
  const nextToday = sortAppointments(todayActive).find((appointment) => appointment.time && appointment.time >= nowTime) || null;
  const weekStart = parseIsoDate(todayIsoDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekStartIso = toIsoDate(weekStart);
  const weekEndIso = toIsoDate(weekEnd);
  const weekAppointmentsCount = appointments.filter((appointment) => {
    const date = appointmentAgendaDate(appointment);
    return appointment.status !== "recusado" && date >= weekStartIso && date <= weekEndIso;
  }).length;
  const appointmentsByDate = new Map();
  sortAppointments(appointments).forEach((appointment) => {
    const date = appointmentAgendaDate(appointment);
    if (!date || appointment.status === "recusado") {
      return;
    }
    appointmentsByDate.set(date, [...(appointmentsByDate.get(date) || []), appointment]);
  });
  const visibleMonthPrefix = `${agendaVisibleMonth.getFullYear()}-${String(agendaVisibleMonth.getMonth() + 1).padStart(2, "0")}-`;
  const monthAppointmentsCount = appointments.filter(
    (appointment) => appointment.status !== "recusado" && String(appointmentAgendaDate(appointment) || "").startsWith(visibleMonthPrefix)
  ).length;
  const selectedDayActive = selectedDayAppointments.filter((appointment) => appointment.status !== "recusado");
  const selectedDayReviewCount = selectedDayAppointments.filter(
    (appointment) => appointment.status === "pendente" || appointment.status === "remarcacao"
  ).length;
  const selectedDayAppointment =
    sortAppointments(selectedDayAppointments).find((appointment) => appointment.id === selectedAgendaAppointmentId) ||
    sortAppointments(selectedDayActive)[0] ||
    null;
  const dayTimelineAppointments = sortAppointments(selectedDayAppointments).map((appointment) => {
    const start = appointmentStartMinutes(appointment);
    return {
      appointment,
      start,
      end: start + 60,
      openRequest: (appointment.status === "pendente" || appointment.status === "remarcacao") && !appointment.time,
      ...agendaPlacement(start, 60)
    };
  });
  const dayLaneEnds = [];
  dayTimelineAppointments.forEach((block) => {
    let lane = dayLaneEnds.findIndex((end) => end <= block.start);
    if (lane < 0) {
      lane = dayLaneEnds.length;
      dayLaneEnds.push(block.end);
    } else {
      dayLaneEnds[lane] = block.end;
    }
    block.lane = lane;
  });
  const dayLaneCount = Math.max(dayLaneEnds.length, 1);
  const dayClosureBlocks = selectedDayClosures
    .map((closure) => normalizeClosure(closure))
    .filter(Boolean)
    .map((closure, index) => {
      if (closure.allDay) {
        return {
          key: `closure-all-${index}`,
          label: "Fora da agenda · dia inteiro",
          ...agendaPlacement(AGENDA_DAY_START, AGENDA_DAY_END - AGENDA_DAY_START)
        };
      }
      const start = minutesOf(closure.start);
      const end = minutesOf(closure.end);
      return {
        key: `closure-${index}-${closure.start}`,
        label: "Fora da agenda",
        ...agendaPlacement(start, end - start)
      };
    });
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const showAgendaNow = selectedAgendaDate === todayIsoDate && nowMinutes >= AGENDA_DAY_START && nowMinutes <= AGENDA_DAY_END;
  const selectedDayTotal = selectedDayActive.reduce(
    (sum, appointment) => sum + (servicePriceByTitle.get(appointment.service) || 0),
    0
  );
  const homeSummary =
    todayActive.length === 0
      ? "Nenhum atendimento marcado para hoje."
      : `Você tem ${todayActive.length} atendimento${todayActive.length > 1 ? "s" : ""} hoje.${nextToday ? ` O próximo começa às ${nextToday.time}.` : ""}`;
  const activeTabLabel =
    activeTab === TABS.AGENDA
      ? "Agenda"
      : activeTab === TABS.CLIENTES
        ? "Clientes"
        : activeTab === TABS.SERVICOS
          ? "Serviços"
          : activeTab === TABS.AVISOS
            ? "Avisos"
            : "Início";

  if (isLoadingAuth) {
    return <main className="page loading">Carregando...</main>;
  }

  if (!user) {
    return (
      <main className="auth-page auth-split">
        <section className="auth-brand-panel">
          <div className="auth-brand">
            <span className="app-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" />
                <path d="M5 19 13 11" />
              </svg>
            </span>
            <span>Gestão da Clínica</span>
          </div>
          <div className="auth-pitch">
            <h2>A rotina da sua clínica em um só lugar.</h2>
            <p>Agenda, fichas de anamnese, evolução das clientes e avisos no celular.</p>
          </div>
          <ul className="auth-features">
            <li>
              <strong>Agenda</strong>
              <span>Mês e dia</span>
            </li>
            <li>
              <strong>Fichas</strong>
              <span>Anamnese e evolução</span>
            </li>
            <li>
              <strong>Avisos</strong>
              <span>Notificações no celular</span>
            </li>
          </ul>
        </section>

        <section className="auth-form-panel">
          <div className="auth-card">
            <h1>{authMode === "login" ? "Entrar" : "Criar conta"}</h1>
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
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  minLength={6}
                  required
                />
              </label>

              {authError ? <p className="error-text">{authError}</p> : null}

              <button className="primary-btn" type="submit">
                {authMode === "login" ? "Entrar" : "Criar conta"}
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page app-page app-shell">
      <ClinicNoticeRunner
        uid={user.uid}
        tokens={shareLinks
          .filter((link) => ["anamnese", "acompanhamento", "evolucao", "consentimento"].includes(link.type))
          .map((link) => link.token || link.id)}
      />
      {(isHeaderMenuOpen || isHeaderAlertsOpen) ? (
        <button
          type="button"
          className="topbar-backdrop"
          aria-label="Fechar menu"
          onClick={() => {
            setIsHeaderMenuOpen(false);
            setIsHeaderAlertsOpen(false);
          }}
        />
      ) : null}

      <aside className="app-sidebar">
        <div className="app-brand">
          {String(userProfile?.logoDataUrl || "").startsWith("data:image/") ? (
            <img className="app-brand-logo" src={userProfile.logoDataUrl} alt="" />
          ) : (
            <span className="app-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" />
                <path d="M5 19 13 11" />
              </svg>
            </span>
          )}
          <div>
            <strong>{currentClinicName}</strong>
            <span>Gestão</span>
          </div>
        </div>
        <nav className="app-nav" aria-label="Menu principal">
          <span className="app-nav-label">Menu</span>
          {NAV_ITEMS.map((item) => (
            <button
              key={`side-${item.tab}`}
              type="button"
              className={activeTab === item.tab ? "active" : ""}
              aria-current={activeTab === item.tab ? "page" : undefined}
              onClick={() => setActiveTab(item.tab)}
            >
              <NavIcon tab={item.tab} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="app-sidebar-footer">
          <button type="button" className="app-profile" onClick={handleOpenProfileModal}>
            <span className="app-avatar" aria-hidden="true">{userInitials}</span>
            <span className="app-profile-text">
              <strong>{greetingName}</strong>
              <span>Meu cadastro</span>
            </span>
          </button>
          <button type="button" className="app-signout" aria-label="Sair" onClick={() => signOut(auth)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
              <path d="M10 16l-4-4 4-4M6 12h10" />
            </svg>
          </button>
        </div>
      </aside>

      <header className="topbar">
        <div className="topbar-row">
          <button
            type="button"
            className="topbar-icon-btn topbar-menu-btn"
            aria-label="Abrir menu"
            aria-expanded={isHeaderMenuOpen}
            onClick={() => {
              setIsHeaderMenuOpen((previous) => !previous);
              setIsHeaderAlertsOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
              <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
              <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
              <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
            </svg>
          </button>
          <div className="topbar-title">
            <span className={topbarMobileSubtitle ? "topbar-date has-mobile-subtitle" : "topbar-date"}>{todayDateLabel}</span>
            {topbarMobileSubtitle ? <span className="topbar-subtitle">{topbarMobileSubtitle}</span> : null}
            <h2>{activeTab === TABS.INICIO ? `${greetingLabel}, ${greetingName}` : activeTabLabel}</h2>
          </div>
          <button
            type="button"
            className="topbar-icon-btn"
            aria-label="Horários de hoje"
            aria-expanded={isHeaderAlertsOpen}
            onClick={() => {
              setIsHeaderAlertsOpen((previous) => !previous);
              setIsHeaderMenuOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9.5a6 6 0 1 1 12 0c0 4 1.5 5.2 1.5 5.2H4.5S6 13.5 6 9.5Z" />
              <path d="M10 18.5a2 2 0 0 0 4 0" />
            </svg>
            {todayAppointments.length > 0 ? <span className="topbar-badge" /> : null}
          </button>
        </div>

        {isHeaderMenuOpen ? (
          <div className="topbar-popover topbar-popover-left">
            <div className="topbar-profile">
              {String(userProfile?.logoDataUrl || "").startsWith("data:image/") ? (
                <img className="topbar-logo" src={userProfile.logoDataUrl} alt="" />
              ) : null}
              <div>
                <p className="topbar-popover-title">{currentClinicName}</p>
                {userProfile?.professionalRole ? <p>{userProfile.professionalRole}</p> : null}
              </div>
            </div>
            {userProfile?.instagram ? <p>Instagram @{userProfile.instagram}</p> : null}
            {userProfile?.tiktok ? <p>TikTok @{userProfile.tiktok}</p> : null}
            {userProfile?.facebook ? <p>Facebook {userProfile.facebook}</p> : null}
            {userProfile?.website ? <p>{userProfile.website}</p> : null}
            <button
              type="button"
              onClick={() => {
                setIsHeaderMenuOpen(false);
                handleOpenProfileModal();
              }}
            >
              Meu cadastro
            </button>
            <button type="button" onClick={() => signOut(auth)}>
              Sair
            </button>
          </div>
        ) : null}

        {isHeaderAlertsOpen ? (
          <div className="topbar-popover topbar-popover-right">
            <p className="topbar-popover-title">Hoje</p>
            {todayAppointments.length === 0 ? (
              <p>Nenhum horário marcado.</p>
            ) : (
              todayAppointments.map((appointment) => (
                <button
                  key={`alert-${appointment.id}`}
                  type="button"
                  onClick={() => {
                    setIsHeaderAlertsOpen(false);
                    setActiveTab(TABS.AGENDA);
                  }}
                >
                  {appointment.time || "--:--"} · {appointment.client}
                </button>
              ))
            )}
          </div>
        ) : null}
      </header>

      <nav className="bottom-nav" aria-label="Menu principal">
        {NAV_ITEMS.map((item) => (
          <button
            key={`bottom-${item.tab}`}
            type="button"
            className={activeTab === item.tab ? "active" : ""}
            aria-current={activeTab === item.tab ? "page" : undefined}
            onClick={() => setActiveTab(item.tab)}
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              <NavIcon tab={item.tab} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {activeTab === TABS.INICIO ? (
        <section className="home-page">
          <header className="page-header home-header">
            <div>
              <h1>
                {greetingLabel}, {greetingName}
              </h1>
              <p>{homeSummary}</p>
            </div>
            <div className="page-actions">
              <button className="secondary-btn" type="button" onClick={handleFirstContactLink} disabled={firstContactBusy}>
                <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                  <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                </svg>
                {firstContactBusy
                  ? "Gerando link..."
                  : firstContactLink
                    ? "Copiar link de primeiro atendimento"
                    : "Link de primeiro atendimento"}
              </button>
              <button className="primary-btn" type="button" onClick={openAppointmentModal}>
                <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Novo atendimento
              </button>
            </div>
          </header>
          {agendaNotice ? <p className="muted-text home-notice">{agendaNotice}</p> : null}

          <div className="home-stats">
            <button type="button" onClick={() => setActiveTab(TABS.AGENDA)}>
              <span>Atendimentos hoje</span>
              <strong>{todayActive.length}</strong>
              <small>{nextToday ? `Próximo às ${nextToday.time}` : "Nenhum próximo hoje"}</small>
            </button>
            <button type="button" onClick={() => setActiveTab(TABS.AGENDA)}>
              <span>Esta semana</span>
              <strong>{weekAppointmentsCount}</strong>
              <small>Atendimentos marcados</small>
            </button>
            <button type="button" onClick={() => setActiveTab(TABS.CLIENTES)}>
              <span>Clientes</span>
              <strong>{clients.length}</strong>
              <small>Cadastradas</small>
            </button>
            <button type="button" onClick={() => setActiveTab(TABS.SERVICOS)}>
              <span>Serviços</span>
              <strong>{services.length}</strong>
              <small>No catálogo</small>
            </button>
          </div>

          <article className="card home-agenda">
            <div className="home-card-header">
              <h2>Agenda de hoje</h2>
              <button className="link-btn" type="button" onClick={() => setActiveTab(TABS.AGENDA)}>
                Ver agenda completa
              </button>
            </div>
            {todayAppointments.length === 0 ? (
              <p className="home-empty">Nada marcado para hoje.</p>
            ) : (
              <ul className="home-agenda-list">
                {sortAppointments(todayAppointments).map((appointment) => (
                  <li key={`home-${appointment.id}`} className={appointment.status === "recusado" ? "is-muted" : ""}>
                    <span className="home-agenda-time">
                      {appointment.time || (appointment.period ? periodLabel(appointment.period) : "--:--")}
                    </span>
                    <span className="home-agenda-client">
                      <span className="app-avatar is-soft" aria-hidden="true">
                        {nameInitials(appointment.client)}
                      </span>
                      <span>
                        <strong>{appointment.client}</strong>
                        <span>{appointment.service}</span>
                        {appointment.notes ? <span>{appointment.notes}</span> : null}
                      </span>
                    </span>
                    <span className="home-agenda-price">
                      {servicePriceByTitle.get(appointment.service) ? formatBRL(servicePriceByTitle.get(appointment.service)) : ""}
                    </span>
                    <span className="home-agenda-status">
                      <AppointmentStatusTag appointment={appointment} />
                      {appointment.requestId ? (
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => {
                            setAgendaSelectedDate(appointmentAgendaDate(appointment));
                            setActiveTab(TABS.AGENDA);
                            openBookingReview(appointment);
                          }}
                        >
                          Ver pedido
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="home-today">
            <span>Previsto para hoje</span>
            <strong>{formatBRL(todayTotal)}</strong>
            <small>
              {todayActive.length === 0
                ? "Nenhum atendimento marcado"
                : `Soma dos ${todayActive.length} atendimento${todayActive.length > 1 ? "s" : ""} de hoje`}
            </small>
          </article>

          <article className="card home-shortcuts">
            <h2>Atalhos</h2>
            <button
              type="button"
              onClick={() => {
                setActiveTab(TABS.CLIENTES);
                handleStartCreateClient();
              }}
            >
              <span className="home-shortcut-icon" aria-hidden="true">
                <NavIcon tab={TABS.CLIENTES} />
              </span>
              Nova cliente
            </button>
            <button type="button" onClick={() => setActiveTab(TABS.SERVICOS)}>
              <span className="home-shortcut-icon" aria-hidden="true">
                <NavIcon tab={TABS.SERVICOS} />
              </span>
              Novo serviço
            </button>
            <button type="button" onClick={() => setActiveTab(TABS.AVISOS)}>
              <span className="home-shortcut-icon" aria-hidden="true">
                <NavIcon tab={TABS.AVISOS} />
              </span>
              Nova lista de avisos
            </button>
          </article>

          <button className="primary-btn home-mobile-cta" type="button" onClick={openAppointmentModal}>
            Novo atendimento
          </button>
        </section>
      ) : null}

      {activeTab === TABS.AGENDA ? (
        <section className={agendaMode === "month" ? "agenda-page" : "agenda-page is-day"}>
          {agendaMode === "day" ? (
            <header className="page-header agenda-header agenda-day-top">
              <div className="agenda-day-heading">
                <button type="button" className="agenda-nav-btn" aria-label="Dia anterior" onClick={() => shiftAgenda(-1)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
                </button>
                <button type="button" className="agenda-nav-btn" aria-label="Próximo dia" onClick={() => shiftAgenda(1)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                </button>
                <div>
                  <h1>{selectedDayLabel}</h1>
                  <p>
                    {[
                      selectedAgendaDate === todayIsoDate ? "Hoje" : null,
                      `${selectedDayActive.length} atendimento${selectedDayActive.length === 1 ? "" : "s"}`,
                      selectedDayReviewCount
                        ? `${selectedDayReviewCount} pedido${selectedDayReviewCount === 1 ? "" : "s"} para revisar`
                        : null
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <div className="page-actions agenda-actions">
                <div className="segmented" role="tablist" aria-label="Visualização da agenda">
                  <button type="button" role="tab" aria-selected={false} onClick={() => setAgendaMode("month")}>Mês</button>
                  <button type="button" role="tab" aria-selected className="active" onClick={() => setAgendaMode("day")}>Dia</button>
                </div>
                {selectedAgendaDate !== todayIsoDate ? (
                  <button type="button" className="secondary-btn" onClick={goToAgendaToday}>Hoje</button>
                ) : null}
                <button type="button" className="secondary-btn" onClick={openAgendaOff}>Fora da agenda</button>
                <button className="primary-btn" type="button" onClick={openAppointmentModal}>Novo atendimento</button>
              </div>
            </header>
          ) : (
          <header className="page-header agenda-header">
            <div>
              <h1>Agenda</h1>
              <p>
                {`${monthAppointmentsCount} atendimento${monthAppointmentsCount === 1 ? "" : "s"} em ${visibleMonthLabel}`}
              </p>
            </div>
            <div className="page-actions agenda-actions">
              <div className="segmented" role="tablist" aria-label="Visualização da agenda">
                <button
                  type="button"
                  role="tab"
                  aria-selected={agendaMode === "month"}
                  className={agendaMode === "month" ? "active" : ""}
                  onClick={() => setAgendaMode("month")}
                >
                  Mês
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={agendaMode === "day"}
                  className={agendaMode === "day" ? "active" : ""}
                  onClick={() => setAgendaMode("day")}
                >
                  Dia
                </button>
              </div>
              <button className="secondary-btn" type="button" onClick={handleFirstContactLink} disabled={firstContactBusy}>
                <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                  <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                </svg>
                {firstContactBusy
                  ? "Gerando link..."
                  : firstContactLink
                    ? "Copiar link de primeiro atendimento"
                    : "Link de primeiro atendimento"}
              </button>
              <button className="primary-btn" type="button" onClick={openAppointmentModal}>
                <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Novo atendimento
              </button>
            </div>
          </header>
          )}
          {agendaNotice ? <p className="muted-text agenda-notice">{agendaNotice}</p> : null}

          {agendaMode === "day" ? (
            <div className="agenda-day-board">
              <div className="agenda-timeline card" aria-label="Horários do dia">
                <div className="agenda-hours" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, index) => (
                    <span key={index} style={agendaHourStyle(index)}>
                      {String(8 + index).padStart(2, "0")}:00
                    </span>
                  ))}
                </div>
                <div className="agenda-canvas">
                  {Array.from({ length: 12 }, (_, index) => (
                    <span key={`line-${index}`} className="agenda-hour-line" style={agendaHourStyle(index)} />
                  ))}
                  {dayClosureBlocks.map((block) => (
                    <div key={block.key} className="agenda-block is-closed" style={agendaHourStyle(block.hoursFromStart, block.spanHours)}>
                      <strong>{block.label}</strong>
                    </div>
                  ))}
                  {showAgendaNow ? (
                    <div className="agenda-now" style={agendaHourStyle((nowMinutes - AGENDA_DAY_START) / 60)}>
                      <span />
                    </div>
                  ) : null}
                  {dayTimelineAppointments.map((block) => {
                    const { appointment } = block;
                    const tone = appointmentStatusInfo(appointment).tone;
                    const price = servicePriceByTitle.get(appointment.service);
                    const selected = selectedDayAppointment?.id === appointment.id;
                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        className={`agenda-block is-${block.openRequest ? "request" : tone} ${selected ? "is-selected" : ""} ${appointment.status === "recusado" ? "is-muted" : ""}`}
                        style={{
                          ...agendaHourStyle(block.hoursFromStart, block.spanHours),
                          left: `calc(8px + ${block.lane} * ((100% - 16px) / ${dayLaneCount}))`,
                          width: `calc((100% - 16px) / ${dayLaneCount} - 6px)`
                        }}
                        onClick={() => setSelectedAgendaAppointmentId(appointment.id)}
                      >
                        <span>
                          <strong>
                            {block.openRequest
                              ? `Pedido de primeiro atendimento · ${appointment.client}`
                              : `${appointment.time || periodLabel(appointment.period)} · ${appointment.client}`}
                          </strong>
                          <small>
                            {block.openRequest
                              ? [periodLabel(appointment.period), Array.isArray(appointment.reasons) ? appointment.reasons.join(" · ") : ""]
                                .filter(Boolean)
                                .join(" · ")
                              : [appointment.service, price ? formatBRL(price) : ""].filter(Boolean).join(" · ")}
                          </small>
                        </span>
                        {block.openRequest ? (
                          <span
                            className="agenda-review"
                            role="presentation"
                            onClick={(event) => {
                              event.stopPropagation();
                              openBookingReview(appointment);
                            }}
                          >
                            Revisar
                          </span>
                        ) : (
                          <AppointmentStatusTag appointment={appointment} compact />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <aside className="agenda-day-detail card">
                {selectedDayAppointment ? (
                  <>
                    <h2>
                      {selectedDayAppointment.client}
                      {" · "}
                      {selectedDayAppointment.time || periodLabel(selectedDayAppointment.period)}
                    </h2>
                    <div className="agenda-detail-facts">
                    <p>{selectedDayAppointment.service || "Atendimento"}</p>
                    {servicePriceByTitle.get(selectedDayAppointment.service) ? (
                      <p>{formatBRL(servicePriceByTitle.get(selectedDayAppointment.service))}</p>
                    ) : null}
                    <p>
                      {formatPhoneBr(
                        selectedDayAppointment.clientPhone ||
                          clients.find(
                            (client) => normalizeClientNameKey(client.name) === normalizeClientNameKey(selectedDayAppointment.client)
                          )?.phone
                      ) || "Telefone não informado"}
                    </p>
                    </div>
                    <div className="agenda-detail-actions">
                    {(selectedDayAppointment.status === "pendente" || selectedDayAppointment.status === "remarcacao") && selectedDayAppointment.requestId ? (
                      <button type="button" className="primary-btn" onClick={() => openBookingReview(selectedDayAppointment)}>
                        Revisar pedido
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => {
                          const client = clients.find(
                            (item) => normalizeClientNameKey(item.name) === normalizeClientNameKey(selectedDayAppointment.client)
                          );
                          if (!client) {
                            setAgendaNotice("Cadastre a cliente para abrir o prontuário.");
                            return;
                          }
                          setActiveTab(TABS.CLIENTES);
                          handleOpenClientModal(client.id);
                        }}
                      >
                        Abrir prontuário
                      </button>
                    )}
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={feedbackCopyId === selectedDayAppointment.id}
                      onClick={() => handleCopyAppointmentFeedback(selectedDayAppointment)}
                    >
                      {feedbackCopyId === selectedDayAppointment.id ? "Copiando..." : "Copiar link de feedback"}
                    </button>
                    </div>
                    <button
                      type="button"
                      className="agenda-detail-delete"
                      onClick={() => handleDeleteByCollection("appointments", selectedDayAppointment.id)}
                    >
                      Excluir atendimento
                    </button>
                  </>
                ) : (
                  <p className="agenda-detail-empty">Nenhum atendimento neste dia.</p>
                )}
              </aside>
            </div>
          ) : (
          <div className="agenda-layout">
            <article className="card agenda-calendar">
              <div className="agenda-calendar-header">
                <button
                  type="button"
                  className="agenda-nav-btn"
                  aria-label={agendaMode === "month" ? "Mês anterior" : "Dia anterior"}
                  onClick={() => shiftAgenda(-1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m15 6-6 6 6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="agenda-nav-btn"
                  aria-label={agendaMode === "month" ? "Próximo mês" : "Próximo dia"}
                  onClick={() => shiftAgenda(1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
                <h2>{agendaNavTitle}</h2>
                <button type="button" className="secondary-btn agenda-today" onClick={goToAgendaToday}>
                  Hoje
                </button>
              </div>

              {agendaMode === "month" ? (
                <div className="month-grid">
                  {WEEKDAY_SHORT_LABELS.map((weekday) => (
                    <span key={weekday} className="month-weekday">
                      {weekday}
                    </span>
                  ))}
                  {monthDays.map((isoDate, index) => {
                    if (!isoDate) {
                      return <span key={`empty-day-${index}`} className="month-day is-empty" />;
                    }
                    const dayIsOff = isDayClosed(agendaClosures, isoDate);
                    const dayPartialOff = !dayIsOff && closedPeriods(agendaClosures, isoDate).length > 0;
                    const dayAppointments = appointmentsByDate.get(isoDate) || [];
                    return (
                      <button
                        key={isoDate}
                        type="button"
                        className={`month-day ${isoDate === selectedAgendaDate ? "is-selected" : ""} ${
                          isoDate === todayIsoDate ? "is-today" : ""
                        } ${dayIsOff ? "is-off" : ""} ${
                          dayAppointments.length ? "has-appointments" : ""
                        } ${pendingDates.has(isoDate) ? "has-pending" : ""}`}
                        aria-pressed={isoDate === selectedAgendaDate}
                        aria-label={`${formatAgendaDayLabel(isoDate)}${
                          dayIsOff ? ", fora da agenda" : ""
                        }${dayPartialOff ? ", horário off" : ""}${
                          dayAppointments.length
                            ? `, ${dayAppointments.length} atendimento${dayAppointments.length > 1 ? "s" : ""}`
                            : ""
                        }`}
                        onClick={() => setAgendaSelectedDate(isoDate)}
                      >
                        <span className="month-day-top">
                          <span className="month-day-number">{parseIsoDate(isoDate).getDate()}</span>
                          {dayPartialOff ? <span className="month-day-off" aria-hidden="true" /> : null}
                        </span>
                        <span className="month-day-dot" aria-hidden="true" />
                        {dayAppointments.slice(0, 2).map((appointment) => (
                          <span
                            key={`chip-${appointment.id}`}
                            className={`month-chip ${
                              appointment.status === "pendente" || appointment.status === "remarcacao" ? "is-pending" : ""
                            }`}
                            aria-hidden="true"
                          >
                            {appointment.time ? `${appointment.time} ` : ""}
                            {shortClientName(appointment.client)}
                          </span>
                        ))}
                        {dayAppointments.length > 2 ? (
                          <span className="month-more" aria-hidden="true">
                            +{dayAppointments.length - 2} mais
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </article>

            <article className="card agenda-day-panel">
              <div className="agenda-day-header">
                <div>
                  {agendaMode === "month" ? <h2>{selectedDayLabel}</h2> : null}
                  <p>
                    {selectedDayActive.length} atendimento{selectedDayActive.length === 1 ? "" : "s"}
                    {selectedDayTotal > 0 ? ` · ${formatBRL(selectedDayTotal)}` : ""}
                  </p>
                </div>
                <button type="button" className="secondary-btn" onClick={openAgendaOff}>
                  Fora da agenda
                </button>
              </div>
              {selectedDayAppointments.length === 0 ? (
                <p className="agenda-empty">Nenhum atendimento neste dia.</p>
              ) : (
                <ul className="agenda-appointments">
                  {sortAppointments(selectedDayAppointments).map((appointment) => (
                    <li key={appointment.id} className={appointment.status === "recusado" ? "is-muted" : ""}>
                      <div className="agenda-appointment-top">
                        <strong>
                          {appointment.time || (appointment.period ? periodLabel(appointment.period) : "Sem horário")}
                        </strong>
                        <AppointmentStatusTag appointment={appointment} />
                      </div>
                      <strong className="agenda-appointment-client">{appointment.client}</strong>
                      <span className="agenda-appointment-meta">
                        {appointment.service}
                        {servicePriceByTitle.get(appointment.service)
                          ? ` · ${formatBRL(servicePriceByTitle.get(appointment.service))}`
                          : ""}
                      </span>
                      {appointment.status === "remarcacao" && appointment.date ? (
                        <p className="agenda-appointment-note">
                          Pedido original em {formatDatePt(appointment.date)}. A confirmação da cliente é pelo WhatsApp.
                        </p>
                      ) : null}
                      {appointment.requestId && Array.isArray(appointment.reasons) && appointment.reasons.length > 0 ? (
                        <p className="agenda-appointment-note">{appointment.reasons.join(", ")}</p>
                      ) : null}
                      {appointment.notes ? <p className="agenda-appointment-note">{appointment.notes}</p> : null}
                      <div className="agenda-appointment-actions">
                        {appointment.requestId ? (
                          <button type="button" className="secondary-btn" onClick={() => openBookingReview(appointment)}>
                            Ver pedido
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="secondary-btn"
                          disabled={feedbackCopyId === appointment.id}
                          onClick={() => handleCopyAppointmentFeedback(appointment)}
                        >
                          {feedbackCopyId === appointment.id ? "Copiando..." : "Copiar feedback"}
                        </button>
                        <button
                          type="button"
                          className="link-btn is-danger"
                          onClick={() => handleDeleteByCollection("appointments", appointment.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
          )}
        </section>
      ) : null}

      {isAgendaOffOpen ? (
        <div
          className="client-modal-backdrop app-modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeAgendaOff();
          }}
        >
          <section
            className="app-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Fora da agenda"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="app-modal-header">
              <div>
                <h2>Fora da agenda</h2>
                <p>{selectedDayLabel}. Clientes novas não conseguem pedir horário nestes períodos.</p>
              </div>
              <ModalClose onClick={closeAgendaOff} />
            </header>
            <div className="app-modal-body">
              <div className="away-options" role="radiogroup" aria-label="Tipo de ausência">
                <div className={offMode === "day" ? "away-option is-selected" : "away-option"}>
                  <label className="away-option-head">
                    <input
                      type="radio"
                      name="away-mode"
                      checked={offMode === "day"}
                      disabled={offBusy}
                      onChange={() => setOffMode("day")}
                    />
                    <span>Este dia inteiro</span>
                  </label>
                </div>
                <div className={offMode === "weekday" ? "away-option is-selected" : "away-option"}>
                  <label className="away-option-head">
                    <input
                      type="radio"
                      name="away-mode"
                      checked={offMode === "weekday"}
                      disabled={offBusy}
                      onChange={() => setOffMode("weekday")}
                    />
                    <span>Toda {["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"][selectedWeekday]} inteira</span>
                  </label>
                </div>
                <div className={offMode === "interval" ? "away-option is-selected" : "away-option"}>
                  <label className="away-option-head">
                    <input
                      type="radio"
                      name="away-mode"
                      checked={offMode === "interval"}
                      disabled={offBusy}
                      onChange={() => setOffMode("interval")}
                    />
                    <span>Um intervalo de horário</span>
                  </label>
                  {offMode === "interval" ? (
                    <div className="away-interval">
                      <div className="field-row">
                        <label>
                          Início
                          <input type="time" value={offStart} onChange={(event) => setOffStart(event.target.value)} />
                        </label>
                        <label>
                          Fim
                          <input type="time" value={offEnd} onChange={(event) => setOffEnd(event.target.value)} />
                        </label>
                      </div>
                      <label className="check-inline">
                        <input type="checkbox" checked={offRepeat} onChange={(event) => setOffRepeat(event.target.checked)} />
                        Repetir toda semana
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="field-hint">Períodos que a cliente vê: manhã 8h–12h, tarde 12h–18h, noite 18h–21h.</p>
              {offError ? <p className="error-text">{offError}</p> : null}
              {selectedDayClosures.length > 0 ? (
                <div className="modal-section">
                  <span className="section-label">Já bloqueado</span>
                  <ul className="blocked-list">
                    {selectedDayClosures.map((closure) => (
                      <li key={closure.id}>
                        <span>{formatAwayClosure(closure)}</span>
                        <button
                          type="button"
                          className="link-btn is-danger"
                          disabled={offBusy}
                          aria-label={`Remover ${closureLabel(closure)}`}
                          onClick={() => removeAgendaClosure(closure.id)}
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <footer className="app-modal-footer">
              <button className="secondary-btn" type="button" onClick={closeAgendaOff} disabled={offBusy}>
                Cancelar
              </button>
              <button className="primary-btn" type="button" onClick={handleAddAgendaOff} disabled={offBusy}>
                Bloquear horário
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {isAppointmentModalOpen ? (
        <div
          className="client-modal-backdrop app-modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeAppointmentModal();
          }}
        >
          <section
            className="app-modal appointment-composer"
            role="dialog"
            aria-modal="true"
            aria-label="Novo atendimento"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="app-modal-header">
              <div>
                <h2>Novo atendimento</h2>
                <p>{formatAgendaDayLabel(appointmentDate || selectedAgendaDate)}</p>
                {isDayClosed(agendaClosures, appointmentDate || selectedAgendaDate) ? (
                  <p className="modal-notice">Este dia está fora da agenda para a cliente. Você ainda pode inserir o atendimento.</p>
                ) : closedPeriods(agendaClosures, appointmentDate || selectedAgendaDate).length > 0 ? (
                  <p className="modal-notice">Alguns horários deste dia estão fora da agenda para a cliente. Você ainda pode inserir o atendimento.</p>
                ) : null}
              </div>
              <ModalClose onClick={closeAppointmentModal} />
            </header>
            <form className="app-modal-form" onSubmit={handleAddAppointment}>
              <div className="app-modal-body form-grid">
                <label className="full-row">
                  Cliente
                  <div className={`client-picker appointment-client-picker ${isAppointmentClientListOpen ? "is-open" : ""}`}>
                    <div className="appointment-client-search">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="11" cy="11" r="6.5" />
                        <path d="M16 16.5 20 20.5" />
                      </svg>
                      <input
                        value={appointmentClient}
                        onChange={(event) => {
                          setAppointmentClient(event.target.value);
                          setAppointmentClientNotice("");
                          setIsAppointmentClientListOpen(true);
                        }}
                        onFocus={() => setIsAppointmentClientListOpen(true)}
                        onBlur={() => setIsAppointmentClientListOpen(false)}
                        placeholder="Buscar cliente"
                        autoComplete="off"
                        required
                      />
                    </div>
                    {isAppointmentClientListOpen ? (
                      <div className="appointment-client-menu">
                        {appointmentClientSuggestions.length > 0 ? (
                          <ul>
                            {appointmentClientSuggestions.map((client) => {
                              const selected = (client.name || "").trim().toLowerCase() === normalizedAppointmentClientName;
                              return (
                                <li key={`appointment-client-${client.id}`}>
                                  <button
                                    type="button"
                                    className={selected ? "is-selected" : ""}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                      setAppointmentClient(client.name || "");
                                      setAppointmentClientNotice("");
                                      setIsAppointmentClientListOpen(false);
                                    }}
                                  >
                                    <span className="app-avatar is-soft" aria-hidden="true">
                                      {nameInitials(client.name)}
                                    </span>
                                    <span className="appointment-client-copy">
                                      <strong>{client.name}</strong>
                                      {client.phone ? <small>{formatPhoneBr(client.phone)}</small> : null}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="appointment-client-empty">Nenhuma cliente encontrada.</p>
                        )}
                        <button
                          type="button"
                          className="appointment-client-create"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={startAppointmentClientRegistration}
                        >
                          + Cadastrar nova cliente
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {appointmentClientNotice ? <p className="muted-text">{appointmentClientNotice}</p> : null}
                </label>
                <label className="full-row">
                  Serviço
                  <select
                    value={appointmentService}
                    onChange={(event) => {
                      setAppointmentService(event.target.value);
                      setAppointmentServiceNotice("");
                    }}
                    required
                  >
                    <option value="">Selecionar</option>
                    {[...services]
                      .sort((first, second) => String(first.title || "").localeCompare(String(second.title || ""), "pt-BR"))
                      .map((service) => (
                        <option key={service.id} value={service.title}>
                          {service.title}
                          {Number(service.price) > 0 ? ` · ${formatBRL(service.price)}` : ""}
                        </option>
                      ))}
                    <option value={UNDETERMINED_SERVICE_LABEL}>{UNDETERMINED_SERVICE_LABEL}</option>
                  </select>
                  {appointmentServiceNotice ? <p className="muted-text">{appointmentServiceNotice}</p> : null}
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
              </div>
              <footer className="app-modal-footer">
                <button className="secondary-btn" type="button" onClick={closeAppointmentModal}>
                  Cancelar
                </button>
                <button className="primary-btn" type="submit">
                  Salvar atendimento
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {bookingReview ? (
        <div
          className="client-modal-backdrop app-modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeBookingReview();
          }}
        >
          <section
            className="app-modal booking-review-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Pedido de primeiro atendimento"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="app-modal-header booking-review-header">
              <span className="app-avatar is-warm" aria-hidden="true">
                {nameInitials(bookingReview.client)}
              </span>
              <div>
                <h2>{bookingReview.client}</h2>
                <span className={`booking-badge is-${bookingReview.status || "pendente"}`}>
                  {bookingReviewPill(bookingReview.status)}
                </span>
              </div>
              <ModalClose onClick={closeBookingReview} />
            </header>
            <div className="app-modal-body">
              <dl className="booking-tiles">
                <div>
                  <dt>Dia pedido</dt>
                  <dd>{formatBookingDay(bookingReview.date)}</dd>
                </div>
                <div>
                  <dt>Período</dt>
                  <dd>{periodLabel(bookingReview.period)}</dd>
                </div>
                <div>
                  <dt>WhatsApp</dt>
                  <dd>{formatPhoneBr(bookingReview.clientPhone) || "Não informado"}</dd>
                </div>
              </dl>
              <div className="booking-reasons">
                <span>Motivo</span>
                {Array.isArray(bookingReview.reasons) && bookingReview.reasons.length > 0 ? (
                  <span className="chip-list">
                    {bookingReview.reasons.map((reason) => (
                      <span key={reason} className="chip">
                        {reason}
                      </span>
                    ))}
                  </span>
                ) : (
                  <p>Não informado</p>
                )}
              </div>
              {bookingReview.status === "remarcacao" && bookingReview.suggestedDate ? (
                <p className="field-hint">
                  Nova data sugerida: {formatBookingDay(bookingReview.suggestedDate)}
                  {bookingReview.rescheduleReason ? `. ${bookingReview.rescheduleReason}` : ""}
                </p>
              ) : null}
              <div className="booking-decision">
                <button type="button" className="primary-btn" onClick={() => decideBooking("aprovado")} disabled={Boolean(bookingBusy)}>
                  {bookingBusy === "aprovado" ? "Aprovando..." : "Aprovar"}
                </button>
                <button type="button" className="danger-btn" onClick={() => decideBooking("recusado")} disabled={Boolean(bookingBusy)}>
                  {bookingBusy === "recusado" ? "Recusando..." : "Recusar"}
                </button>
              </div>
              <form
                className="option-card booking-reschedule"
                onSubmit={(event) => {
                  event.preventDefault();
                  decideBooking("remarcacao");
                }}
              >
                <strong>Sugerir outra data</strong>
                <div className="field-row">
                  <label>
                    Nova data
                    <input
                      type="date"
                      value={rescheduleDate}
                      min={todayIsoDate}
                      onChange={(event) => setRescheduleDate(event.target.value)}
                    />
                  </label>
                  <label>
                    Motivo
                    <input
                      value={rescheduleReason}
                      maxLength={400}
                      onChange={(event) => setRescheduleReason(event.target.value)}
                      placeholder="Conte por que esse dia não funciona"
                    />
                  </label>
                </div>
                <button className="secondary-btn" type="submit" disabled={Boolean(bookingBusy)}>
                  {bookingBusy === "remarcacao" ? "Enviando..." : "Remarcar e pedir confirmação"}
                </button>
              </form>
              {bookingNotice ? <p className="muted-text">{bookingNotice}</p> : null}
            </div>
            <footer className="app-modal-footer is-split">
              <span className="field-hint">Depois da decisão, avise a cliente pelo WhatsApp.</span>
              {bookingWhatsAppUrl ? (
                <a className="secondary-btn" href={bookingWhatsAppUrl} target="_blank" rel="noreferrer">
                  Abrir WhatsApp
                </a>
              ) : (
                <button type="button" className="secondary-btn" disabled>
                  Abrir WhatsApp
                </button>
              )}
            </footer>
          </section>
        </div>
      ) : null}

      {activeTab === TABS.CLIENTES ? (
        <section className="clients-page">
          <header className="page-header">
            <div>
              <h1>Clientes</h1>
              <p>
                {clients.length} cliente{clients.length === 1 ? "" : "s"} cadastrada{clients.length === 1 ? "" : "s"}. Abra a ficha para ver
                anamnese e evolução.
              </p>
            </div>
            <div className="page-actions">
              <button type="button" className="primary-btn clients-add-btn" onClick={handleStartCreateClient} aria-label="Nova cliente">
                <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="btn-label">Nova cliente</span>
              </button>
            </div>
          </header>

          {clientFormMessage ? <p className="success-text">{clientFormMessage}</p> : null}

          <article className="card table-card">
            <div className="table-toolbar">
              <label className="search-field">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="6" />
                  <path d="m20 20-4.2-4.2" />
                </svg>
                <input
                  value={clientSearchTerm}
                  onChange={(event) => setClientSearchTerm(event.target.value)}
                  placeholder="Nome, telefone, e-mail ou endereço"
                  aria-label="Buscar cliente"
                />
              </label>
              <label className="inline-select">
                Sexo
                <select value={clientSexFilter} onChange={(event) => setClientSexFilter(event.target.value)}>
                  <option value="all">Todos</option>
                  {SEX_OPTIONS.filter((option) => option.value).map((option) => (
                    <option key={`filter-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-select">
                Ordenar
                <select value={clientSortMode} onChange={(event) => setClientSortMode(event.target.value)}>
                  {CLIENT_SORT_OPTIONS.map((option) => (
                    <option key={`sort-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="filter-chips-row">
                <div className="filter-chips" role="group" aria-label="Filtrar por sexo">
                  <button
                    type="button"
                    className={clientSexFilter === "all" ? "active" : ""}
                    aria-pressed={clientSexFilter === "all"}
                    onClick={() => setClientSexFilter("all")}
                  >
                    Todas
                  </button>
                  {SEX_OPTIONS.filter((option) => option.value).map((option) => (
                    <button
                      key={`chip-${option.value}`}
                      type="button"
                      className={clientSexFilter === option.value ? "active" : ""}
                      aria-pressed={clientSexFilter === option.value}
                      onClick={() => setClientSexFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="sort-menu">
                  <button
                    type="button"
                    className="sort-menu-trigger"
                    aria-label="Ordenar clientes"
                    aria-expanded={isClientSortMenuOpen}
                    onClick={() => setIsClientSortMenuOpen((previous) => !previous)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3" />
                    </svg>
                  </button>
                  {isClientSortMenuOpen ? (
                    <div className="sort-menu-dropdown" role="menu" aria-label="Ordenar por">
                      {CLIENT_SORT_OPTIONS.map((option) => (
                        <button
                          key={`sort-menu-${option.value}`}
                          type="button"
                          role="menuitemradio"
                          aria-checked={clientSortMode === option.value}
                          className={clientSortMode === option.value ? "active" : ""}
                          onClick={() => {
                            setClientSortMode(option.value);
                            setIsClientSortMenuOpen(false);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {clients.length === 0 ? (
              <p className="table-empty">Nenhuma cliente cadastrada.</p>
            ) : visibleClients.length === 0 ? (
              <p className="table-empty">Nenhuma cliente encontrada com os filtros atuais.</p>
            ) : (
              <ul className="data-table clients-table">
                <li className="data-table-head" aria-hidden="true">
                  <span>Cliente</span>
                  <span>Telefone</span>
                  <span>Último atendimento</span>
                  <span />
                </li>
                {visibleClients.map((client) => {
                  const lastAppointmentInfo = lastAppointmentByClientName.get(normalizeClientNameKey(client.name));
                  const lastAppointmentDate = lastAppointmentInfo?.date || "";

                  return (
                    <li key={client.id}>
                      <button
                        type="button"
                        className="clients-name"
                        onClick={() => handleOpenClientModal(client.id)}
                        disabled={isClientFormOpen}
                      >
                        <span className="app-avatar is-soft" aria-hidden="true">
                          {nameInitials(client.name)}
                        </span>
                        <span>
                          <strong>{client.name}</strong>
                          <span>{client.email || (client.phone ? formatPhoneBr(client.phone) : "Sem contato")}</span>
                        </span>
                      </button>
                      <span className="clients-cell">{client.phone ? formatPhoneBr(client.phone) : "Não informado"}</span>
                      <span className="clients-cell">
                        {lastAppointmentDate ? formatDatePt(lastAppointmentDate) : "Sem atendimento"}
                      </span>
                      <span className="row-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => handleOpenClientModal(client.id)}
                          disabled={isClientFormOpen}
                        >
                          Ver ficha
                        </button>
                        <span className="row-menu">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Abrir opções de ${client.name}`}
                            aria-expanded={openClientMenuId === client.id}
                            onClick={() => handleToggleClientMenu(client.id)}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <circle cx="12" cy="5" r="1.6" />
                              <circle cx="12" cy="12" r="1.6" />
                              <circle cx="12" cy="19" r="1.6" />
                            </svg>
                          </button>
                          {openClientMenuId === client.id ? (
                            <span className="row-menu-dropdown">
                              <button type="button" onClick={() => handleEditClient(client)}>
                                Editar cadastro
                              </button>
                              <button
                                type="button"
                                className="is-danger"
                                onClick={() => {
                                  setOpenClientMenuId("");
                                  handleDeleteByCollection("clients", client.id);
                                }}
                              >
                                Excluir cliente
                              </button>
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="table-footer">
              Exibindo {visibleClients.length} de {clients.length} cliente{clients.length === 1 ? "" : "s"}
            </div>
          </article>

          {selectedClient && selectedClientView ? (
            <div
              className="client-modal-backdrop record-backdrop"
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) handleCloseClientView();
              }}
            >
              <section
                className="client-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`Prontuário de ${selectedClient.name}`}
                onClick={(event) => event.stopPropagation()}
              >
                {isRecordMenuOpen ? (
                  <button
                    type="button"
                    className="record-menu-scrim"
                    aria-label="Fechar menu"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsRecordMenuOpen(false);
                    }}
                  />
                ) : null}
                <header className="client-modal-header record-header">
                  <button type="button" className="record-back" onClick={handleCloseClientView}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m15 6-6 6 6 6" />
                    </svg>
                    Clientes
                  </button>
                  <div className="record-identity">
                    <span className="app-avatar is-soft record-avatar" aria-hidden="true">
                      {nameInitials(selectedClient.name)}
                    </span>
                    <div>
                      <h4>{selectedClient.name}</h4>
                      <p className="record-meta">
                        {selectedClient.phone ? <span>{formatPhoneBr(selectedClient.phone)}</span> : null}
                        {selectedClient.email ? <span>{selectedClient.email}</span> : null}
                        {selectedClient.birthDate ? <span>Nascimento {formatDatePt(selectedClient.birthDate)}</span> : null}
                        {lastAppointmentByClientName.get(normalizeClientNameKey(selectedClient.name))?.date ? (
                          <span>
                            Último atendimento{" "}
                            {formatDatePt(lastAppointmentByClientName.get(normalizeClientNameKey(selectedClient.name)).date)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="client-modal-header-actions">
                    <button
                      type="button"
                      className="secondary-btn record-action"
                      aria-label="Editar cadastro"
                      onClick={() => handleEditClient(selectedClient)}
                    >
                      <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 20h4L19 9l-4-4L4 16z" />
                      </svg>
                      <span className="record-action-label">Editar cadastro</span>
                    </button>
                    <button
                      type="button"
                      className="record-menu-trigger"
                      aria-label={isRecordMenuOpen ? "Fechar links para a cliente" : "Links para a cliente"}
                      aria-expanded={isRecordMenuOpen}
                      onClick={() => setIsRecordMenuOpen((previous) => !previous)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                      </svg>
                      <span className="record-menu-trigger-label">Links para a cliente</span>
                      <svg className="record-menu-chevron" viewBox="0 0 24 24" aria-hidden="true">
                        <path d={isRecordMenuOpen ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="secondary-btn record-action record-action-icon"
                      aria-label="Exportar PDF"
                      title="Exportar PDF"
                      onClick={handleExportAnamnesePdf}
                    >
                      <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="primary-btn record-action"
                      aria-label="Nova sessão"
                      onClick={handleStartNewSession}
                    >
                      <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span className="record-action-label">Nova sessão</span>
                    </button>
                    <ModalClose onClick={handleCloseClientView} />
                    {isRecordMenuOpen ? (
                      <div className="record-menu-dropdown" role="dialog" aria-label="Menu da cliente">
                        {clientHasAnamnese && !isEditingAnamnese ? (
                          <button
                            type="button"
                            className="record-menu-item"
                            onClick={() => {
                              setSelectedClientView(CLIENT_VIEWS.ANAMNESE);
                              handleStartEditAnamnese();
                              setIsRecordMenuOpen(false);
                            }}
                          >
                            Editar ficha
                          </button>
                        ) : null}
                        {clientHasAnamnese && isEditingAnamnese ? (
                          <button
                            type="button"
                            className="record-menu-item"
                            onClick={() => {
                              handleCancelEditAnamnese();
                              setIsRecordMenuOpen(false);
                            }}
                          >
                            Cancelar edição
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="record-menu-item"
                          onClick={() => {
                            handleExportAnamnesePdf();
                            setIsRecordMenuOpen(false);
                          }}
                        >
                          Exportar PDF
                        </button>
                        <div className="record-menu-divider" />
                        <RecordLinkRow
                          label="Anamnese"
                          link={anamneseLinks[0]}
                          busy={shareBusy === "anamnese"}
                          phone={selectedClient.phone}
                          messageTemplate={userProfile?.whatsappMessage}
                          onCreate={() => handleCreateClientLink("anamnese")}
                          onCopy={() => copyShareLink(anamneseLinks[0].id, "anamnese")}
                        />
                        <RecordLinkRow
                          label="Coleta de feedback"
                          link={followupLinks.find((link) => link.moment === "feedback")}
                          busy={shareBusy === "followup-feedback"}
                          phone={selectedClient.phone}
                          messageTemplate={userProfile?.whatsappMessage}
                          onCreate={() => handleCreateClientLink("acompanhamento", "feedback")}
                          onCopy={() => copyShareLink(followupLinks.find((link) => link.moment === "feedback").id, "followup")}
                        />
                        <RecordLinkRow
                          label="Uso de imagem"
                          link={consentLinks[0]}
                          busy={shareBusy === "consent"}
                          phone={selectedClient.phone}
                          messageTemplate={userProfile?.whatsappMessage}
                          onCreate={() => handleCreateClientLink("consentimento")}
                          onCopy={() => copyShareLink(consentLinks[0].id, "consent")}
                        />
                        <div className="record-menu-row">
                          <span>Evolução</span>
                          <span className="record-menu-row-actions">
                            {evolutionLink ? (
                              <button
                                type="button"
                                className="record-menu-hint"
                                disabled={Boolean(shareBusy)}
                                onClick={() => copyShareLink(evolutionLink.id, "charts")}
                              >
                                Copiar
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="record-menu-hint"
                              disabled={!phoneKey(selectedClient.phone)}
                              onClick={openEvolutionComposer}
                            >
                              {!phoneKey(selectedClient.phone) ? "Sem telefone" : evolutionLink ? "Editar" : "Preparar"}
                            </button>
                          </span>
                        </div>
                        {shareNotice ? (
                          <p className={shareNotice.tone === "error" ? "error-text record-menu-feedback" : "success-text record-menu-feedback"}>
                            {shareNotice.text}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </header>
                <div className="client-modal-tabs" role="tablist" aria-label="Abas do prontuário">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isAnamneseViewOpen}
                    className={isAnamneseViewOpen ? "client-modal-tab active" : "client-modal-tab"}
                    onClick={(event) => {
                      setSelectedClientView(CLIENT_VIEWS.ANAMNESE);
                      event.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest" });
                    }}
                  >
                    Anamnese
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isFollowupViewOpen}
                    className={isFollowupViewOpen ? "client-modal-tab active" : "client-modal-tab"}
                    onClick={(event) => {
                      setSelectedClientView(CLIENT_VIEWS.FOLLOWUP);
                      event.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest" });
                    }}
                  >
                    Acompanhamentos
                    {checkpoints.length > 0 ? <span className="tab-count">{checkpoints.length}</span> : null}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isChartsViewOpen}
                    className={isChartsViewOpen ? "client-modal-tab active" : "client-modal-tab"}
                    onClick={(event) => {
                      setSelectedClientView(CLIENT_VIEWS.CHARTS);
                      event.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest" });
                    }}
                  >
                    Gráficos
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isTermsViewOpen}
                    className={isTermsViewOpen ? "client-modal-tab active" : "client-modal-tab"}
                    onClick={(event) => {
                      setSelectedClientView(CLIENT_VIEWS.TERMS);
                      event.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest" });
                    }}
                  >
                    Termos
                  </button>
                </div>
                <div className="client-modal-content">
              {isAnamneseViewOpen ? (
                <section className="anamnese-panel">
                  <form className="anamnese-layout" onSubmit={handleSaveAnamnese}>
                <PainMapSelector
                  painSelections={anamneseForm.painSelections}
                  onSelectRegion={handleUpsertPainSelection}
                  onRemoveRegion={handleRemovePainSelection}
                  isEditable
                />
                <div className="anamnese-questions">
                  {answeredAnamneseLink || clientAnamneseAnswer ? (
                    <p className="anamnese-answered">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m5 12 4.2 4.2L19 7" />
                      </svg>
                      <span>
                        Respondida pela cliente
                        {formatTimestampDate(clientAnamneseAnswer?.at || answeredAnamneseLink?.respondedAt || answeredAnamneseLink?.updatedAt || answeredAnamneseLink?.createdAt)
                          ? ` em ${formatTimestampDate(clientAnamneseAnswer?.at || answeredAnamneseLink?.respondedAt || answeredAnamneseLink?.updatedAt || answeredAnamneseLink?.createdAt)}`
                          : ""}{" "}
                        pelo link de anamnese. Você pode completar e ajustar.
                      </span>
                    </p>
                  ) : null}
                  <div className="anamnese-questions-body">
                <section className="anamnese-section" id="anamnese-perguntas">
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
                  <div className="question-block">
                    <p className="question-title">
                      Tipo de dor <span className="question-hint">· pode marcar mais de uma</span>
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
                      <OtherDetail
                        label="Outro"
                        value={anamneseForm.painTypeOther}
                        onChange={(value) => handleAnamneseFieldChange("painTypeOther", value)}
                      />
                    </div>
                  </div>
                  <div className="question-block">
                    <p className="question-title">Intensidade da dor</p>
                    <div className="pain-scale" role="radiogroup" aria-label="Intensidade da dor de 0 a 10">
                      {Array.from({ length: 11 }, (_, level) => {
                        const selected = String(anamneseForm.painScale) !== "" && Number(anamneseForm.painScale) === level;
                        return (
                          <button
                            key={`pain-scale-${level}`}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={selected ? "active" : ""}
                            onClick={() => handleAnamneseFieldChange("painScale", String(level))}
                          >
                            {level}
                          </button>
                        );
                      })}
                    </div>
                    <div className="pain-scale-caption">
                      <span>Nenhuma dor</span>
                      <span>Máxima</span>
                    </div>
                  </div>
                  <div className="question-block">
                    <p className="question-title">Objetivos estéticos</p>
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
                      <OtherDetail
                        label="Outro"
                        value={anamneseForm.aestheticGoalsOther}
                        onChange={(value) => handleAnamneseFieldChange("aestheticGoalsOther", value)}
                      />
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
                </div>
                </section>
                <section className="anamnese-section" id="anamnese-habitos">
                <h5>Hábitos</h5>
                <div className="form">
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
                </section>

                <section className="anamnese-section" id="anamnese-saude">
                <h5>Saúde</h5>
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
                </section>

                {selectedClient.sex === "female" ? (
                  <section className="anamnese-section" id="anamnese-mulheres">
                    <h5>Para mulheres</h5>
                    <div className="form grid-form">
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
                  </section>
                ) : null}

                <section className="anamnese-section" id="anamnese-conclusao">
                <h5>Conclusão</h5>
                <label>
                  Qual área do corpo gostaria de mais atenção?
                  <textarea
                    value={anamneseForm.bodyFocus}
                    onChange={(event) => handleAnamneseFieldChange("bodyFocus", event.target.value)}
                  />
                </label>
                <label>
                  Observações gerais
                  <span className="muted-text">Visível só para a clínica. A cliente não preenche e não vê este campo.</span>
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
                {anamneseMessage ? <p className="success-text">{anamneseMessage}</p> : null}
                </section>
                  </div>
                  <footer className="anamnese-footer">
                    <p className="anamnese-sections">
                      <span>Seções:</span>
                      {[
                        ["anamnese-perguntas", "Perguntas-chave"],
                        ["anamnese-habitos", "Hábitos"],
                        ["anamnese-saude", "Saúde"],
                        ...(selectedClient.sex === "female" ? [["anamnese-mulheres", "Para mulheres"]] : []),
                        ["anamnese-conclusao", "Conclusão"]
                      ].map(([sectionId, sectionLabel], index, sections) => (
                        <span key={sectionId}>
                          {index > 0 ? <span aria-hidden="true"> · </span> : " "}
                          <button
                            type="button"
                            onClick={() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                          >
                            {sectionLabel}
                          </button>
                        </span>
                      ))}
                    </p>
                    <button className="primary-btn" type="submit">
                      Salvar ficha
                    </button>
                  </footer>
                </div>
                  </form>
                </section>
              ) : null}

              {isFollowupViewOpen ? (
                <section className="followup-panel">
                    <div className="followup-layout">
                      <div className="followup-list-column">
                        <header className="followup-list-header">
                          <p>
                            {followupSessionCount === 1 ? "1 sessão" : `${followupSessionCount} sessões`}
                            {followupFeedbackCount === 1
                              ? " e 1 feedback da cliente"
                              : followupFeedbackCount > 1
                                ? ` e ${followupFeedbackCount} feedbacks da cliente`
                                : ""}
                          </p>
                          <button type="button" className="secondary-btn" onClick={openParameterEditor}>
                            Adicionar parâmetro
                          </button>
                        </header>
                        {sortedFollowups.length === 0 ? (
                          <p className="empty">Nenhum registro ainda.</p>
                        ) : (
                          <ul className="followup-session-list">
                            {sortedFollowups.map((checkpoint) => {
                              const feedback = isClientFeedback(checkpoint);
                              const photoCount = photosByCheckpoint.grouped.get(checkpoint.id)?.length || 0;
                              return (
                                <li key={checkpoint.id}>
                                  <button
                                    type="button"
                                    className={activeFollowup?.id === checkpoint.id ? "followup-session is-selected" : "followup-session"}
                                    onClick={() => setSelectedCheckpointId(checkpoint.id)}
                                  >
                                    {feedback ? (
                                      <span className="followup-session-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24">
                                          <path d="M6 6h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-3 3v-3H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
                                        </svg>
                                      </span>
                                    ) : (
                                      <span className="followup-session-number">{checkpoint.sessionNumber || "•"}</span>
                                    )}
                                    <span className="followup-session-main">
                                      <span className="followup-session-title">
                                        <strong>
                                          {feedback
                                            ? "Feedback da cliente"
                                            : `Sessão ${checkpoint.sessionNumber || ""}${checkpoint.sessionType ? ` · ${checkpoint.sessionType}` : ""}`.trim()}
                                        </strong>
                                        {feedback ? <em>Enviado pelo link</em> : null}
                                        {!feedback && photoCount > 0 ? <span>{photoCount} foto{photoCount === 1 ? "" : "s"}</span> : null}
                                      </span>
                                      <span className="followup-session-chips">
                                        <span>Dor {checkpoint.painLevel ?? 0}</span>
                                        <span>Estresse {checkpoint.stressLevel ?? 0}</span>
                                        <span>Sono {formatSleepChip(checkpoint.sleepHours, feedback)}</span>
                                      </span>
                                    </span>
                                    <time>{formatDayMonth(checkpoint.date)}</time>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {photosByCheckpoint.unlinked.length > 0 ? (
                          <section className="photo-analysis-section">
                            <h5>Fotos sem acompanhamento vinculado</h5>
                            <ul className="list photo-analysis-list">
                              {photosByCheckpoint.unlinked.map((analysis) => (
                                <PhotoAnalysisSummary
                                  key={analysis.id}
                                  analysis={{
                                    ...analysis,
                                    positionLabel: `${formatDatePt(analysis.date)} • ${analysis.positionLabel || "Posição não informada"}`
                                  }}
                                  onRemove={() => handleDeletePhotoAnalysis(analysis.id)}
                                />
                              ))}
                            </ul>
                          </section>
                        ) : null}
                      </div>
                      <SessionDetail
                        checkpoint={activeFollowup}
                        photos={activeFollowup ? photosByCheckpoint.grouped.get(activeFollowup.id) || [] : []}
                        onDelete={async (checkpointId) => {
                          await handleDeleteCheckpoint(checkpointId);
                          setSelectedCheckpointId("");
                        }}
                      />
                    </div>

                  {followupScreen === "create" && selectedClient ? (
                  <div
                    className="client-modal-backdrop app-modal-backdrop session-modal-backdrop"
                    onPointerDown={(event) => {
                      if (event.target === event.currentTarget) {
                        setIsPhotoComposerOpen(false);
                        setFollowupScreen("list");
                      }
                    }}
                  >
                  <section
                    className="session-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Nova sessão"
                    onClick={(event) => event.stopPropagation()}
                  >
                  <header className="profile-modal-header">
                    <div>
                      <h4>Nova sessão</h4>
                      <p>{selectedClient.name} · Sessão {checkpointForm.sessionNumber || getNextSessionNumber(checkpoints)}</p>
                    </div>
                    <ModalClose
                      onClick={() => {
                        setIsPhotoComposerOpen(false);
                        setFollowupScreen("list");
                      }}
                    />
                  </header>
                  <form
                    id="followup-checkpoint-form"
                    className="form session-form"
                    onSubmit={handleAddCheckpoint}
                  >
                    <div className="session-form-row">
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
                    </div>
                    <ScaleChoice
                      label="Dor"
                      hint="0 nenhuma · 10 máxima"
                      value={checkpointForm.painLevel}
                      onChange={(value) => handleCheckpointFieldChange("painLevel", value)}
                    />
                    <ScaleChoice
                      label="Estresse / tensão"
                      hint="0 tranquila · 10 muito tensa"
                      value={checkpointForm.stressLevel}
                      onChange={(value) => handleCheckpointFieldChange("stressLevel", value)}
                    />
                    <div className="session-form-row">
                      <label>
                        Sono
                        <span className="input-suffix">
                          <input
                            type="number"
                            min="0"
                            max="12"
                            step="0.5"
                            value={checkpointForm.sleepHours}
                            onChange={(event) => handleCheckpointFieldChange("sleepHours", event.target.value)}
                          />
                          <span>horas</span>
                        </span>
                      </label>
                      {trackingParameters.map((parameter) => (
                        <label key={parameter.id}>
                          {parameter.name}
                          <span className="input-suffix">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={checkpointForm.parameterValues?.[parameter.id] ?? ""}
                              onChange={(event) => handleCheckpointFieldChange("parameterValues", {
                                ...(checkpointForm.parameterValues || {}),
                                [parameter.id]: event.target.value
                              })}
                            />
                            <span>{parameter.unit}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    {checkpointError ? <p className="error-text">{checkpointError}</p> : null}
                    <label>
                      Observações da sessão
                      <textarea
                        value={checkpointForm.observations}
                        onChange={(event) => handleCheckpointFieldChange("observations", event.target.value)}
                        rows={3}
                      />
                    </label>
                    <div className="session-photo-field">
                      <span>Fotos</span>
                      <div className="session-photo-tiles">
                        {draftPhotos.map((analysis) => (
                          <figure key={analysis.localId} className="session-photo-tile">
                            {analysis.imageDataUrl ? <img src={analysis.imageDataUrl} alt={analysis.positionLabel || "Foto da sessão"} /> : null}
                            <figcaption>{analysis.positionLabel || "Foto"}</figcaption>
                            <button
                              type="button"
                              aria-label={`Remover foto ${analysis.positionLabel || ""}`.trim()}
                              onClick={() =>
                                setDraftPhotos((previous) =>
                                  previous.filter((item) => item.localId !== analysis.localId)
                                )
                              }
                            >
                              ×
                            </button>
                          </figure>
                        ))}
                        <button type="button" className="session-photo-add" onClick={() => setIsPhotoComposerOpen(true)}>
                          <span aria-hidden="true">+</span>
                          Adicionar
                        </button>
                      </div>
                      {photoMessage ? (
                        <p className={photoMessageTone === "error" ? "error-text" : "success-text"}>{photoMessage}</p>
                      ) : null}
                    </div>
                    <footer className="session-modal-footer">
                      <button type="button" className="session-new-parameter" onClick={openParameterEditor}>
                        + Novo parâmetro
                      </button>
                      <div className="session-modal-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => {
                            setIsPhotoComposerOpen(false);
                            setFollowupScreen("list");
                          }}
                        >
                          Cancelar
                        </button>
                        <button className="primary-btn" type="submit" disabled={isSavingCheckpoint}>
                          {isSavingCheckpoint ? "Salvando..." : "Registrar sessão"}
                        </button>
                      </div>
                    </footer>
                  </form>

                  </section>
                  {isPhotoComposerOpen ? (
                  <div
                    className="client-modal-backdrop app-modal-backdrop photo-composer-backdrop"
                    onPointerDown={(event) => {
                      if (event.target === event.currentTarget) setIsPhotoComposerOpen(false);
                    }}
                  >
                  <section
                    className="appointment-modal photo-composer"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Adicionar foto"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <header className="profile-modal-header">
                      <div>
                        <h4>Adicionar foto</h4>
                        <p>
                          A foto fica vinculada à sessão {checkpointForm.sessionNumber || getNextSessionNumber(checkpoints)} de {selectedClient.name}.
                        </p>
                      </div>
                      <ModalClose onClick={() => setIsPhotoComposerOpen(false)} />
                    </header>
                    <form className="form photo-composer-form" onSubmit={handleAddPhotoAnalysis}>
                      <div className="photo-composer-layout">
                        <PhotoMeasurementEditor
                          imageDataUrl={photoForm.imageDataUrl}
                          measurements={photoForm.measurements}
                          activeMeasurementType={photoForm.activeMeasurementType}
                          activePoints={photoForm.activePoints}
                          onSelectFile={handlePhotoFileSelect}
                          onChangeActivePoints={handlePhotoPointsChange}
                          onMeasurementTypeChange={handlePhotoMeasurementTypeChange}
                          onUndoActivePoint={() =>
                            setPhotoForm((previous) => ({
                              ...previous,
                              activePoints: previous.activePoints.slice(0, -1)
                            }))
                          }
                        />
                        <div className="photo-composer-side">
                          <label>
                            Data deste acompanhamento
                            <input type="date" value={photoForm.date} readOnly />
                          </label>
                          <div className="photo-position-field">
                            <span>Posição da foto</span>
                            <div className="photo-position-options" role="radiogroup" aria-label="Posição da foto">
                              {PHOTO_POSITION_OPTIONS.map((option) => (
                                <button
                                  key={`photo-position-${option}`}
                                  type="button"
                                  role="radio"
                                  aria-checked={photoForm.positionLabel === option}
                                  className={`photo-position-choice${photoForm.positionLabel === option ? " is-selected" : ""}`}
                                  onClick={() =>
                                    setPhotoForm((previous) => ({
                                      ...previous,
                                      positionLabel: option,
                                      positionCustom: ""
                                    }))
                                  }
                                >
                                  {option}
                                </button>
                              ))}
                              <button
                                type="button"
                                role="radio"
                                aria-checked={isCustomPhotoPosition(photoForm.positionLabel)}
                                className={`photo-position-choice is-other${isCustomPhotoPosition(photoForm.positionLabel) ? " is-selected" : ""}`}
                                onClick={() =>
                                  setPhotoForm((previous) => ({
                                    ...previous,
                                    positionLabel: PHOTO_POSITION_OTHER
                                  }))
                                }
                              >
                                Outra
                              </button>
                            </div>
                            {isCustomPhotoPosition(photoForm.positionLabel) ? (
                              <input
                                value={photoForm.positionCustom}
                                onChange={(event) => handlePhotoFieldChange("positionCustom", event.target.value)}
                                placeholder="Escreva qual foi a posição"
                                aria-label="Posição personalizada da foto"
                                autoFocus
                                required
                              />
                            ) : null}
                          </div>
                          <div className="photo-measure-field">
                            <span>Medições nesta foto</span>
                            {photoForm.measurements.length > 0 ? (
                              <ul className="photo-measure-list">
                                {photoForm.measurements.map((measurement, index) => (
                                  <li key={measurement.id}>
                                    <span className="photo-measure-index">{index + 1}</span>
                                    <strong>{measurementKindLabel(measurement)}</strong>
                                    <em>{measurementBadgeText(measurement)}</em>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMeasurement(measurement.id)}
                                      aria-label={`Remover medição ${index + 1}`}
                                    >
                                      ×
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="photo-measure-empty">Nenhuma medição ainda.</p>
                            )}
                            <p>A mesma foto pode ter várias linhas e ângulos.</p>
                          </div>
                          <label>
                            Observações da foto
                            <textarea
                              value={photoForm.notes}
                              onChange={(event) => handlePhotoFieldChange("notes", event.target.value)}
                              placeholder="Ex.: alinhamento, assimetria, evolução visual"
                              rows={3}
                            />
                          </label>
                        </div>
                      </div>
                      {photoMessage ? (
                        <p className={photoMessageTone === "error" ? "error-text" : "success-text"}>{photoMessage}</p>
                      ) : null}
                      <footer className="photo-composer-footer">
                        <button
                          type="button"
                          className="photo-clear-btn"
                          onClick={() =>
                            setPhotoForm((previous) => ({
                              ...buildEmptyPhotoAnalysis(),
                              date: checkpointForm.date || previous.date || getTodayISODate()
                            }))
                          }
                        >
                          Limpar foto
                        </button>
                        <div className="photo-composer-actions">
                          <button type="button" className="secondary-btn" onClick={() => setIsPhotoComposerOpen(false)}>
                            Cancelar
                          </button>
                          <button className="primary-btn" type="submit">
                            Incluir na sessão
                          </button>
                        </div>
                      </footer>
                    </form>
                  </section>
                  </div>
                  ) : null}
                  </div>
                  ) : null}
                </section>
              ) : null}

              {isChartsViewOpen ? (
                <section className="followup-panel">
                  <div className="record-charts">
                    <WellnessScoreChart points={metricChartData} />
                    <ProgressLineChart
                      title="Dor x estresse"
                      points={metricChartData}
                      firstMetric={{ field: "painLevel", label: "Dor" }}
                      secondMetric={{ field: "stressLevel", label: "Estresse" }}
                      maxValue={10}
                    />
                    <SleepBarChart points={metricChartData} />
                    <InitialVsCurrentChart points={metricChartData} />
                    <SessionTypeDistributionChart points={checkpointChartData} />
                    {angleChartSeries.map((series) => (
                      <AngleProgressChart key={series.label} series={series} />
                    ))}
                    {parameterChartSeries
                      .filter((series) => series.points.length > 0)
                      .map((series) => (
                        <ParameterProgressChart key={series.id} series={series} />
                      ))}
                  </div>
                </section>
              ) : null}

              {isTermsViewOpen ? (
                <section className="followup-panel">
                  {consentLinks.length === 0 ? (
                    <p className="consent-empty">Nenhum termo enviado. O link fica em Links para a cliente.</p>
                  ) : (
                    <ul className="consent-list">
                      {consentLinks.map((link) => {
                        const answered = link.imageUse === "autorizado" || link.imageUse === "negado";
                        const stamp = formatConsentStamp(answered ? (link.respondedAt || link.updatedAt || link.createdAt) : link.createdAt);
                        const statusClass = link.imageUse === "negado"
                          ? "consent-status is-denied"
                          : link.imageUse === "autorizado"
                            ? "consent-status"
                            : "consent-status is-waiting";
                        return (
                          <li key={link.id} className="consent-card">
                            <span className="consent-icon" aria-hidden="true">
                              <svg viewBox="0 0 24 24">
                                <path d="M4.5 8.2h2.1l1.3-2h8.2l1.3 2h2.1A1.5 1.5 0 0 1 21 9.7v8.1a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.8V9.7a1.5 1.5 0 0 1 1.5-1.5Z" />
                                <circle cx="12" cy="13.4" r="3" />
                              </svg>
                            </span>
                            <div className="consent-copy">
                              <div className="consent-card-title">
                                <h5>Uso de imagem</h5>
                                <span className={statusClass}>{consentDecisionLabel(link)}</span>
                              </div>
                              <p className="consent-signed">
                                {answered ? (
                                  link.signatureName ? (
                                    <>
                                      Assinado como <strong>{link.signatureName}</strong>
                                      {stamp ? ` em ${stamp}` : ""}, pelo link enviado à cliente.
                                    </>
                                  ) : (
                                    <>Respondido{stamp ? ` em ${stamp}` : ""}, pelo link enviado à cliente.</>
                                  )
                                ) : (
                                  <>Link enviado à cliente{stamp ? ` em ${stamp}` : ""}. Aguardando a resposta.</>
                                )}
                              </p>
                              <p className="consent-summary">{consentSummary(link)}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              ) : null}
                </div>
              </section>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === TABS.AVISOS ? (
        <NotificationLists uid={user.uid} clients={clients} shareLinks={shareLinks} clinicName={currentClinicName} onSummaryChange={setNoticeSummary} />
      ) : null}

      {activeTab === TABS.SERVICOS ? (
        <section className="services-page">
          <header className="page-header">
            <div>
              <h1>Serviços</h1>
              <p>Procedimentos e preços usados ao marcar atendimentos.</p>
            </div>
            <div className="page-actions services-add-actions">
              <button
                type="button"
                className="primary-btn services-add-btn"
                aria-label="Novo serviço"
                onClick={() => setIsServiceSheetOpen(true)}
              >
                <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </header>

          <div className="services-layout">
            <article className="card table-card">
              <div className="table-card-header">
                <h2>Catálogo</h2>
                <span>
                  {services.length} serviço{services.length === 1 ? "" : "s"}
                </span>
              </div>
              {services.length === 0 ? (
                <p className="table-empty">Nenhum serviço cadastrado.</p>
              ) : (
                <ul className="data-table services-table">
                  <li className="data-table-head" aria-hidden="true">
                    <span>Serviço</span>
                    <span>Preço</span>
                    <span />
                  </li>
                  {[...services]
                    .sort((first, second) => String(first.title || "").localeCompare(String(second.title || ""), "pt-BR"))
                    .map((service) => (
                      <li key={service.id}>
                        <span className="services-name">
                          <span className="services-icon" aria-hidden="true">
                            <NavIcon tab={TABS.SERVICOS} />
                          </span>
                          <strong>{service.title}</strong>
                        </span>
                        <span className="services-price">{formatBRL(service.price)}</span>
                        <span className="row-actions">
                          <button
                            type="button"
                            className="icon-btn is-danger services-delete-btn"
                            aria-label={`Excluir ${service.title}`}
                            onClick={() => handleDeleteByCollection("services", service.id)}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M5 7h14M10 11v6M14 11v6M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12M9.5 7V5h5v2" />
                            </svg>
                          </button>
                          <span className="row-menu services-row-menu">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Ações de ${service.title}`}
                              aria-expanded={openServiceMenuId === service.id}
                              onClick={() => setOpenServiceMenuId((current) => (current === service.id ? "" : service.id))}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="5" r="1.6" />
                                <circle cx="12" cy="12" r="1.6" />
                                <circle cx="12" cy="19" r="1.6" />
                              </svg>
                            </button>
                            {openServiceMenuId === service.id ? (
                              <span className="row-menu-dropdown">
                                <button
                                  type="button"
                                  className="is-danger"
                                  onClick={() => {
                                    setOpenServiceMenuId("");
                                    handleDeleteByCollection("services", service.id);
                                  }}
                                >
                                  Excluir serviço
                                </button>
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </article>

            <div className={isServiceSheetOpen ? "services-form-wrap is-open" : "services-form-wrap"}>
            <button
              type="button"
              className="services-sheet-backdrop"
              aria-label="Fechar"
              tabIndex={-1}
              onClick={() => setIsServiceSheetOpen(false)}
            />
            <form
              className="card services-form"
              onSubmit={(event) => {
                handleAddService(event);
                setIsServiceSheetOpen(false);
              }}
            >
              <div className="services-form-header">
                <div>
                  <h2>Adicionar serviço</h2>
                  <p>Aparece na lista ao marcar um atendimento.</p>
                </div>
                <ModalClose onClick={() => setIsServiceSheetOpen(false)} />
              </div>
              <label>
                Nome do serviço
                <input
                  value={serviceTitle}
                  onChange={(event) => setServiceTitle(event.target.value)}
                  placeholder="Ex.: Limpeza de pele"
                  required
                />
              </label>
              <label>
                Preço
                <span className="input-affix">
                  <span aria-hidden="true">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={servicePrice}
                    onChange={(event) => setServicePrice(event.target.value)}
                    placeholder="0,00"
                  />
                </span>
              </label>
              <button className="primary-btn" type="submit">
                Adicionar serviço
              </button>
            </form>
            </div>
          </div>
        </section>
      ) : null}

      {isProfileModalOpen ? (
        <div
          className="client-modal-backdrop app-modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) handleCloseProfileModal();
          }}
        >
          <section
            className="profile-modal account-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Cadastro do profissional"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="profile-modal-header">
              <div>
                <h4>Meu cadastro</h4>
                <p>Estes dados aparecem nos links que as clientes recebem.</p>
              </div>
              <ModalClose onClick={handleCloseProfileModal} />
            </header>

            <form className="account-form" onSubmit={handleSaveProfile}>
              <div className="account-layout">
                <div className="account-logo">
                  <div className="account-logo-frame">
                    {profileForm.logoDataUrl ? (
                      <img src={profileForm.logoDataUrl} alt="Logo da clínica" />
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
                        <circle cx="9" cy="9" r="1.5" />
                        <path d="m4.5 16.5 4.2-3.4 2.6 2.1 2.8-3.2 5.4 4.5" />
                      </svg>
                    )}
                  </div>
                  <strong>Logo da clínica</strong>
                  <label className="secondary-btn logo-file-btn">
                    Escolher imagem
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      aria-label="Escolher logo"
                      onChange={handleProfileLogo}
                    />
                  </label>
                  <span className="field-hint">PNG com fundo transparente fica melhor.</span>
                  {profileForm.logoDataUrl ? (
                    <button type="button" className="account-logo-remove" onClick={() => handleProfileFieldChange("logoDataUrl", "")}>
                      Remover imagem
                    </button>
                  ) : null}
                </div>
                <div className="account-fields grid-form">
                  <label>
                    Nome completo
                    <input
                      value={profileForm.fullName}
                      onChange={(event) => handleProfileFieldChange("fullName", event.target.value)}
                      placeholder="Seu nome"
                      required
                    />
                  </label>
                  <label>
                    Nome da clínica
                    <input
                      value={profileForm.clinicName}
                      onChange={(event) => handleProfileFieldChange("clinicName", event.target.value)}
                      placeholder="Clínica Estética"
                    />
                  </label>
                  <label>
                    WhatsApp da clínica
                    <input
                      value={formatPhoneBr(profileForm.phone)}
                      onChange={(event) => handleProfileFieldChange("phone", readMaskedPhone(event))}
                      placeholder="(00) 00000-0000"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </label>
                  <label>
                    Especialidade
                    <input
                      value={profileForm.professionalRole}
                      onChange={(event) => handleProfileFieldChange("professionalRole", event.target.value)}
                      placeholder="Esteticista"
                    />
                  </label>
                  <h5 className="full-row profile-section-title">Redes sociais</h5>
                  <label>
                    Instagram
                    <span className="handle-field">
                      <span>@</span>
                      <input
                        value={profileForm.instagram}
                        maxLength={80}
                        aria-label="Instagram"
                        onChange={(event) => handleProfileFieldChange("instagram", socialHandle(event.target.value, "instagram.com"))}
                      />
                    </span>
                  </label>
                  <label>
                    TikTok
                    <span className="handle-field">
                      <span>@</span>
                      <input
                        value={profileForm.tiktok}
                        maxLength={80}
                        aria-label="TikTok"
                        onChange={(event) => handleProfileFieldChange("tiktok", socialHandle(event.target.value, "tiktok.com"))}
                      />
                    </span>
                  </label>
                  <label>
                    Facebook
                    <input
                      value={profileForm.facebook}
                      maxLength={80}
                      onChange={(event) => handleProfileFieldChange("facebook", event.target.value)}
                    />
                  </label>
                  <label>
                    Site
                    <input
                      value={profileForm.website}
                      maxLength={120}
                      placeholder="www.suaclinica.com.br"
                      onChange={(event) => handleProfileFieldChange("website", event.target.value)}
                    />
                  </label>
                  <label className="full-row">
                    Mensagem padrão do WhatsApp
                    <textarea
                      value={profileForm.whatsappMessage}
                      maxLength={500}
                      rows={3}
                      placeholder="Oi! Segue o link do seu acompanhamento: {link}"
                      onChange={(event) => handleProfileFieldChange("whatsappMessage", event.target.value)}
                    />
                    <span className="field-hint">Escreva {"{link}"} onde o endereço deve entrar.</span>
                  </label>
                  {profileError ? <p className="error-text full-row">{profileError}</p> : null}
                  {profileMessage ? <p className="success-text full-row">{profileMessage}</p> : null}
                </div>
              </div>
              <footer className="account-footer">
                <button type="button" className="account-delete" onClick={handleDeleteProfile} disabled={!userProfile}>
                  Excluir minha conta
                </button>
                <div className="account-footer-actions">
                  <button type="button" className="secondary-btn" onClick={handleCloseProfileModal}>
                    Cancelar
                  </button>
                  <button className="primary-btn" type="submit">
                    Salvar alterações
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}


      {isEvolutionComposerOpen && selectedClient ? (
        <div
          className="client-modal-backdrop app-modal-backdrop evolution-composer-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setIsEvolutionComposerOpen(false);
          }}
        >
          <section
            className="profile-modal evolution-composer"
            role="dialog"
            aria-modal="true"
            aria-label="Preparar evolução"
            data-evolution-composer
            onClick={(event) => event.stopPropagation()}
          >
            <header className="profile-modal-header">
              <div>
                <h4>Evolução de {selectedClient.name.split(" ")[0]}</h4>
                <p>A cliente vê este texto junto com os gráficos de bem-estar, dor, estresse e sono.</p>
              </div>
              <ModalClose onClick={() => setIsEvolutionComposerOpen(false)} />
            </header>
            <form className="form evolution-composer-layout" onSubmit={handleUpdateEvolution}>
              <div className="evolution-composer-fields">
                <label>
                  <span className="evolution-field-label">
                    Destaque
                    <span className="evolution-field-count">{evolutionDraft.highlight.length}/{EVOLUTION_HIGHLIGHT_LIMIT}</span>
                  </span>
                  <input
                    value={evolutionDraft.highlight}
                    maxLength={EVOLUTION_HIGHLIGHT_LIMIT}
                    placeholder="Ex: Menos dor depois de 4 sessões"
                    onChange={(event) => setEvolutionDraft((previous) => ({ ...previous, highlight: event.target.value }))}
                  />
                  <span className="field-hint">Frase curta no topo da tela e na imagem para as redes.</span>
                </label>
                <label>
                  <span className="evolution-field-label">
                    Recado da clínica
                    <span className="evolution-field-count">{evolutionDraft.comments.length}/{EVOLUTION_TEXT_LIMIT}</span>
                  </span>
                  <textarea
                    value={evolutionDraft.comments}
                    maxLength={EVOLUTION_TEXT_LIMIT}
                    rows={4}
                    placeholder="Uma mensagem para a cliente ler no link"
                    onChange={(event) => setEvolutionDraft((previous) => ({ ...previous, comments: event.target.value }))}
                  />
                </label>
                <label>
                  <span className="evolution-field-label">
                    Cuidados em casa
                    <span className="evolution-field-count">{evolutionDraft.homeCare.length}/{EVOLUTION_TEXT_LIMIT}</span>
                  </span>
                  <textarea
                    value={evolutionDraft.homeCare}
                    maxLength={EVOLUTION_TEXT_LIMIT}
                    rows={4}
                    placeholder={"Protetor solar todos os dias\nHidratante à noite"}
                    onChange={(event) => setEvolutionDraft((previous) => ({ ...previous, homeCare: event.target.value }))}
                  />
                  <span className="field-hint">Um cuidado por linha.</span>
                </label>
              </div>
              <EvolutionPhonePreview
                clinicName={currentClinicName}
                clientName={selectedClient.name}
                highlight={evolutionDraft.highlight}
                comments={evolutionDraft.comments}
                homeCare={evolutionDraft.homeCare}
                latest={checkpointChartData[checkpointChartData.length - 1] || null}
              />
              {shareNotice?.scope === "charts" ? (
                <p className={`evolution-composer-notice ${shareNotice.tone === "error" ? "error-text" : "success-text"}`}>{shareNotice.text}</p>
              ) : null}
              <div className="evolution-composer-footer">
                <p className={evolutionLink || composerLinkReady ? "evolution-publish-status" : "evolution-publish-status is-pending"}>
                  {evolutionLink || composerLinkReady
                    ? `Link publicado${formatDayMonthStamp(evolutionLink?.updatedAt || evolutionLink?.createdAt) ? ` em ${formatDayMonthStamp(evolutionLink?.updatedAt || evolutionLink?.createdAt)}` : ""} · a cliente vê a versão salva`
                    : "O link ainda não foi publicado."}
                </p>
                <div className="evolution-composer-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={Boolean(shareBusy) || !(evolutionLink || composerLinkReady)}
                    onClick={() => copyShareLink(evolutionLink?.id || pendingEvolutionTokenRef.current, "charts")}
                  >
                    Copiar link
                  </button>
                  <button className="primary-btn" type="submit" disabled={Boolean(shareBusy)}>
                    {shareBusy === "charts" ? "Salvando..." : evolutionLink || composerLinkReady ? "Salvar e atualizar link" : "Gerar link"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isClientFormOpen ? (
        <div
          className="client-modal-backdrop app-modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) resetClientForm();
          }}
        >
          <section
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editingClientId ? "Editar cadastro da cliente" : "Adicionar nova cliente"}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="profile-modal-header">
              <div>
                <h4>{editingClientId ? "Editar cadastro da cliente" : "Adicionar nova cliente"}</h4>
                <p>Os dados ficam no cadastro da cliente.</p>
              </div>
              <ModalClose onClick={resetClientForm} />
            </header>
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
                  value={formatPhoneBr(clientPhone)}
                  onChange={(event) => setClientPhone(readMaskedPhone(event))}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                  autoComplete="tel"
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
              <button type="button" className="secondary-btn full-row" onClick={resetClientForm}>
                Cancelar
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {isParameterEditorOpen && selectedClient ? (
        <div
          className="client-modal-backdrop app-modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeParameterEditor();
          }}
        >
          <section
            className="profile-modal parameter-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Parâmetros de ${selectedClient.name.trim().split(/\s+/)[0] || selectedClient.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="profile-modal-header">
              <div>
                <h4>Parâmetros de {selectedClient.name.trim().split(/\s+/)[0] || selectedClient.name}</h4>
                <p>Medidas que você acompanha a cada sessão.</p>
              </div>
              <ModalClose onClick={closeParameterEditor} />
            </header>
            <TrackingParameterEditor
              parameters={trackingParameters}
              form={parameterForm}
              error={parameterError}
              busy={parameterBusy}
              onChange={handleParameterFieldChange}
              onAdd={handleAddParameter}
              onRemove={handleRemoveParameter}
              onClose={closeParameterEditor}
            />
          </section>
        </div>
      ) : null}
    </main>
  );
}
