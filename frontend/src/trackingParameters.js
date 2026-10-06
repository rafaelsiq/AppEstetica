export const MAX_PARAMETERS = 12;
export const PARAMETER_NAME_LIMIT = 60;
export const PARAMETER_UNIT_LIMIT = 16;

export function emptyParameterForm() {
  return { name: "", unit: "", improveWhen: "up" };
}

export function validateParameter(input, existing = []) {
  const name = String(input?.name || "").trim();
  const unit = String(input?.unit || "").trim();
  const improveWhen = input?.improveWhen === "down" ? "down" : "up";
  if (!name || name.length > PARAMETER_NAME_LIMIT) {
    return { error: "Dê um nome ao parâmetro, com até 60 caracteres." };
  }
  if (!unit || unit.length > PARAMETER_UNIT_LIMIT) {
    return { error: "Informe a unidade, com até 16 caracteres. Ex.: cm, graus." };
  }
  const duplicate = existing.some((item) => item.name.trim().toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
  if (duplicate) {
    return { error: "Já existe um parâmetro com esse nome." };
  }
  if (existing.length >= MAX_PARAMETERS) {
    return { error: "Esta cliente já tem 12 parâmetros." };
  }
  return { parameter: { name, unit, improveWhen } };
}

export function normalizeParameter(id, data) {
  const name = String(data?.name || "").trim().slice(0, PARAMETER_NAME_LIMIT);
  const unit = String(data?.unit || "").trim().slice(0, PARAMETER_UNIT_LIMIT);
  if (!id || !name || !unit) {
    return null;
  }
  return {
    id: String(id),
    name,
    unit,
    improveWhen: data?.improveWhen === "down" ? "down" : "up"
  };
}

export function parseParameterValue(raw) {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (!text) {
    return { empty: true };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return { error: true };
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value > 100000) {
    return { error: true };
  }
  return { value: Math.round(value * 100) / 100 };
}

export function readingsFromForm(parameters, values) {
  const readings = [];
  for (const parameter of parameters || []) {
    const parsed = parseParameterValue(values?.[parameter.id]);
    if (parsed.error) {
      return { error: `Informe um número para ${parameter.name}. Use até duas casas decimais.` };
    }
    if (parsed.empty) {
      continue;
    }
    readings.push({
      id: parameter.id,
      name: parameter.name,
      unit: parameter.unit,
      improveWhen: parameter.improveWhen === "down" ? "down" : "up",
      value: parsed.value
    });
  }
  return { readings };
}

export function normalizeReadings(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set();
  const readings = [];
  raw.forEach((item) => {
    if (!item || typeof item !== "object" || seen.size >= MAX_PARAMETERS) {
      return;
    }
    const id = String(item.id || "").trim().slice(0, 80);
    const name = String(item.name || "").trim().slice(0, PARAMETER_NAME_LIMIT);
    const unit = String(item.unit || "").trim().slice(0, PARAMETER_UNIT_LIMIT);
    const value = Number(item.value);
    if (!id || !name || !unit || seen.has(id) || !Number.isFinite(value) || value < 0 || value > 100000) {
      return;
    }
    seen.add(id);
    readings.push({
      id,
      name,
      unit,
      improveWhen: item.improveWhen === "down" ? "down" : "up",
      value: Math.round(value * 100) / 100
    });
  });
  return readings;
}

export function parameterSeries(checkpoints, definitions = []) {
  const grouped = new Map();
  definitions.forEach((definition) => {
    const parameter = normalizeParameter(definition.id, definition);
    if (!parameter) {
      return;
    }
    grouped.set(parameter.id, { ...parameter, points: [] });
  });
  [...(checkpoints || [])]
    .filter((item) => item?.date)
    .sort((first, second) => String(first.date).localeCompare(String(second.date)))
    .forEach((checkpoint) => {
      normalizeReadings(checkpoint.parameters).forEach((reading) => {
        const current = grouped.get(reading.id) || {
          id: reading.id,
          name: reading.name,
          unit: reading.unit,
          improveWhen: reading.improveWhen,
          points: []
        };
        const defined = definitions.some((item) => item.id === reading.id);
        if (!defined) {
          current.name = reading.name;
          current.unit = reading.unit;
          current.improveWhen = reading.improveWhen;
        }
        current.points.push({ date: checkpoint.date, value: reading.value });
        grouped.set(reading.id, current);
      });
    });
  return [...grouped.values()];
}

export function chartCeiling(values) {
  const max = Math.max(0, ...values.map((value) => Number(value) || 0));
  if (max <= 0) {
    return 1;
  }
  const padded = max * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  return Math.ceil(padded / magnitude) * magnitude;
}

export function formatParameterValue(value, unit) {
  const numeric = Number(value) || 0;
  const text = Number.isInteger(numeric) ? String(numeric) : String(Math.round(numeric * 100) / 100);
  return unit ? `${text} ${unit}` : text;
}

export function checkpointParameterSummary(checkpoint) {
  return normalizeReadings(checkpoint?.parameters)
    .map((item) => `${item.name} ${formatParameterValue(item.value, item.unit)}`)
    .join(" · ");
}
