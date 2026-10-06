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
import NotificationLists from "./NotificationLists";
import ClinicNoticeRunner from "./ClinicNoticeRunner";
import ClientReceivedNotices, { clientNoticeTokens } from "./ClientReceivedNotices";
import { createFirstContactLink, createShareLink, importFirstContactRequest, importSubmittedLink, isClientFeedback, sanitizeLogoDataUrl, shareUrl, syncClinicLogo, syncEvolutionInstagram, updateEvolutionLink } from "./shareLinks";
import { EVOLUTION_HIGHLIGHT_LIMIT, EVOLUTION_TEXT_LIMIT, sanitizeEvolutionStory } from "./evolutionStory";
import {
  appointmentAgendaDate,
  approvalMessage,
  bookingStatusLabel,
  formatPhoneBr,
  readMaskedPhone,
  periodLabel,
  refusalMessage,
  rescheduleMessage,
  shareWhatsAppMessage,
  whatsAppUrl
} from "./firstContact";
import { consentDecisionLabel } from "./imageConsent";
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
  chartCeiling,
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

function BookingBadge({ status }) {
  const label = bookingStatusLabel(status);
  if (!label) {
    return null;
  }
  return <span className={`booking-badge is-${status}`}>{label}</span>;
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

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
}

function mixHex(startHex, endHex, amount) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  const mixed = start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function scaleToneColor(value) {
  const safe = Math.min(10, Math.max(0, Number(value) || 0));
  if (safe <= 5) {
    return mixHex("#2f6fed", "#f08a24", safe / 5);
  }
  return mixHex("#f08a24", "#d92d20", (safe - 5) / 5);
}

