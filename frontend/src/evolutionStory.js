export const EVOLUTION_HIGHLIGHT_LIMIT = 90;
export const EVOLUTION_TEXT_LIMIT = 400;

export function sanitizeEvolutionStory(input = {}) {
  const clip = (value, max) => String(value || "").replace(/\r\n/g, "\n").trim().slice(0, max);
  return {
    highlight: clip(input.highlight, EVOLUTION_HIGHLIGHT_LIMIT),
    comments: clip(input.comments, EVOLUTION_TEXT_LIMIT),
    homeCare: clip(input.homeCare, EVOLUTION_TEXT_LIMIT)
  };
}

export function formatDatePt(dateValue) {
  if (!dateValue) {
    return "--";
  }
  const parsed = new Date(`${dateValue}T00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return String(dateValue);
  }
  return parsed.toLocaleDateString("pt-BR");
}

function clamp(value, max) {
  return Math.min(max, Math.max(0, Number(value) || 0));
}

export function wellnessScore(item) {
  const pain = clamp(item?.painLevel, 10);
  const stress = clamp(item?.stressLevel, 10);
  const sleep = clamp(item?.sleepHours, 10);
  return Math.round(((10 - pain) * 0.4 + (10 - stress) * 0.3 + sleep * 0.3) * 10);
}

export function datedCheckpoints(checkpoints) {
  return [...(checkpoints || [])]
    .filter((item) => item?.date)
    .sort((first, second) => String(first.date).localeCompare(String(second.date)));
}

export function evolutionSeries(checkpoints) {
  const points = datedCheckpoints(checkpoints);
  return {
    points,
    labels: points.map((item) => formatDatePt(item.date)),
    wellness: points.map((item) => wellnessScore(item)),
    pain: points.map((item) => clamp(item.painLevel, 10)),
    stress: points.map((item) => clamp(item.stressLevel, 10)),
    sleep: points.map((item) => clamp(item.sleepHours, 12))
  };
}

export function formatMetric(value) {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

export function metricTrend(first, last, lowerIsBetter = false) {
  const diff = (Number(last) || 0) - (Number(first) || 0);
  if (Math.abs(diff) < 0.05) {
    return { label: "manteve", tone: "flat" };
  }
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  return {
    label: `${diff > 0 ? "subiu" : "caiu"} ${formatMetric(Math.abs(diff))}`,
    tone: improved ? "up" : "down"
  };
}

const IMAGE_SIZE = 1080;

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function roundTopRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x, y + height);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) {
    return [];
  }
  const words = source.split(" ");
  const lines = [];
  let current = "";
  let index = 0;
  while (index < words.length && lines.length < maxLines) {
    const word = words[index];
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial;
      index += 1;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
      continue;
    }
    lines.push(word);
    index += 1;
    current = "";
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (index < words.length && lines.length > 0) {
    const last = lines[lines.length - 1];
    let trimmed = last;
    while (trimmed && ctx.measureText(`${trimmed}…`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    lines[lines.length - 1] = `${trimmed}…`;
  }
  return lines;
}

function chartSlots(count, area) {
  const gap = 20;
  if (count <= 1) {
    return [area];
  }
  if (count === 2) {
    const width = (area.w - gap) / 2;
    return [
      { x: area.x, y: area.y, w: width, h: area.h },
      { x: area.x + width + gap, y: area.y, w: width, h: area.h }
    ];
  }
  const width = (area.w - gap) / 2;
  const height = (area.h - gap) / 2;
  return [0, 1, 2, 3].slice(0, count).map((index) => ({
    x: area.x + (index % 2) * (width + gap),
    y: area.y + Math.floor(index / 2) * (height + gap),
    w: width,
    h: height
  }));
}

function drawChart(ctx, slot, series) {
  roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 22);
  ctx.fillStyle = "#f4f8f7";
  ctx.fill();

  const compact = slot.h < 210;
  ctx.fillStyle = "#1d3550";
  ctx.font = `700 ${compact ? 22 : 28}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(series.title, slot.x + 22, slot.y + (compact ? 36 : 44));

  const plot = {
    x: slot.x + 22,
    y: slot.y + (compact ? 52 : 64),
    w: slot.w - 44,
    h: Math.max(36, slot.h - (compact ? 96 : 118))
  };
  ctx.strokeStyle = "#d5e0e4";
  ctx.lineWidth = 2;
  for (let step = 0; step <= 2; step += 1) {
    const y = plot.y + (plot.h * step) / 2;
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
  }

  const values = series.values;
  const count = values.length;
  const px = (index) => (count === 1 ? plot.x + plot.w / 2 : plot.x + (index * plot.w) / (count - 1));
  const py = (value) => plot.y + (1 - Math.min(Math.max(value, 0), series.max) / series.max) * plot.h;

  ctx.beginPath();
  ctx.strokeStyle = "#24695c";
  ctx.lineWidth = compact ? 4 : 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  values.forEach((value, index) => {
    const x = px(index);
    const y = py(value);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
  values.forEach((value, index) => {
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(px(index), py(value), compact ? 7 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#24695c";
    ctx.arc(px(index), py(value), compact ? 4 : 5.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#6a7a84";
  ctx.font = `600 ${compact ? 16 : 20}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(series.labels[0] || "", plot.x, slot.y + slot.h - 18);
  ctx.textAlign = "right";
  ctx.fillText(series.labels[count - 1] || "", plot.x + plot.w, slot.y + slot.h - 18);
  ctx.textAlign = "left";
}

function selectedCharts(series, include) {
  const items = [
    ["wellness", "Bem-estar", series.wellness, 100],
    ["pain", "Dor", series.pain, 10],
    ["stress", "Estresse", series.stress, 10],
    ["sleep", "Sono", series.sleep, 12]
  ];
  if (series.points.length < 2) {
    return [];
  }
  return items
    .filter(([key]) => include?.[key])
    .map(([, title, values, max]) => ({ title, values, labels: series.labels, max }));
}

export function clinicHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .split(/[/?#\s]/)[0]
    .replace(/[^A-Za-z0-9._]/g, "")
    .slice(0, 30);
}

export function renderEvolutionCanvas({
  clinicName,
  clientFirstName,
  highlight,
  comments,
  homeCare,
  checkpoints,
  include,
  instagram
}) {
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_SIZE;
  canvas.height = IMAGE_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e7f1ee";
  ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);

  const cardX = 40;
  const cardY = 40;
  const cardW = IMAGE_SIZE - 80;
  const cardH = IMAGE_SIZE - 80;
  ctx.shadowColor = "rgba(16, 29, 44, 0.12)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const textX = 88;
  const textW = IMAGE_SIZE - 176;
  ctx.font = "700 54px sans-serif";
  const title = `Sua evolução, ${clientFirstName || "cliente"}`.replace(/,\s*$/, "");
  const titleLines = wrapLines(ctx, title, textW, 2);
  const headerH = 108 + titleLines.length * 64;
  roundTopRect(ctx, cardX, cardY, cardW, headerH, 40);
  ctx.fillStyle = "#24695c";
  ctx.fill();

  ctx.fillStyle = "#d7efe8";
  ctx.font = "700 26px sans-serif";
  const clinicLine = wrapLines(ctx, clinicName || "Clínica", textW, 1)[0] || "Clínica";
  ctx.fillText(clinicLine, textX, cardY + 64);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 54px sans-serif";
  titleLines.forEach((line, index) => {
    ctx.fillText(line, textX, cardY + 128 + index * 64);
  });

  let cursor = cardY + headerH + 36;
  const story = sanitizeEvolutionStory({ highlight, comments, homeCare });
  const blocks = [];
  if (include?.highlight && story.highlight) {
    blocks.push({ title: "", text: story.highlight, size: 34, lines: 3, color: "#24695c" });
  }
  if (include?.comments && story.comments) {
    blocks.push({ title: "Recado da clínica", text: story.comments, size: 26, lines: 3, color: "#24343d" });
  }
  if (include?.homeCare && story.homeCare) {
    blocks.push({
      title: "Cuidados em casa",
      text: story.homeCare.replace(/\n+/g, " · "),
      size: 26,
      lines: 3,
      color: "#24343d"
    });
  }

  const series = evolutionSeries(checkpoints);
  const charts = selectedCharts(series, include);
  const handle = clinicHandle(instagram);
  const bottom = cardY + cardH - 36;
  const footerH = handle ? 96 : 52;
  const chartMin = charts.length > 2 ? 340 : 280;

  const measureBlocks = (lineCap) => blocks.map((block) => {
    ctx.font = `600 ${block.size}px sans-serif`;
    const lines = wrapLines(ctx, block.text, textW - 48, block.title ? lineCap : block.lines);
    const height = (block.title ? 36 : 8) + lines.length * (block.size + 10) + 28;
    return { ...block, lines, height };
  });

  const blockSpaceOf = (items) => items.reduce((sum, block) => sum + block.height + 16, 0);
  let drawnBlocks = measureBlocks(3);
  if (charts.length && cursor + blockSpaceOf(drawnBlocks) + chartMin + footerH > bottom) {
    drawnBlocks = measureBlocks(2);
  }
  while (charts.length && drawnBlocks.length && cursor + blockSpaceOf(drawnBlocks) + 220 + footerH > bottom) {
    drawnBlocks.pop();
  }

  drawnBlocks.forEach((block) => {
    if (block.title) {
      roundRect(ctx, textX, cursor, textW, block.height, 18);
      ctx.fillStyle = "#f4f8f7";
      ctx.fill();
      ctx.fillStyle = "#24695c";
      ctx.font = "700 22px sans-serif";
      ctx.fillText(block.title, textX + 24, cursor + 32);
      ctx.fillStyle = block.color;
      ctx.font = `600 ${block.size}px sans-serif`;
      block.lines.forEach((line, index) => {
        ctx.fillText(line, textX + 24, cursor + 70 + index * (block.size + 10));
      });
    } else {
      ctx.fillStyle = block.color;
      ctx.font = `700 ${block.size}px sans-serif`;
      block.lines.forEach((line, index) => {
        ctx.fillText(line, textX, cursor + 34 + index * (block.size + 10));
      });
    }
    cursor += block.height + 16;
  });

  if (charts.length) {
    const areaH = Math.max(160, bottom - footerH - cursor);
    chartSlots(charts.length, { x: textX, y: cursor, w: textW, h: areaH }).forEach((slot, index) => {
      drawChart(ctx, slot, charts[index]);
    });
  }

  const range = series.labels.length
    ? series.labels.length === 1
      ? series.labels[0]
      : `${series.labels[0]}  –  ${series.labels[series.labels.length - 1]}`
    : "";
  const footerBottom = cardY + cardH - 28;
  ctx.textAlign = "center";
  if (handle) {
    const label = `@${handle}`;
    let fontSize = 30;
    ctx.font = `700 ${fontSize}px sans-serif`;
    while (fontSize > 18 && ctx.measureText(label).width > textW) {
      fontSize -= 2;
      ctx.font = `700 ${fontSize}px sans-serif`;
    }
    ctx.fillStyle = "#24695c";
    ctx.fillText(label, IMAGE_SIZE / 2, footerBottom);
  }
  if (range) {
    ctx.fillStyle = "#6a7a84";
    ctx.font = "600 22px sans-serif";
    ctx.fillText(range, IMAGE_SIZE / 2, handle ? footerBottom - 42 : footerBottom);
  }
  ctx.textAlign = "left";
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Não foi possível gerar a imagem."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function downloadEvolutionImage(blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "minha-evolucao.png";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function shareEvolutionImage(blob, text) {
  const file = new File([blob], "minha-evolucao.png", { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Minha evolução",
      text: text || "Minha evolução"
    });
    return "shared";
  }
  await downloadEvolutionImage(blob);
  return "downloaded";
}
