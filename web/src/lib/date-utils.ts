export function dateOnlyToUtcDate(s: string) {
  return new Date(`${s}T00:00:00Z`);
}

export function utcDateToDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateOnly: string, days: number) {
  const d = dateOnlyToUtcDate(dateOnly);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateToDateOnly(d);
}

export function monthStart(dateOnly: string) {
  const d = dateOnlyToUtcDate(dateOnly);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function monthGrid(dateOnly: string) {
  const start = monthStart(dateOnly);
  const d = dateOnlyToUtcDate(start);
  const offset = d.getUTCDay(); // Sunday start
  const gridStart = addDays(start, -offset);
  // Return 35 or 42 cells to ensure common grid size
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function getDayOfWeek(dateOnly: string) {
  return dateOnlyToUtcDate(dateOnly).getUTCDay();
}

export function dayOfMonth(dateOnly: string) {
  return Number(dateOnly.slice(8, 10));
}

export function dateOnlyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getYear(dateOnly: string) {
  return Number(dateOnly.slice(0, 4));
}

export function getMonth(dateOnly: string) {
  return Number(dateOnly.slice(5, 7));
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function setMonthOfDate(dateOnly: string, year: number, month: number) {
  const day = Math.min(dayOfMonth(dateOnly), daysInMonth(year, month));
  return dateOnlyFromParts(year, month, day);
}

export function shiftDateByMonths(dateOnly: string, delta: number) {
  const targetMonth = new Date(Date.UTC(getYear(dateOnly), getMonth(dateOnly) - 1 + delta, 1));
  return setMonthOfDate(dateOnly, targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1);
}

export function formatDateFriendly(dateOnly: string, locale: "ko" | "en"): string {
  const d = dateOnlyToUtcDate(dateOnly);
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}
