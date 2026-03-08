export function toLocalDateKey(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildTodayLogHref({
  planId,
  date = toLocalDateKey(),
}: {
  planId?: string | null;
  date?: string;
  autoGenerate?: boolean;
}) {
  const params = new URLSearchParams();
  if (planId) params.set("planId", planId);
  params.set("date", date);
  const query = params.toString();
  return `/workout-record${query ? `?${query}` : ""}`;
}