function ScaleSlider({ label, value, onChange }) {
  const numeric = Math.min(10, Math.max(0, Number(value) || 0));
  const color = scaleToneColor(numeric);
  return (
    <label className="scale-slider">
      <span className="scale-slider-header">
        <span>{label}</span>
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

function formatMeasurementValue(measurement) {
  if (measurement.type === "angle") {
    return `Ângulo ${measurement.angleDegrees ?? "--"}°`;
  }
  return `Linha ${measurement.lineDistancePercent ?? "--"}%`;
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

function MeasurementMarks({ measurements = [], activePoints = [], activeType = "line" }) {
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
                  {index + 1}
                  {point.label}
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
  onCommitMeasurement,
  onRemoveMeasurement,
  onUndoActivePoint,
  onClearActivePoints
}) {
  const [isDragging, setIsDragging] = useState(false);
  const requiredPoints = getRequiredMeasurementPoints(activeMeasurementType);
  const draftMeasurement = buildMeasurement(activeMeasurementType, activePoints);
  const remainingPoints = Math.max(requiredPoints - activePoints.length, 0);

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
      className={`photo-measurement-editor ${isDragging ? "is-dragging" : ""}`}
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
        <>
          <div className="photo-editor-toolbar">
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
            <button type="button" className="secondary-btn" onClick={onUndoActivePoint} disabled={!activePoints.length}>
              Desfazer ponto
            </button>
            <button type="button" className="secondary-btn" onClick={onClearActivePoints} disabled={!activePoints.length}>
              Limpar marcação atual
            </button>
            <button type="button" className="primary-btn" onClick={onCommitMeasurement} disabled={!draftMeasurement}>
              Adicionar medição
            </button>
          </div>
          <p className="muted-text">
            {remainingPoints > 0
              ? `Clique na foto para marcar ${remainingPoints === 1 ? "o próximo ponto" : `mais ${remainingPoints} pontos`} desta ${
                  activeMeasurementType === "angle" ? "medição de ângulo" : "linha"
                }.`
              : "Medição pronta. Adicione-a à foto e continue com outra linha ou outro ângulo."}
          </p>
          <div
            className={`photo-measurement-canvas ${activePoints.length >= requiredPoints ? "is-complete" : ""}`}
            onClick={handleImageClick}
          >
            <img src={imageDataUrl} alt="Foto de acompanhamento para medição" />
            <MeasurementMarks
              measurements={measurements}
              activePoints={activePoints}
              activeType={activeMeasurementType}
            />
          </div>
        </>
      )}

      <div className="photo-measurement-meta">
        <p className="muted-text">
          Medições nesta foto: {measurements.length === 0 ? "nenhuma ainda" : measurements.length}
        </p>
        {draftMeasurement ? (
          <p className="muted-text">Medição atual: {formatMeasurementValue(draftMeasurement)}</p>
        ) : null}
      </div>

      {measurements.length > 0 ? (
        <div className="measurement-chip-list">
          {measurements.map((measurement, index) => (
            <div key={measurement.id} className="measurement-chip">
              <span
                className="measurement-chip-swatch"
                style={{ background: MEASUREMENT_COLORS[index % MEASUREMENT_COLORS.length] }}
              />
              <span>
                {index + 1}. {formatMeasurementValue(measurement)}
              </span>
              <button type="button" onClick={() => onRemoveMeasurement(measurement.id)} aria-label={`Remover medição ${index + 1}`}>
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TrackingParameterEditor({ parameters, form, error, busy, onChange, onAdd, onRemove }) {
  return (
    <section className="tracking-parameters">
      <div>
        <h5>Parâmetros</h5>
        <p className="muted-text">
          Crie uma medida desta cliente e a unidade. Ex.: alcance do ombro direito, em cm.
        </p>
      </div>
      {parameters.length ? (
        <ul className="tracking-parameter-list">
          {parameters.map((parameter) => (
            <li key={parameter.id}>
              <span>
                <strong>{parameter.name}</strong>
                <small>
                  {parameter.unit} · melhora quando {parameter.improveWhen === "down" ? "diminui" : "aumenta"}
                </small>
              </span>
              <button type="button" onClick={() => onRemove(parameter.id)} disabled={busy}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-text">Nenhum parâmetro ainda. Dor, estresse e sono continuam em toda sessão.</p>
      )}
      <form className="tracking-parameter-form" onSubmit={onAdd}>
        <label>
          Nome
          <input
            value={form.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Alcance do ombro direito"
            maxLength={60}
            required
          />
        </label>
        <label>
          Unidade
          <input
            value={form.unit}
            onChange={(event) => onChange({ unit: event.target.value })}
            placeholder="cm"
            maxLength={16}
            required
          />
        </label>
        <label>
          A melhora aparece quando
          <select value={form.improveWhen} onChange={(event) => onChange({ improveWhen: event.target.value })}>
            <option value="up">O valor aumenta</option>
            <option value="down">O valor diminui</option>
          </select>
        </label>
        <button className="secondary-btn" type="submit" disabled={busy}>
          Adicionar parâmetro
        </button>
      </form>
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}

function ParameterProgressChart({ series }) {
  const points = series.points || [];
  const title = `${series.name} (${series.unit})`;
  if (points.length < 2) {
    return (
      <div className="chart-card">
        <h5>{title}</h5>
        <p className="muted-text">
          {points.length === 0
            ? "Ainda não há medição deste parâmetro."
            : "Registre esta medida em pelo menos 2 sessões para gerar o gráfico."}
        </p>
      </div>
    );
  }

  const width = 420;
  const height = 200;
  const padding = 36;
  const maxValue = chartCeiling(points.map((item) => item.value));
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const yLabels = [0, maxValue / 2, maxValue];
  const getX = (index) => (
    points.length === 1 ? padding : padding + (index * plotWidth) / (points.length - 1)
  );
  const getY = (value) => padding + (1 - Math.min(Math.max(Number(value) || 0, 0), maxValue) / maxValue) * plotHeight;
  const linePath = points
    .map((item, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(item.value)}`)
    .join(" ");
  const formatTick = (value) => (Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10));

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
                {formatTick(marker)}
              </text>
            </g>
          );
        })}
        <path d={linePath} className="chart-line chart-line-primary" />
        {points.map((item, index) => (
          <g key={`${item.date}-${index}`}>
            <circle cx={getX(index)} cy={getY(item.value)} r="3" className="chart-point-primary" />
            <text x={getX(index)} y={height - 8} textAnchor="middle" className="chart-axis-x">
              {formatDatePt(item.date)}
            </text>
          </g>
        ))}
      </svg>
      <p className="muted-text chart-footnote">
        Unidade: {series.unit}. A melhora aparece quando o valor {series.improveWhen === "down" ? "diminui" : "aumenta"}.
      </p>
    </div>
  );
}

function SessionDetail({ checkpoint, photos, onBack, onDelete, noticeAction = null }) {
  if (!checkpoint) {
    return (
      <>
        <button type="button" className="secondary-btn" onClick={onBack}>
          Voltar
        </button>
        <p className="muted-text">Este registro não está mais disponível.</p>
      </>
    );
  }

  const feedback = isClientFeedback(checkpoint);

  return (
    <>
      <div className="panel-header">
        <div>
          <h4>
            {formatDatePt(checkpoint.date)}
            {feedback
              ? " · Feedback do cliente"
              : checkpoint.sessionNumber
                ? ` · Sessão ${checkpoint.sessionNumber}`
                : ""}
          </h4>
          <p>{checkpoint.sessionType || "Tipo não informado"}</p>
        </div>
        <div className="panel-header-actions">
          {noticeAction}
          <button type="button" className="secondary-btn" onClick={onBack}>
            Voltar
          </button>
        </div>
      </div>
      <div className="session-detail-metrics">
        <span>Dor {checkpoint.painLevel ?? 0}</span>
        <span>Estresse {checkpoint.stressLevel ?? 0}</span>
        <span>Sono {checkpoint.sleepHours ?? 0}h</span>
        {normalizeReadings(checkpoint.parameters).map((item) => (
          <span key={item.id}>{item.name} {formatParameterValue(item.value, item.unit)}</span>
        ))}
      </div>
      {checkpoint.observations ? <p>{checkpoint.observations}</p> : null}
      {feedback ? null : (
        <>
          <h5>Fotos</h5>
          {photos.length === 0 ? (
            <p className="muted-text">Nenhuma foto nesta sessão.</p>
          ) : (
            <ul className="list photo-analysis-list">
              {photos.map((analysis) => (
                <PhotoAnalysisSummary key={analysis.id} analysis={analysis} />
              ))}
            </ul>
          )}
        </>
      )}
      <button type="button" className="danger-btn" onClick={() => onDelete(checkpoint.id)}>
        {feedback ? "Excluir feedback" : "Excluir sessão"}
      </button>
    </>
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

function AngleProgressChart({ series }) {
  const drawableSeries = (series || [])
    .map((item, index) => ({
      label: item.label,
      color: item.color || MEASUREMENT_COLORS[index % MEASUREMENT_COLORS.length],
      points: (item.points || []).filter(
        (point) => point.date && Number.isFinite(Number(point.angleDegrees))
      )
    }))
    .filter((item) => item.points.length > 0);
  const dates = [...new Set(drawableSeries.flatMap((item) => item.points.map((point) => point.date)))];

  if (dates.length < 2) {
    return (
      <div className="chart-card">
        <h5>Evolução de ângulo</h5>
        <p className="muted-text">Cadastre ângulos em pelo menos 2 datas para gerar o gráfico.</p>
      </div>
    );
  }

  const width = 420;
  const height = 200;
  const padding = 30;
  const maxValue = 180;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const yLabels = [0, 90, 180];

  const getX = (index) =>
    dates.length === 1 ? padding : padding + (index * plotWidth) / (dates.length - 1);

  const getY = (value) =>
    padding + (1 - Math.min(Math.max(Number(value) || 0, 0), maxValue) / maxValue) * plotHeight;

  const buildPath = (points) => {
    let path = "";
    let penDown = false;
    dates.forEach((date, index) => {
      const match = points.find((point) => point.date === date);
      if (!match) {
        penDown = false;
        return;
      }
      path += `${penDown ? "L" : "M"} ${getX(index)} ${getY(match.angleDegrees)} `;
      penDown = true;
    });
    return path.trim();
  };

  return (
    <div className="chart-card">
      <h5>Evolução de ângulo</h5>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Evolução de ângulo">
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
        {drawableSeries.map((serie) => (
          <path key={serie.label} d={buildPath(serie.points)} className="chart-line" style={{ stroke: serie.color }} />
        ))}
        {drawableSeries.map((serie) =>
          serie.points.map((point) => {
            const dateIndex = dates.indexOf(point.date);
            return (
              <circle
                key={`${serie.label}-${point.date}`}
                cx={getX(dateIndex)}
                cy={getY(point.angleDegrees)}
                r="3"
                style={{ fill: serie.color }}
              />
            );
          })
        )}
        {dates.map((date, index) => (
          <text key={date} x={getX(index)} y={height - 8} textAnchor="middle" className="chart-axis-x">
            {formatDatePt(date)}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        {drawableSeries.map((serie) => (
          <span key={serie.label}>
            <i className="legend-dot" style={{ background: serie.color }} />
            {serie.label}
          </span>
        ))}
      </div>
      <p className="muted-text chart-footnote">
        Cada linha acompanha o ângulo pela ordem em que ele foi marcado na foto.
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
  const [appointmentClient, setAppointmentClient] = useState("");
  const [isAppointmentClientListOpen, setIsAppointmentClientListOpen] = useState(false);
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
  const [agendaClosures, setAgendaClosures] = useState([]);
  const [offStart, setOffStart] = useState("");
  const [offEnd, setOffEnd] = useState("");
  const [offRepeat, setOffRepeat] = useState(false);
  const [offBusy, setOffBusy] = useState(false);
  const [offError, setOffError] = useState("");
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
  const [anamneseForm, setAnamneseForm] = useState(buildEmptyAnamnese());
  const [anamneseSnapshot, setAnamneseSnapshot] = useState(buildEmptyAnamnese());
  const [isEditingAnamnese, setIsEditingAnamnese] = useState(false);
  const [clientHasAnamnese, setClientHasAnamnese] = useState(false);
  const [checkpoints, setCheckpoints] = useState([]);
  const [trackingParameters, setTrackingParameters] = useState([]);
  const [parameterForm, setParameterForm] = useState(() => emptyParameterForm());
  const [parameterError, setParameterError] = useState("");
  const [parameterBusy, setParameterBusy] = useState(false);
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
  const selectedNoticeTokens = useMemo(
    () => clientNoticeTokens(selectedClientLinks),
    [selectedClientLinks]
  );

  useEffect(() => {
    pendingEvolutionTokenRef.current = "";
  }, [selectedClientId]);

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
      setPhotoAnalyses([]);
      setPhotoForm(buildEmptyPhotoAnalysis());
      setDraftPhotos([]);
      setPhotoMessage("");
      return undefined;
    }

    setIsEditingAnamnese(false);

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
      setIsEditingAnamnese(false);
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
  const appointmentClientExists =
    Boolean(normalizedAppointmentClientName) &&
    (savedAppointmentClientNames.includes(normalizedAppointmentClientName) ||
      clients.some(
        (client) => (client.name || "").trim().toLowerCase() === normalizedAppointmentClientName
      ));
  const appointmentClientSuggestions = normalizedAppointmentClientName
    ? clients
        .filter((client) => {
          const clientName = (client.name || "").trim().toLowerCase();
          return (
            clientName.includes(normalizedAppointmentClientName) &&
            clientName !== normalizedAppointmentClientName
          );
        })
        .slice(0, 6)
    : [];

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

  const normalizedAppointmentService = appointmentService.trim().toLowerCase();
  const isUndeterminedAppointmentService =
    normalizedAppointmentService === UNDETERMINED_SERVICE_LABEL.toLowerCase();
  const appointmentServiceExists =
    Boolean(normalizedAppointmentService) &&
    (isUndeterminedAppointmentService ||
      savedAppointmentServiceTitles.includes(normalizedAppointmentService) ||
      services.some(
        (service) => (service.title || "").trim().toLowerCase() === normalizedAppointmentService
      ));
  const appointmentServiceSuggestions = [
    ...(isUndeterminedAppointmentService
      ? []
      : [{ id: "undetermined-service", title: UNDETERMINED_SERVICE_LABEL, undetermined: true }]),
    ...services.filter((service) => {
      const serviceTitle = (service.title || "").trim().toLowerCase();
      if (!serviceTitle || serviceTitle === normalizedAppointmentService) {
        return false;
      }
      return !normalizedAppointmentService || serviceTitle.includes(normalizedAppointmentService);
    }).map((service) => ({
      id: service.id,
      title: service.title,
      undetermined: false
    }))
  ];

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

  const handleCommitMeasurement = () => {
    if (!buildMeasurement(photoForm.activeMeasurementType, photoForm.activePoints)) {
      showPhotoFeedback(
        photoForm.activeMeasurementType === "angle"
          ? "Marque os pontos A, B e C antes de adicionar o ângulo."
          : "Marque os pontos A e B antes de adicionar a linha.",
        "error"
      );
      return;
    }
    setPhotoForm((previous) => {
      const measurement = buildMeasurement(previous.activeMeasurementType, previous.activePoints);
      if (!measurement) {
        return previous;
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

  const checkpointChartData = useMemo(() => {
    return sortByDate(checkpoints).filter((item) => item.date && !isClientFeedback(item));
  }, [checkpoints]);

  const parameterChartSeries = useMemo(
    () => parameterSeries(checkpointChartData, trackingParameters),
    [checkpointChartData, trackingParameters]
  );

  const photosByCheckpoint = useMemo(
    () => groupPhotosByCheckpoint(checkpoints, photoAnalyses),
    [checkpoints, photoAnalyses]
  );

  const angleChartSeries = useMemo(() => {
    const photos = sortByDate(photoAnalyses)
      .map((item) => ({
        date: item.date,
        angles: getStoredMeasurements(item).filter(
          (measurement) => measurement.type === "angle" && Number.isFinite(Number(measurement.angleDegrees))
        )
      }))
      .filter((item) => item.date && item.angles.length > 0);
    const maxAngles = photos.reduce((max, item) => Math.max(max, item.angles.length), 0);
    return Array.from({ length: maxAngles }, (_, index) => ({
      label: maxAngles === 1 ? "Ângulo" : `Ângulo ${index + 1}`,
      color: MEASUREMENT_COLORS[index % MEASUREMENT_COLORS.length],
      points: photos
        .filter((item) => item.angles[index])
        .map((item) => ({
          date: item.date,
          angleDegrees: Number(item.angles[index].angleDegrees)
        }))
    }));
  }, [photoAnalyses]);

  const isAnamneseViewOpen = selectedClientView === CLIENT_VIEWS.ANAMNESE;
  const isFollowupViewOpen = selectedClientView === CLIENT_VIEWS.FOLLOWUP;
  const isChartsViewOpen = selectedClientView === CLIENT_VIEWS.CHARTS;
  const isTermsViewOpen = selectedClientView === CLIENT_VIEWS.TERMS;
  const followupChartCards = [
    <AngleProgressChart key="angle" series={angleChartSeries} />,
    <ProgressLineChart
      key="pain-stress"
      title="Evolução da dor x estresse"
      points={checkpointChartData}
      firstMetric={{ field: "painLevel", label: "Dor" }}
      secondMetric={{ field: "stressLevel", label: "Estresse" }}
      maxValue={10}
    />,
    ...parameterChartSeries.map((series) => (
      <ParameterProgressChart key={series.id} series={series} />
    )),
    <SleepBarChart key="sleep" points={checkpointChartData} />,
    <SessionTypeDistributionChart key="session-type" points={checkpointChartData} />,
    <InitialVsCurrentChart key="initial-current" points={checkpointChartData} />
  ];
  const wellnessChartCount = followupChartCards.length + 1;
  const wellnessSpansTwo = wellnessChartCount % 2 === 1;

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

  const toggleAgendaAllDay = async (recurring) => {
    const existing = recurring ? selectedWeekAllDay : selectedDayAllDay;
    if (existing) {
      await removeAgendaClosure(existing.id);
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
  };

  const handleAddAgendaOff = async () => {
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

      <header className="topbar">
        <div className="topbar-row">
          <button
            type="button"
            className="topbar-icon-btn"
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
          <h2>{activeTabLabel}</h2>
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

        <div className="topbar-greeting">
          <h3>Olá, {greetingName}!</h3>
          <p>{greetingLabel}</p>
        </div>
      </header>

      <nav className="tabs" aria-label="Seções">
        <button
          type="button"
          className={activeTab === TABS.INICIO ? "active" : ""}
          onClick={() => setActiveTab(TABS.INICIO)}
        >
          Início
        </button>
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
        <button
          type="button"
          className={activeTab === TABS.AVISOS ? "active" : ""}
          onClick={() => setActiveTab(TABS.AVISOS)}
        >
          Avisos
        </button>
      </nav>

      <nav className="bottom-nav" aria-label="Menu principal">
        <button
          type="button"
          className={activeTab === TABS.INICIO ? "active" : ""}
          onClick={() => setActiveTab(TABS.INICIO)}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 11.5 12 4l8 7.5" />
              <path d="M7 10.5V20h10v-9.5" />
            </svg>
          </span>
          <span>Início</span>
        </button>
        <button
          type="button"
          className={activeTab === TABS.AGENDA ? "active" : ""}
          onClick={() => setActiveTab(TABS.AGENDA)}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M8 3.5v3M16 3.5v3M4 9.5h16" />
            </svg>
          </span>
          <span>Agenda</span>
        </button>
        <button
          type="button"
          className={activeTab === TABS.CLIENTES ? "active" : ""}
          onClick={() => setActiveTab(TABS.CLIENTES)}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="9" cy="9" r="3" />
              <path d="M4.5 18.5c.6-2.4 2.4-3.5 4.5-3.5s3.9 1.1 4.5 3.5" />
              <circle cx="16.5" cy="9.5" r="2.2" />
              <path d="M15.2 15.2c1.6.2 2.9 1 3.5 3" />
            </svg>
          </span>
          <span>Clientes</span>
        </button>
        <button
          type="button"
          className={activeTab === TABS.SERVICOS ? "active" : ""}
          onClick={() => setActiveTab(TABS.SERVICOS)}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
              <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
              <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
              <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
            </svg>
          </span>
          <span>Serviços</span>
        </button>
        <button
          type="button"
          className={activeTab === TABS.AVISOS ? "active" : ""}
          onClick={() => setActiveTab(TABS.AVISOS)}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M6 16h12l-1.2-2.2V10a4.8 4.8 0 0 0-9.6 0v3.8L6 16z" />
              <path d="M10 16.5a2 2 0 0 0 4 0" />
            </svg>
          </span>
          <span>Avisos</span>
        </button>
      </nav>

      {activeTab === TABS.INICIO ? (
        <section className="home-page">
          <article className="home-hero">
            <h3>Resumo de hoje</h3>
            <p>
              {todayAppointments.length === 0
                ? "Nenhum horário marcado para hoje."
                : `${todayAppointments.length} horário${todayAppointments.length > 1 ? "s" : ""} na agenda de hoje.`}
            </p>
            <button className="primary-btn" type="button" onClick={() => setActiveTab(TABS.AGENDA)}>
              Abrir agenda
            </button>
          </article>

          <div className="home-stats">
            <button type="button" onClick={() => setActiveTab(TABS.AGENDA)}>
              <strong>{todayAppointments.length}</strong>
              <span>Hoje</span>
            </button>
            <button type="button" onClick={() => setActiveTab(TABS.CLIENTES)}>
              <strong>{clients.length}</strong>
              <span>Clientes</span>
            </button>
            <button type="button" onClick={() => setActiveTab(TABS.SERVICOS)}>
              <strong>{services.length}</strong>
              <span>Serviços</span>
            </button>
          </div>

          <article className="card">
            <div className="section-header">
              <h3>Agenda de hoje</h3>
              <button className="secondary-btn" type="button" onClick={() => setActiveTab(TABS.AGENDA)}>
                Ver tudo
              </button>
            </div>
            <ul className="list">
              {todayAppointments.length === 0 ? (
                <li className="empty">Nada marcado para hoje.</li>
              ) : (
                todayAppointments.map((appointment) => (
                  <li key={`home-${appointment.id}`} className={appointment.status === "recusado" ? "is-muted" : ""}>
                    <div>
                      <strong>
                        {(appointment.time || (appointment.period ? periodLabel(appointment.period) : "--:--"))} · {appointment.client}
                      </strong>
                      {appointment.requestId ? <BookingBadge status={appointment.status} /> : null}
                      <p>{appointment.service}</p>
                      {appointment.notes ? <p>{appointment.notes}</p> : null}
                    </div>
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
                  </li>
                ))
              )}
            </ul>
          </article>
        </section>
      ) : null}

      {activeTab === TABS.AGENDA ? (
        <section className="agenda-page">
          <div className="agenda-toolbar">
            <div className="agenda-switch" role="tablist" aria-label="Visualização da agenda">
              <button
                type="button"
                className={agendaMode === "month" ? "active" : ""}
                onClick={() => setAgendaMode("month")}
              >
                Mês
              </button>
              <button
                type="button"
                className={agendaMode === "day" ? "active" : ""}
                onClick={() => setAgendaMode("day")}
              >
                Dia
              </button>
            </div>
            <div className="agenda-toolbar-actions">
              <button className="secondary-btn" type="button" onClick={handleFirstContactLink} disabled={firstContactBusy}>
                {firstContactBusy
                  ? "Gerando link..."
                  : firstContactLink
                    ? "Copiar link do primeiro atendimento"
                    : "Gerar link do primeiro atendimento"}
              </button>
              <button className="primary-btn" type="button" onClick={openAppointmentModal}>
                Inserir atendimento
              </button>
            </div>
          </div>
          {agendaNotice ? <p className="muted-text agenda-notice">{agendaNotice}</p> : null}

          <div className={agendaMode === "month" ? "agenda-layout" : "agenda-layout agenda-layout-day"}>
            <article className="card agenda-card">
              <div className="agenda-nav">
                <button
                  type="button"
                  aria-label={agendaMode === "month" ? "Mês anterior" : "Dia anterior"}
                  onClick={() => shiftAgenda(-1)}
                >
                  ‹
                </button>
                <div className="agenda-nav-title">
                  <h3>{agendaNavTitle}</h3>
                  <button type="button" className="agenda-today" onClick={goToAgendaToday}>
                    Hoje
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={agendaMode === "month" ? "Próximo mês" : "Próximo dia"}
                  onClick={() => shiftAgenda(1)}
                >
                  ›
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
                    return (
                      <button
                        key={isoDate}
                        type="button"
                        className={`month-day ${isoDate === selectedAgendaDate ? "is-selected" : ""} ${
                          isoDate === todayIsoDate ? "is-today" : ""
                        } ${dayIsOff ? "is-off" : ""} ${
                          appointmentCountByDate.get(isoDate) ? "has-appointments" : ""
                        } ${pendingDates.has(isoDate) ? "has-pending" : ""}`}
                        aria-pressed={isoDate === selectedAgendaDate}
                        aria-label={`${formatAgendaDayLabel(isoDate)}${
                          dayIsOff ? ", fora da agenda" : ""
                        }${dayPartialOff ? ", horário off" : ""}${
                          appointmentCountByDate.get(isoDate)
                            ? `, ${appointmentCountByDate.get(isoDate)} atendimento${
                                appointmentCountByDate.get(isoDate) > 1 ? "s" : ""
                              }`
                            : ""
                        }`}
                        onClick={() => setAgendaSelectedDate(isoDate)}
                      >
                        <span>{parseIsoDate(isoDate).getDate()}</span>
                        <span className="month-day-marks">
                          <span className="month-day-dot" />
                          {dayPartialOff ? <span className="month-day-off" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </article>

            <article className="card">
              {agendaMode === "month" ? <h3 className="day-heading">{selectedDayLabel}</h3> : null}
              <section className="agenda-off" aria-label="Dias e horários off">
                <h4>Fora da agenda</h4>
                <p>A cliente não consegue pedir o primeiro atendimento nestes dias ou horários. Manhã vai de 8h às 12h, tarde de 12h às 18h e noite de 18h às 21h.</p>
                <div className="agenda-off-choices">
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedDayAllDay)}
                      disabled={offBusy}
                      onChange={() => toggleAgendaAllDay(false)}
                    />
                    Este dia inteiro
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedWeekAllDay)}
                      disabled={offBusy}
                      onChange={() => toggleAgendaAllDay(true)}
                    />
                    Toda {WEEKDAY_LABELS[selectedWeekday]} inteira
                  </label>
                </div>
                <div className="agenda-off-times">
                  <label>
                    Início
                    <input type="time" value={offStart} onChange={(event) => setOffStart(event.target.value)} />
                  </label>
                  <label>
                    Fim
                    <input type="time" value={offEnd} onChange={(event) => setOffEnd(event.target.value)} />
                  </label>
                </div>
                <div className="agenda-off-choices">
                  <label>
                    <input
                      type="checkbox"
                      checked={offRepeat}
                      onChange={(event) => setOffRepeat(event.target.checked)}
                    />
                    Repetir toda semana
                  </label>
                </div>
                <button className="secondary-btn" type="button" onClick={handleAddAgendaOff} disabled={offBusy}>
                  Bloquear horário
                </button>
                {offError ? <p className="error-text">{offError}</p> : null}
                {selectedDayClosures.length > 0 ? (
                  <ul className="agenda-off-list">
                    {selectedDayClosures.map((closure) => (
                      <li key={closure.id}>
                        <span>{closureLabel(closure)}</span>
                        <button
                          type="button"
                          className="danger-btn"
                          disabled={offBusy}
                          aria-label={`Remover ${closureLabel(closure)}`}
                          onClick={() => removeAgendaClosure(closure.id)}
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
              <ul className="list">
                {selectedDayAppointments.length === 0 ? (
                  <li className="empty">Nenhum atendimento neste dia.</li>
                ) : (
                  selectedDayAppointments.map((appointment) => (
                    <li key={appointment.id} className={appointment.status === "recusado" ? "is-muted" : ""}>
                      <div>
                        <strong>
                          {appointment.time || (appointment.period ? periodLabel(appointment.period) : "Sem horário")} · {appointment.client}
                        </strong>
                        {appointment.requestId ? <BookingBadge status={appointment.status} /> : null}
                        <p>{appointment.service}</p>
                        {appointment.status === "remarcacao" && appointment.date ? (
                          <p>
                            Pedido original em {formatDatePt(appointment.date)}. A confirmação da cliente é pelo WhatsApp.
                          </p>
                        ) : null}
                        {appointment.requestId && Array.isArray(appointment.reasons) && appointment.reasons.length > 0 ? (
                          <p>{appointment.reasons.join(", ")}</p>
                        ) : null}
                        {appointment.notes ? <p>{appointment.notes}</p> : null}
                      </div>
                      <div className="inline-actions appointment-actions">
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
                          className="danger-btn"
                          onClick={() => handleDeleteByCollection("appointments", appointment.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </div>
        </section>
      ) : null}

      {isAppointmentModalOpen ? (
        <div
          className="client-modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeAppointmentModal();
          }}
        >
          <section
            className="appointment-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Inserir atendimento"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="profile-modal-header">
              <div>
                <h4>Inserir atendimento</h4>
                <p>{formatAgendaDayLabel(appointmentDate || selectedAgendaDate)}</p>
                {isDayClosed(agendaClosures, appointmentDate || selectedAgendaDate) ? (
                  <p className="muted-text">Este dia está off para a cliente. Você ainda pode inserir o atendimento.</p>
                ) : closedPeriods(agendaClosures, appointmentDate || selectedAgendaDate).length > 0 ? (
                  <p className="muted-text">Alguns horários deste dia estão off para a cliente. Você ainda pode inserir o atendimento.</p>
                ) : null}
              </div>
              <ModalClose onClick={closeAppointmentModal} />
            </header>
            <form className="form grid-form" onSubmit={handleAddAppointment}>
            <label>
              Cliente
              <div className={`client-picker ${isAppointmentClientListOpen ? "is-open" : ""}`}>
                <div className="client-picker-field">
                  <input
                    value={appointmentClient}
                    onChange={(event) => {
                      setAppointmentClient(event.target.value);
                      setAppointmentClientNotice("");
                      setIsAppointmentClientListOpen(true);
                      setIsAppointmentServiceListOpen(false);
                    }}
                    onFocus={() => {
                      setIsAppointmentClientListOpen(true);
                      setIsAppointmentServiceListOpen(false);
                    }}
                    onBlur={() => setIsAppointmentClientListOpen(false)}
                    placeholder="Digite o nome da cliente"
                    autoComplete="off"
                    required
                  />
                  {appointmentClient.trim() && !appointmentClientExists ? (
                    <button
                      type="button"
                      className="client-picker-add"
                      aria-label={`Adicionar ${appointmentClient.trim()}`}
                      disabled={isCreatingAppointmentClient}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => createAppointmentClient(appointmentClient)}
                    >
                      +
                    </button>
                  ) : null}
                </div>
                {isAppointmentClientListOpen && appointmentClientSuggestions.length > 0 ? (
                  <ul className="client-picker-suggestions">
                    {appointmentClientSuggestions.map((client) => (
                      <li key={`appointment-client-${client.id}`}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setAppointmentClient(client.name || "");
                            setAppointmentClientNotice("");
                            setIsAppointmentClientListOpen(false);
                          }}
                        >
                          {client.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {appointmentClientNotice ? <p className="muted-text">{appointmentClientNotice}</p> : null}
            </label>
            <label>
              Serviço
              <div className={`client-picker ${isAppointmentServiceListOpen ? "is-open" : ""}`}>
                <div className="client-picker-field">
                  <input
                    value={appointmentService}
                    onChange={(event) => {
                      setAppointmentService(event.target.value);
                      setAppointmentServiceNotice("");
                      setIsAppointmentServiceListOpen(true);
                      setIsAppointmentClientListOpen(false);
                    }}
                    onFocus={() => {
                      setIsAppointmentServiceListOpen(true);
                      setIsAppointmentClientListOpen(false);
                    }}
                    onBlur={() => setIsAppointmentServiceListOpen(false)}
                    placeholder="Digite ou escolha o serviço"
                    autoComplete="off"
                    required
                  />
                  {appointmentService.trim() && !appointmentServiceExists ? (
                    <button
                      type="button"
                      className="client-picker-add"
                      aria-label={`Adicionar ${appointmentService.trim()}`}
                      disabled={isCreatingAppointmentService}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => createAppointmentService(appointmentService)}
                    >
                      +
                    </button>
                  ) : null}
                </div>
                {isAppointmentServiceListOpen && appointmentServiceSuggestions.length > 0 ? (
                  <ul className="client-picker-suggestions">
                    {appointmentServiceSuggestions.map((service) => (
                      <li key={`appointment-service-${service.id}`}>
                        <button
                          type="button"
                          className={service.undetermined ? "is-special" : ""}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setAppointmentService(service.title || "");
                            setAppointmentServiceNotice("");
                            setIsAppointmentServiceListOpen(false);
                          }}
                        >
                          {service.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
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
            <button className="primary-btn full-row" type="submit">
              Salvar atendimento
            </button>
          </form>
          </section>
        </div>
      ) : null}

      {bookingReview ? (
        <div
          className="client-modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeBookingReview();
          }}
        >
          <section
            className="appointment-modal booking-review"
            role="dialog"
            aria-modal="true"
            aria-label="Pedido de primeiro atendimento"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="profile-modal-header">
              <div>
                <h4>{bookingReview.client}</h4>
                <p>Primeiro atendimento</p>
              </div>
              <ModalClose onClick={closeBookingReview} />
            </header>
            <BookingBadge status={bookingReview.status} />
            <dl className="booking-details">
              <div>
                <dt>Telefone</dt>
                <dd>{formatPhoneBr(bookingReview.clientPhone) || "Não informado"}</dd>
              </div>
              <div>
                <dt>Dia pedido</dt>
                <dd>{formatDatePt(bookingReview.date)}</dd>
              </div>
              <div>
                <dt>Período</dt>
                <dd>{periodLabel(bookingReview.period)}</dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>{Array.isArray(bookingReview.reasons) && bookingReview.reasons.length > 0 ? bookingReview.reasons.join(", ") : "Não informado"}</dd>
              </div>
              {bookingReview.status === "remarcacao" && bookingReview.suggestedDate ? (
                <div>
                  <dt>Nova data sugerida</dt>
                  <dd>
                    {formatDatePt(bookingReview.suggestedDate)}
                    {bookingReview.rescheduleReason ? `. ${bookingReview.rescheduleReason}` : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="booking-actions">
              <button type="button" className="primary-btn" onClick={() => decideBooking("aprovado")} disabled={Boolean(bookingBusy)}>
                {bookingBusy === "aprovado" ? "Aprovando..." : "Aprovar"}
              </button>
              <button type="button" className="danger-btn" onClick={() => decideBooking("recusado")} disabled={Boolean(bookingBusy)}>
                {bookingBusy === "recusado" ? "Recusando..." : "Recusar"}
              </button>
            </div>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                decideBooking("remarcacao");
              }}
            >
              <label>
                Sugerir outra data
                <input
                  type="date"
                  value={rescheduleDate}
                  min={todayIsoDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                />
              </label>
              <label>
                Motivo da remarcação
                <textarea
                  value={rescheduleReason}
                  maxLength={400}
                  onChange={(event) => setRescheduleReason(event.target.value)}
                  placeholder="Conte por que esse dia não funciona"
                />
              </label>
              <button className="secondary-btn" type="submit" disabled={Boolean(bookingBusy)}>
                {bookingBusy === "remarcacao" ? "Enviando..." : "Remarcar e pedir confirmação"}
              </button>
            </form>
            {bookingNotice ? <p className="muted-text">{bookingNotice}</p> : null}
            {bookingWhatsAppUrl ? (
              <a className="primary-btn" href={bookingWhatsAppUrl} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
            ) : null}
          </section>
        </div>
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

          <div className="clients-toolbar">
            <label>
              Buscar cliente
              <input
                value={clientSearchTerm}
                onChange={(event) => setClientSearchTerm(event.target.value)}
                placeholder="Nome, telefone, e-mail ou endereço"
              />
            </label>
            <label>
              Filtrar por sexo
              <select
                value={clientSexFilter}
                onChange={(event) => setClientSexFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                {SEX_OPTIONS.filter((option) => option.value).map((option) => (
                  <option key={`filter-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ordenar
              <select
                value={clientSortMode}
                onChange={(event) => setClientSortMode(event.target.value)}
              >
                <option value="name_asc">Nome (A-Z)</option>
                <option value="name_desc">Nome (Z-A)</option>
                <option value="last_appointment_desc">Último atendimento (mais recente)</option>
                <option value="last_appointment_asc">Último atendimento (mais antigo)</option>
                <option value="updated_desc">Atualização mais recente</option>
                <option value="updated_asc">Atualização mais antiga</option>
              </select>
            </label>
          </div>
          <p className="muted-text clients-toolbar-summary">
            Exibindo {visibleClients.length} de {clients.length} cliente(s).
          </p>

          <ul className="list">
            {clients.length === 0 ? (
              <li className="empty">Nenhuma cliente cadastrada.</li>
            ) : visibleClients.length === 0 ? (
              <li className="empty">Nenhuma cliente encontrada com os filtros atuais.</li>
            ) : (
              visibleClients.map((client) => {
                const lastAppointmentInfo = lastAppointmentByClientName.get(
                  normalizeClientNameKey(client.name)
                );
                const lastAppointmentDate = lastAppointmentInfo?.date || "";

                return (
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

                    <button
                      type="button"
                      className="client-card-open"
                      onClick={() => handleOpenClientModal(client.id)}
                      disabled={isClientFormOpen}
                    >
                      <div className="client-card-main">
                        <div className="client-card-title-row">
                          <strong>{client.name}</strong>
                          <span className="client-open-hint">Clique para abrir o prontuário</span>
                        </div>

                        <div className="client-contact-row">
                          <span className="client-pill">
                            Telefone: {client.phone ? formatPhoneBr(client.phone) : "Não informado"}
                          </span>
                          <span className="client-pill">
                            Último atendimento:{" "}
                            {lastAppointmentDate
                              ? formatDatePt(lastAppointmentDate)
                              : "Sem atendimento"}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {selectedClient && selectedClientView ? (
            <div
              className="client-modal-backdrop"
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
                <header className="client-modal-header">
                  <div>
                    <h4>{selectedClient.name}</h4>
                    <p>Prontuário da cliente</p>
                  </div>
                  <div className="client-modal-header-actions">
                    <button
                      type="button"
                      className="record-menu-trigger"
                      aria-label={isRecordMenuOpen ? "Fechar menu" : "Abrir menu"}
                      aria-expanded={isRecordMenuOpen}
                      onClick={() => setIsRecordMenuOpen((previous) => !previous)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        {isRecordMenuOpen ? (
                          <path d="M6 6l12 12M18 6L6 18" />
                        ) : (
                          <>
                            <path d="M4 7h16" />
                            <path d="M4 12h16" />
                            <path d="M4 17h16" />
                          </>
                        )}
                      </svg>
                    </button>
                    <ModalClose onClick={handleCloseClientView} />
                    {isRecordMenuOpen ? (
                      <div className="record-menu-dropdown" role="dialog" aria-label="Menu da cliente">
                        <button type="button" className="record-menu-item" onClick={handleCloseClientView}>
                          Fechar
                        </button>
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
                    Termos e Consentimentos
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
                  {followupScreen === "list" ? (
                    <>
                      <div className="panel-header">
                        <div>
                          <h4>Acompanhamento</h4>
                          <p>Sessões da clínica e feedbacks enviados pela cliente.</p>
                        </div>
                        <div className="panel-header-actions">
                        <ClientReceivedNotices
                          tokens={selectedNoticeTokens}
                          onOpen={() => setIsRecordMenuOpen(false)}
                        />
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() => {
                            setCheckpointForm({
                              ...buildEmptyCheckpoint(),
                              sessionNumber: String(getNextSessionNumber(checkpoints))
                            });
                            setDraftPhotos([]);
                            setPhotoForm(buildEmptyPhotoAnalysis());
                            setPhotoMessage("");
                            setIsPhotoComposerOpen(false);
                            setFollowupScreen("create");
                          }}
                        >
                          Nova sessão
                        </button>
                        </div>
                      </div>
                      <TrackingParameterEditor
                        parameters={trackingParameters}
                        form={parameterForm}
                        error={parameterError}
                        busy={parameterBusy}
                        onChange={handleParameterFieldChange}
                        onAdd={handleAddParameter}
                        onRemove={handleRemoveParameter}
                      />
                      <ul className="list">
                        {checkpoints.length === 0 ? (
                          <li className="empty">Nenhum registro ainda.</li>
                        ) : (
                          [...checkpoints]
                            .sort((first, second) => {
                              const dateDiff = String(second.date || "").localeCompare(String(first.date || ""));
                              if (dateDiff !== 0) {
                                return dateDiff;
                              }
                              return Number(second.sessionNumber || 0) - Number(first.sessionNumber || 0);
                            })
                            .map((checkpoint) => (
                              <li key={checkpoint.id}>
                                <button
                                  type="button"
                                  className="session-open-btn"
                                  onClick={() => {
                                    setSelectedCheckpointId(checkpoint.id);
                                    setFollowupScreen("detail");
                                  }}
                                >
                                  <strong>
                                    {formatDatePt(checkpoint.date)}
                                    {isClientFeedback(checkpoint)
                                      ? " · Feedback do cliente"
                                      : checkpoint.sessionNumber
                                        ? ` · Sessão ${checkpoint.sessionNumber}`
                                        : ""}
                                  </strong>
                                  <p>
                                    {checkpoint.sessionType || "Tipo não informado"} · Dor {checkpoint.painLevel ?? 0} ·
                                    Estresse {checkpoint.stressLevel ?? 0} · Sono {checkpoint.sleepHours ?? 0}h
                                    {checkpointParameterSummary(checkpoint) ? ` · ${checkpointParameterSummary(checkpoint)}` : ""}
                                  </p>
                                </button>
                              </li>
                            ))
                        )}
                      </ul>
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
                    </>
                  ) : null}

                  {followupScreen === "detail" ? (
                    <SessionDetail
                      checkpoint={checkpoints.find((item) => item.id === selectedCheckpointId)}
                      photos={photosByCheckpoint.grouped.get(selectedCheckpointId) || []}
                      noticeAction={(
                        <ClientReceivedNotices
                          tokens={selectedNoticeTokens}
                          onOpen={() => setIsRecordMenuOpen(false)}
                        />
                      )}
                      onBack={() => {
                        setFollowupScreen("list");
                        setSelectedCheckpointId("");
                      }}
                      onDelete={async (checkpointId) => {
                        await handleDeleteCheckpoint(checkpointId);
                        setFollowupScreen("list");
                        setSelectedCheckpointId("");
                      }}
                    />
                  ) : null}

                  {followupScreen === "create" ? (
                    <>
                  <div className="panel-header">
                    <div>
                      <h4>Nova sessão</h4>
                      <p>Sessão {checkpointForm.sessionNumber || getNextSessionNumber(checkpoints)}</p>
                    </div>
                    <div className="panel-header-actions">
                    <ClientReceivedNotices
                      tokens={selectedNoticeTokens}
                      onOpen={() => setIsRecordMenuOpen(false)}
                    />
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        setIsPhotoComposerOpen(false);
                        setFollowupScreen("list");
                      }}
                    >
                      Voltar
                    </button>
                    </div>
                  </div>

                  <TrackingParameterEditor
                    parameters={trackingParameters}
                    form={parameterForm}
                    error={parameterError}
                    busy={parameterBusy}
                    onChange={handleParameterFieldChange}
                    onAdd={handleAddParameter}
                    onRemove={handleRemoveParameter}
                  />
                  <form
                    id="followup-checkpoint-form"
                    className="form grid-form"
                    onSubmit={handleAddCheckpoint}
                  >
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
                    <ScaleSlider
                      label="Dor (0-10)"
                      value={checkpointForm.painLevel}
                      onChange={(value) => handleCheckpointFieldChange("painLevel", value)}
                    />
                    <ScaleSlider
                      label="Estresse/Tensão (0-10)"
                      value={checkpointForm.stressLevel}
                      onChange={(value) => handleCheckpointFieldChange("stressLevel", value)}
                    />
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
                    {trackingParameters.map((parameter) => (
                      <label key={parameter.id}>
                        {parameter.name} ({parameter.unit})
                        <input
                          type="text"
                          inputMode="decimal"
                          value={checkpointForm.parameterValues?.[parameter.id] ?? ""}
                          onChange={(event) => handleCheckpointFieldChange("parameterValues", {
                            ...(checkpointForm.parameterValues || {}),
                            [parameter.id]: event.target.value
                          })}
                          placeholder={`Medida em ${parameter.unit}`}
                        />
                      </label>
                    ))}
                    {checkpointError ? <p className="error-text full-row">{checkpointError}</p> : null}
                    <label className="full-row">
                      Observações da sessão
                      <textarea
                        value={checkpointForm.observations}
                        onChange={(event) => handleCheckpointFieldChange("observations", event.target.value)}
                      />
                    </label>
                  </form>

                  <div className="session-photo-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setIsPhotoComposerOpen(true)}
                    >
                      Adicionar foto
                    </button>
                    {draftPhotos.length > 0 ? (
                      <ul className="session-draft-list">
                        {draftPhotos.map((analysis) => (
                          <li key={analysis.localId}>
                            <span>{analysis.positionLabel || "Foto incluída"}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setDraftPhotos((previous) =>
                                  previous.filter((item) => item.localId !== analysis.localId)
                                )
                              }
                            >
                              Remover
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted-text">Nenhuma foto incluída nesta sessão.</p>
                    )}
                    {photoMessage ? (
                      <p className={photoMessageTone === "error" ? "error-text" : "success-text"}>{photoMessage}</p>
                    ) : null}
                  </div>

                  {isPhotoComposerOpen ? (
                  <div
                    className="client-modal-backdrop photo-composer-backdrop"
                    onPointerDown={(event) => {
                      if (event.target === event.currentTarget) setIsPhotoComposerOpen(false);
                    }}
                  >
                  <section
                    className="appointment-modal photo-analysis-section"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Adicionar foto"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <header className="profile-modal-header">
                      <div>
                        <h4>Adicionar foto</h4>
                        <p>A foto fica vinculada a esta sessão e é salva junto com ela.</p>
                      </div>
                      <ModalClose onClick={() => setIsPhotoComposerOpen(false)} />
                    </header>
                    <form className="form" onSubmit={handleAddPhotoAnalysis}>
                      <div className="grid-form photo-position-fields">
                        <label>
                          Data deste acompanhamento
                          <input
                            type="date"
                            value={photoForm.date}
                            readOnly
                          />
                        </label>
                        <label>
                          Posição da foto
                          <select
                            value={photoForm.positionLabel}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPhotoForm((previous) => ({
                                ...previous,
                                positionLabel: value,
                                positionCustom: isCustomPhotoPosition(value) ? previous.positionCustom : ""
                              }));
                            }}
                            required
                          >
                            <option value="">Selecionar</option>
                            {PHOTO_POSITION_OPTIONS.map((option) => (
                              <option key={`photo-position-${option}`} value={option}>
                                {option}
                              </option>
                            ))}
                            <option value={PHOTO_POSITION_OTHER}>{PHOTO_POSITION_OTHER}</option>
                          </select>
                          {isCustomPhotoPosition(photoForm.positionLabel) ? (
                            <>
                              <input
                                value={photoForm.positionCustom}
                                onChange={(event) => handlePhotoFieldChange("positionCustom", event.target.value)}
                                placeholder="Escreva qual foi a posição"
                                aria-label="Posição personalizada da foto"
                                autoFocus
                                required
                              />
                              <span className="muted-text">Informe a posição que não está na lista.</span>
                            </>
                          ) : null}
                        </label>
                      </div>

                      <label>
                        Tipo da próxima medição
                        <select
                          value={photoForm.activeMeasurementType}
                          onChange={(event) => handlePhotoMeasurementTypeChange(event.target.value)}
                        >
                          <option value="line">Linha (pontos A e B)</option>
                          <option value="angle">Ângulo (pontos A, B e C)</option>
                        </select>
                      </label>
                      <p className="muted-text">
                        A mesma foto pode receber várias linhas, vários ângulos ou os dois juntos. Não há limite de medições.
                      </p>

                      <PhotoMeasurementEditor
                        imageDataUrl={photoForm.imageDataUrl}
                        measurements={photoForm.measurements}
                        activeMeasurementType={photoForm.activeMeasurementType}
                        activePoints={photoForm.activePoints}
                        onSelectFile={handlePhotoFileSelect}
                        onChangeActivePoints={(points) =>
                          setPhotoForm((previous) => ({ ...previous, activePoints: points }))
                        }
                        onCommitMeasurement={handleCommitMeasurement}
                        onRemoveMeasurement={handleRemoveMeasurement}
                        onUndoActivePoint={() =>
                          setPhotoForm((previous) => ({
                            ...previous,
                            activePoints: previous.activePoints.slice(0, -1)
                          }))
                        }
                        onClearActivePoints={() =>
                          setPhotoForm((previous) => ({ ...previous, activePoints: [] }))
                        }
                      />

                      <label>
                        Observações da foto
                        <textarea
                          value={photoForm.notes}
                          onChange={(event) => handlePhotoFieldChange("notes", event.target.value)}
                          placeholder="Ex: alinhamento, assimetria, evolução visual..."
                        />
                      </label>

                      {photoMessage ? (
                        <p className={photoMessageTone === "error" ? "error-text" : "success-text"}>{photoMessage}</p>
                      ) : null}

                      <div className="inline-actions">
                        <button className="primary-btn" type="submit">
                          Incluir foto neste acompanhamento
                        </button>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() =>
                            setPhotoForm((previous) => ({
                              ...buildEmptyPhotoAnalysis(),
                              date: checkpointForm.date || previous.date || getTodayISODate()
                            }))
                          }
                        >
                          Limpar foto
                        </button>
                      </div>
                    </form>
                  </section>
                  </div>
                  ) : null}

                  <button
                    className="primary-btn followup-submit-btn"
                    type="submit"
                    form="followup-checkpoint-form"
                    disabled={isSavingCheckpoint}
                  >
                    {isSavingCheckpoint
                      ? "Salvando acompanhamento..."
                      : pendingPhotoCount > 0
                        ? `Registrar sessão com ${pendingPhotoCount} foto${pendingPhotoCount > 1 ? "s" : ""}`
                        : "Registrar sessão"}
                  </button>
                    </>
                  ) : null}
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
                    <WellnessScoreChart
                      points={checkpointChartData}
                      className={wellnessSpansTwo ? "chart-card-span-2" : ""}
                    />
                    {followupChartCards}
                  </div>
                </section>
              ) : null}

              {isTermsViewOpen ? (
                <section className="followup-panel">
                  <div className="panel-header">
                    <div>
                      <h4>Termos e Consentimentos</h4>
                      <p>Autorização de uso de imagem enviada pela cliente.</p>
                    </div>
                  </div>
                  {consentLinks.length === 0 ? (
                    <p className="empty">Nenhum termo enviado. O link fica no menu do prontuário.</p>
                  ) : (
                    <ul className="consent-list">
                      {consentLinks.map((link) => {
                        const decision = consentDecisionLabel(link);
                        const when = getTimestampMillis(link.respondedAt || link.createdAt);
                        return (
                          <li key={link.id} className="consent-card">
                            <div className="consent-card-header">
                              <strong className={
                                link.imageUse === "negado"
                                  ? "consent-status is-denied"
                                  : link.imageUse === "autorizado"
                                    ? "consent-status"
                                    : "consent-status is-waiting"
                              }>
                                {decision}
                              </strong>
                              {when ? <span>{new Date(when).toLocaleDateString("pt-BR")}</span> : null}
                            </div>
                            {link.signatureName ? <p>Confirmado por {link.signatureName}</p> : null}
                            {link.termText ? <p className="consent-term">{link.termText}</p> : null}
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
        <NotificationLists uid={user.uid} clients={clients} shareLinks={shareLinks} />
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

      {isProfileModalOpen ? (
        <div
          className="client-modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) handleCloseProfileModal();
          }}
        >
          <section
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Cadastro do profissional"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="profile-modal-header">
              <div>
                <h4>Meu cadastro</h4>
                <p>Gerencie os dados do seu perfil profissional.</p>
              </div>
              <ModalClose onClick={handleCloseProfileModal} />
            </header>

            <form className="form grid-form" onSubmit={handleSaveProfile}>
              <div className="full-row logo-picker">
                {profileForm.logoDataUrl ? (
                  <img className="logo-picker-preview" src={profileForm.logoDataUrl} alt="Logo da clínica" />
                ) : (
                  <div className="logo-picker-empty">Sem logo</div>
                )}
                <div className="logo-picker-actions">
                  <strong>Logo da clínica</strong>
                  <div className="logo-picker-buttons">
                    <label className="secondary-btn logo-file-btn">
                      {profileForm.logoDataUrl ? "Trocar logo" : "Escolher logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Escolher logo"
                        onChange={handleProfileLogo}
                      />
                    </label>
                    {profileForm.logoDataUrl ? (
                      <button type="button" className="danger-btn" onClick={() => handleProfileFieldChange("logoDataUrl", "")}>
                        Remover
                      </button>
                    ) : null}
                  </div>
                  <span className="field-hint">PNG com fundo transparente fica melhor.</span>
                </div>
              </div>
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
                  placeholder="Ex: Clínica Estética"
                />
              </label>
              <label>
                Telefone
                <input
                  value={formatPhoneBr(profileForm.phone)}
                  onChange={(event) => handleProfileFieldChange("phone", readMaskedPhone(event))}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
              <label>
                Função / especialidade
                <input
                  value={profileForm.professionalRole}
                  onChange={(event) =>
                    handleProfileFieldChange("professionalRole", event.target.value)
                  }
                  placeholder="Ex: Esteticista"
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
                    placeholder="suaclinica"
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
                    placeholder="suaclinica"
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
                  placeholder="Página ou link"
                  onChange={(event) => handleProfileFieldChange("facebook", event.target.value)}
                />
              </label>
              <label>
                Site
                <input
                  value={profileForm.website}
                  maxLength={120}
                  placeholder="www.suaclinica.com"
                  onChange={(event) => handleProfileFieldChange("website", event.target.value)}
                />
              </label>
              <label className="full-row">
                Mensagem do WhatsApp
                <textarea
                  value={profileForm.whatsappMessage}
                  maxLength={500}
                  rows={3}
                  placeholder="Olá! Segue o seu link: {link}"
                  onChange={(event) => handleProfileFieldChange("whatsappMessage", event.target.value)}
                />
                <span className="field-hint">Escreva {"{link}"} onde o endereço deve entrar. Se não escrever, o link vai no final.</span>
              </label>
              <label className="full-row">
                E-mail da conta
                <input value={user?.email || ""} readOnly />
              </label>

              {profileError ? <p className="error-text full-row">{profileError}</p> : null}
              {profileMessage ? <p className="success-text full-row">{profileMessage}</p> : null}

              <button className="primary-btn full-row" type="submit">
                {userProfile ? "Salvar alterações do cadastro" : "Criar meu cadastro"}
              </button>
              {userProfile ? (
                <button
                  type="button"
                  className="danger-btn full-row"
                  onClick={handleDeleteProfile}
                >
                  Excluir meu cadastro
                </button>
              ) : null}
            </form>
          </section>
        </div>
      ) : null}


      {isEvolutionComposerOpen && selectedClient ? (
        <div
          className="client-modal-backdrop evolution-composer-backdrop"
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
                <p>A cliente vê o que você escrever aqui, junto com os gráficos de bem-estar, dor, estresse e sono.</p>
              </div>
              <ModalClose onClick={() => setIsEvolutionComposerOpen(false)} />
            </header>
            <form className="form" onSubmit={handleUpdateEvolution}>
              <label>
                Destaque
                <input
                  value={evolutionDraft.highlight}
                  maxLength={EVOLUTION_HIGHLIGHT_LIMIT}
                  placeholder="Ex: Menos dor depois de 4 sessões"
                  onChange={(event) => setEvolutionDraft((previous) => ({ ...previous, highlight: event.target.value }))}
                />
                <span className="field-hint">Frase curta no topo da tela e na imagem para as redes. {evolutionDraft.highlight.length}/{EVOLUTION_HIGHLIGHT_LIMIT}</span>
              </label>
              <label>
                Recado da clínica
                <textarea
                  value={evolutionDraft.comments}
                  maxLength={EVOLUTION_TEXT_LIMIT}
                  rows={4}
                  placeholder="Uma mensagem para a cliente ler no link"
                  onChange={(event) => setEvolutionDraft((previous) => ({ ...previous, comments: event.target.value }))}
                />
                <span className="field-hint">{evolutionDraft.comments.length}/{EVOLUTION_TEXT_LIMIT}</span>
              </label>
              <label>
                Cuidados em casa
                <textarea
                  value={evolutionDraft.homeCare}
                  maxLength={EVOLUTION_TEXT_LIMIT}
                  rows={4}
                  placeholder={"Um cuidado por linha\nEx: Hidratar a pele de manhã e à noite"}
                  onChange={(event) => setEvolutionDraft((previous) => ({ ...previous, homeCare: event.target.value }))}
                />
                <span className="field-hint">Um cuidado por linha. {evolutionDraft.homeCare.length}/{EVOLUTION_TEXT_LIMIT}</span>
              </label>
              {shareNotice?.scope === "charts" ? (
                <p className={shareNotice.tone === "error" ? "error-text" : "success-text"}>{shareNotice.text}</p>
              ) : null}
              <div className="evolution-composer-actions">
                <button className="primary-btn" type="submit" disabled={Boolean(shareBusy)}>
                  {shareBusy === "charts" ? "Salvando..." : evolutionLink || composerLinkReady ? "Atualizar link" : "Gerar link"}
                </button>
                {evolutionLink || composerLinkReady ? (
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={Boolean(shareBusy)}
                    onClick={() => copyShareLink(evolutionLink?.id || pendingEvolutionTokenRef.current, "charts")}
                  >
                    Copiar link
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isClientFormOpen ? (
        <div
          className="client-modal-backdrop"
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
    </main>
  );
}
