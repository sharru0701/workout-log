export const STATS_BOOTSTRAP_REQUEST_OPTIONS = {
  cachePolicy: "network-only",
  dedupe: true,
} as const;

export function buildStatsBootstrapPath(searchParams: URLSearchParams): string {
  const allowed = [
    "exerciseId",
    "exercise",
    "exerciseName",
    "planId",
    "defer1rmBootstrap",
  ];
  const next = new URLSearchParams();
  for (const key of allowed) {
    const value = searchParams.get(key);
    if (value) next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `/api/stats/page-bootstrap?${qs}` : "/api/stats/page-bootstrap";
}
