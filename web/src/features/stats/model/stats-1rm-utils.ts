import type {
  BaseFilterOption,
  RangeFilter,
  RangePreset,
  E1RMResponse,
} from "./stats-1rm-types";

export function toQuery(params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  return sp.toString();
}

export function toDateOnly(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateDaysAgoDateOnly(daysAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, Math.floor(daysAgo)));
  return toDateOnly(d);
}

export function toDefaultRange(): RangeFilter {
  return {
    preset: 90,
    from: dateDaysAgoDateOnly(90),
    to: toDateOnly(new Date()),
  };
}

export function withSearchText<T extends BaseFilterOption>(items: T[]) {
  return items.map((item) => ({
    ...item,
    searchText: item.name.toLowerCase(),
  }));
}

export function deriveRangeFilterFromStats(stats: E1RMResponse): RangeFilter {
  const from = stats.from.slice(0, 10);
  const to = stats.to.slice(0, 10);
  const presetByDays = new Map<number, RangePreset>([
    [7, 7],
    [30, 30],
    [90, 90],
    [180, 180],
    [365, 365],
  ]);
  return {
    preset: presetByDays.get(stats.rangeDays) ?? "CUSTOM",
    from,
    to,
  };
}
