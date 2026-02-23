export type ParsedRange = {
  from: Date;
  to: Date;
  rangeDays: number;
};

function parseDateLike(raw: string, endOfDay: boolean): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  if (dateOnlyMatch) {
    const d = new Date(`${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const d = new Date(trimmed);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function parseDateRangeFromSearchParams(
  searchParams: URLSearchParams,
  defaultDays: number,
): ParsedRange {
  const now = new Date();
  const rawFrom = searchParams.get("from");
  const rawTo = searchParams.get("to");

  const to = rawTo ? parseDateLike(rawTo, true) ?? now : now;

  let from = rawFrom ? parseDateLike(rawFrom, false) : null;
  if (!from) {
    const daysRaw = Number(searchParams.get("days") ?? String(defaultDays));
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.floor(daysRaw)) : defaultDays;
    from = new Date(to);
    from.setDate(from.getDate() - days);
  }

  if (from.getTime() > to.getTime()) {
    const fallbackFrom = new Date(to);
    fallbackFrom.setDate(fallbackFrom.getDate() - Math.max(1, defaultDays));
    from = fallbackFrom;
  }

  const rangeMs = Math.max(1, to.getTime() - from.getTime());
  const rangeDays = Math.max(1, Math.ceil(rangeMs / 86_400_000));

  return { from, to, rangeDays };
}
