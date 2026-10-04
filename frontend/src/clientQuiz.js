export const QUIZ_PAIN_AREAS = [
  "Cabeça",
  "Pescoço",
  "Ombro",
  "Cervical",
  "Lombar",
  "Quadril",
  "Joelho",
  "Perna",
  "Pé"
];

export const QUIZ_PAIN_RADIATION = [
  { value: "specific", label: "Fica em um ponto" },
  { value: "radiates", label: "Irradia para outra área" },
  { value: "both", label: "As duas coisas" }
];

export const QUIZ_PAIN_TYPES = ["Queimação", "Fisgada", "Pontada", "Constante", "Peso / pressão", "Latejante"];

export const QUIZ_PAIN_TRIGGERS = [
  "Ao acordar",
  "No trabalho",
  "Ao ficar sentada/o por muito tempo",
  "Ao treinar / atividade física",
  "Em períodos de estresse",
  "Durante o sono"
];

export const QUIZ_GOALS = [
  { value: "relaxation", label: "Relaxar" },
  { value: "specific_tension", label: "Aliviar um ponto de tensão" },
  { value: "both", label: "Os dois" }
];

export const QUIZ_SPORTS = ["Musculação", "Corrida", "Ciclismo", "Crossfit", "Pilates", "Yoga", "Natação", "Esportes de quadra"];

export const QUIZ_TREATMENTS = [
  "Massagem relaxante",
  "Massagem terapêutica",
  "Fisioterapia",
  "Quiropraxia",
  "Acupuntura",
  "Drenagem linfática"
];

export const QUIZ_AESTHETIC_GOALS = [
  "Redução de medidas",
  "Melhora da firmeza",
  "Redução de inchaço",
  "Melhora de celulite",
  "Modelagem corporal",
  "Melhora de circulação"
];

export const QUIZ_HABITS = [
  "Postura inadequada",
  "Sedentarismo",
  "Estresse elevado",
  "Sono insuficiente",
  "Movimentos repetitivos",
  "Uso excessivo de celular/computador"
];

export const QUIZ_HEALTH_CONDITIONS = [
  "Tendinite",
  "Bursite",
  "Diabetes",
  "Cardiopatia",
  "Trombose",
  "Lipedema",
  "Fibromialgia",
  "Enxaqueca",
  "Bruxismo",
  "Insônia",
  "Pressão alterada"
];

export const QUIZ_SESSION_TYPES = ["Miofascial", "Relaxante", "Facial", "Drenagem", "Esportiva"];

export const QUIZ_SLEEP_OPTIONS = [
  { value: "4", label: "Menos de 5 horas" },
  { value: "6", label: "5 a 6 horas" },
  { value: "7.5", label: "7 a 8 horas" },
  { value: "9", label: "Mais de 8 horas" }
];

export const ANAMNESE_ANSWER_KEYS = [
  "painAreas",
  "painRadiatesOption",
  "painTypeOptions",
  "painTriggerOptions",
  "painScale",
  "goalOption",
  "playsSport",
  "sportOptions",
  "hadPreviousTreatment",
  "previousTreatmentTypes",
  "aestheticGoalOptions",
  "habitOptions",
  "healthConditions",
  "pregnant",
  "lactating"
];

export const FOLLOWUP_ANSWER_KEYS = ["painLevel", "stressLevel", "sleepHours", "sessionType"];

const SINGLE = {
  painRadiatesOption: QUIZ_PAIN_RADIATION.map((item) => item.value),
  painScale: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  goalOption: QUIZ_GOALS.map((item) => item.value),
  playsSport: ["yes", "no"],
  hadPreviousTreatment: ["yes", "no"],
  pregnant: ["sim", "nao"],
  lactating: ["sim", "nao"]
};

const MULTI = {
  painAreas: QUIZ_PAIN_AREAS,
  painTypeOptions: QUIZ_PAIN_TYPES,
  painTriggerOptions: QUIZ_PAIN_TRIGGERS,
  sportOptions: QUIZ_SPORTS,
  previousTreatmentTypes: QUIZ_TREATMENTS,
  aestheticGoalOptions: QUIZ_AESTHETIC_GOALS,
  habitOptions: QUIZ_HABITS,
  healthConditions: QUIZ_HEALTH_CONDITIONS
};

export function phoneKey(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) {
    return digits.slice(-11);
  }
  return digits;
}

