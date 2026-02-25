export type QueryPatch = Record<string, string | undefined | null>;

const DUMMY_ORIGIN = "https://local.settings";

export function normalizeReturnTo(raw: string | null, fallbackPath: string) {
  if (!raw) return fallbackPath;
  if (!raw.startsWith("/")) return fallbackPath;
  if (raw.startsWith("//")) return fallbackPath;
  return raw;
}

export function withPatchedQuery(pathOrHref: string, patch: QueryPatch) {
  const parsed = new URL(pathOrHref, DUMMY_ORIGIN);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === "") {
      parsed.searchParams.delete(key);
      continue;
    }
    parsed.searchParams.set(key, value);
  }
  const query = parsed.searchParams.toString();
  return `${parsed.pathname}${query ? `?${query}` : ""}`;
}

export function readParamFromHref(pathOrHref: string, key: string, fallback = "") {
  const parsed = new URL(pathOrHref, DUMMY_ORIGIN);
  return parsed.searchParams.get(key) ?? fallback;
}

export function parseCsvParam(raw: string | null, fallback: string[] = []) {
  if (!raw) return fallback;
  const values = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

export function toCsvParam(values: string[]) {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean))).join(",");
}

