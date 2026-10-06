export const PERIOD_WINDOWS = {
  manha: { start: "08:00", end: "12:00" },
  tarde: { start: "12:00", end: "18:00" },
  noite: { start: "18:00", end: "21:00" }
};

export const BOOKING_PERIODS = ["manha", "tarde", "noite"];
export const BOOKING_HORIZON_DAYS = 180;
export const MAX_CLOSURES = 120;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function minutesOf(value) {
  const match = TIME_PATTERN.exec(String(value || ""));
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function rangesOverlap(startA, endA, startB, endB) {
  const aStart = minutesOf(startA);
  const aEnd = minutesOf(endA);
  const bStart = minutesOf(startB);
  const bEnd = minutesOf(endB);
  if ([aStart, aEnd, bStart, bEnd].some((item) => item == null)) {
    return false;
  }
  return aStart < bEnd && bStart < aEnd;
}

export function weekdayOf(isoDate) {
  const match = DATE_PATTERN.exec(String(isoDate || ""));
  if (!match) {
    return -1;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return -1;
  }
  return date.getDay();
}

export function addDays(isoDate, amount) {
  const match = DATE_PATTERN.exec(String(isoDate || ""));
  if (!match) {
    return "";
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() + amount);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localTodayIso(now = new Date()) {
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 10);
}

export function normalizeClosure(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const allDay = raw.allDay === true;
  const recurring = raw.recurring === true;
  const date = DATE_PATTERN.test(raw.date) ? raw.date : "";
  const weekday = Number(raw.weekday);
  const start = TIME_PATTERN.test(raw.start) ? raw.start : "";
  const end = TIME_PATTERN.test(raw.end) ? raw.end : "";
  if (recurring) {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return null;
    }
  } else if (!date || weekdayOf(date) < 0) {
    return null;
  }
  if (!allDay && (minutesOf(start) == null || minutesOf(end) == null || minutesOf(start) >= minutesOf(end))) {
    return null;
  }
  return {
    allDay,
    recurring,
    date: recurring ? "" : date,
    weekday: recurring ? weekday : weekdayOf(date),
    start: allDay ? "" : start,
    end: allDay ? "" : end
  };
}

export function closureApplies(closure, isoDate) {
  const normalized = normalizeClosure(closure);
  if (!normalized || weekdayOf(isoDate) < 0) {
    return false;
  }
  if (normalized.recurring) {
    return weekdayOf(isoDate) === normalized.weekday;
  }
  return normalized.date === isoDate;
}

export function closuresForDate(closures, isoDate) {
  return (Array.isArray(closures) ? closures : []).filter((closure) => closureApplies(closure, isoDate));
}

export function isPeriodClosed(closures, isoDate, period) {
  const window = PERIOD_WINDOWS[period];
  if (!window) {
    return false;
  }
  return closuresForDate(closures, isoDate).some((closure) => {
    const normalized = normalizeClosure(closure);
    if (!normalized) {
      return false;
    }
    if (normalized.allDay) {
      return true;
    }
    return rangesOverlap(normalized.start, normalized.end, window.start, window.end);
  });
}

export function closedPeriods(closures, isoDate) {
  return BOOKING_PERIODS.filter((period) => isPeriodClosed(closures, isoDate, period));
}

export function isDayClosed(closures, isoDate) {
  return closedPeriods(closures, isoDate).length === BOOKING_PERIODS.length;
}

export function isBookingOpen(closures, isoDate, period) {
  if (weekdayOf(isoDate) < 0 || isDayClosed(closures, isoDate)) {
    return false;
  }
  if (period === "qualquer") {
    return closedPeriods(closures, isoDate).length < BOOKING_PERIODS.length;
  }
  return !isPeriodClosed(closures, isoDate, period);
}

export function closureLabel(closure) {
  const normalized = normalizeClosure(closure);
  if (!normalized) {
    return "Bloqueio";
  }
  const dayName = WEEKDAY_NAMES[normalized.weekday] || "";
  if (normalized.allDay && normalized.recurring) {
    return `Dia inteiro, toda ${dayName}`;
  }
  if (normalized.allDay) {
    return "Dia inteiro neste dia";
  }
  const range = `${normalized.start}–${normalized.end}`;
  return normalized.recurring ? `${range}, toda ${dayName}` : `${range} neste dia`;
}

export function buildAvailability(closures, todayIso, horizonDays = BOOKING_HORIZON_DAYS) {
  const clean = (Array.isArray(closures) ? closures : [])
    .map((closure) => normalizeClosure(closure))
    .filter(Boolean)
    .slice(0, MAX_CLOSURES)
    .sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
  const blockedDates = [];
  const blockedSlots = [];
  const start = DATE_PATTERN.test(todayIso) ? todayIso : localTodayIso();
  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const date = addDays(start, offset);
    if (!date) {
      continue;
    }
    if (isDayClosed(clean, date)) {
      blockedDates.push(date);
      continue;
    }
    closedPeriods(clean, date).forEach((period) => {
      blockedSlots.push(`${date}|${period}`);
    });
  }
  return {
    closures: clean,
    blockedDates: blockedDates.slice(0, 200),
    blockedSlots: blockedSlots.slice(0, 800)
  };
}