function pickSingle(value, allowed) {
  return typeof value === "string" && allowed.includes(value) ? value : "";
}

function pickMulti(value, allowed) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string" && allowed.includes(item));
}

export function sanitizeAnamneseAnswers(raw = {}) {
  const answers = {};
  Object.entries(SINGLE).forEach(([key, allowed]) => {
    const value = pickSingle(raw[key], allowed);
    if (value) {
      answers[key] = value;
    }
  });
  Object.entries(MULTI).forEach(([key, allowed]) => {
    const value = pickMulti(raw[key], allowed);
    if (value.length > 0) {
      answers[key] = value;
    }
  });
  return answers;
}

export function sanitizeFollowupAnswers(raw = {}) {
  const painLevel = pickSingle(String(raw.painLevel ?? ""), SINGLE.painScale);
  const stressLevel = pickSingle(String(raw.stressLevel ?? ""), SINGLE.painScale);
  const sleepHours = pickSingle(String(raw.sleepHours ?? ""), QUIZ_SLEEP_OPTIONS.map((item) => item.value));
  const sessionType = pickSingle(raw.sessionType, QUIZ_SESSION_TYPES);
  return {
    painLevel: painLevel || "0",
    stressLevel: stressLevel || "0",
    sleepHours: sleepHours || "0",
    ...(sessionType ? { sessionType } : {})
  };
}

export function buildAnamneseSteps(answers) {
  const steps = [
    { key: "painAreas", kind: "multi", title: "Onde você sente desconforto?", options: QUIZ_PAIN_AREAS },
    { key: "painRadiatesOption", kind: "single", title: "Esse desconforto fica no lugar ou espalha?", options: QUIZ_PAIN_RADIATION },
    { key: "painTypeOptions", kind: "multi", title: "Como é a sensação?", options: QUIZ_PAIN_TYPES },
    { key: "painTriggerOptions", kind: "multi", title: "Quando piora?", options: QUIZ_PAIN_TRIGGERS },
    { key: "painScale", kind: "scale", title: "Qual a intensidade agora?", hint: "0 é nenhum desconforto e 10 é o máximo." },
    { key: "goalOption", kind: "single", title: "O que você mais busca no atendimento?", options: QUIZ_GOALS },
    { key: "playsSport", kind: "single", title: "Você pratica atividade física?", options: [{ value: "yes", label: "Sim" }, { value: "no", label: "Não" }] }
  ];
  if (answers.playsSport === "yes") {
    steps.push({ key: "sportOptions", kind: "multi", title: "Quais atividades?", options: QUIZ_SPORTS });
  }
  steps.push({
    key: "hadPreviousTreatment",
    kind: "single",
    title: "Já fez algum tratamento parecido?",
    options: [{ value: "yes", label: "Sim" }, { value: "no", label: "Não" }]
  });
  if (answers.hadPreviousTreatment === "yes") {
    steps.push({ key: "previousTreatmentTypes", kind: "multi", title: "Quais tratamentos?", options: QUIZ_TREATMENTS });
  }
  steps.push(
    { key: "aestheticGoalOptions", kind: "multi", title: "O que você gostaria de melhorar?", options: QUIZ_AESTHETIC_GOALS },
    { key: "habitOptions", kind: "multi", title: "Algum hábito faz parte da sua rotina?", options: QUIZ_HABITS },
    { key: "healthConditions", kind: "multi", title: "Você tem alguma destas condições?", options: QUIZ_HEALTH_CONDITIONS },
    { key: "pregnant", kind: "single", title: "Está gestante?", options: [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }] },
    { key: "lactating", kind: "single", title: "Está amamentando?", options: [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }] }
  );
  return steps;
}

export function buildFollowupSteps() {
  return [
    { key: "painLevel", kind: "scale", title: "Como está a dor agora?", hint: "0 é nenhuma dor e 10 é o máximo." },
    { key: "stressLevel", kind: "scale", title: "Como está o estresse ou a tensão?", hint: "0 é tranquilo e 10 é muito tenso." },
    { key: "sleepHours", kind: "single", title: "Como foi o seu sono?", options: QUIZ_SLEEP_OPTIONS },
    { key: "sessionType", kind: "single", title: "Qual atendimento você vai fazer ou fez?", options: QUIZ_SESSION_TYPES.map((item) => ({ value: item, label: item })) }
  ];
}
