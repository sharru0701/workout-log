import { settingsSearchIndex, type SettingsSearchEntry } from "./settings-search-index";

export const SETTINGS_DEEPLINK_BASE_PATH = "/settings/link";

export type SettingsDeepLinkErrorCode = "missing_key" | "unknown_key" | "invalid_row";

export type ResolveSettingsDeepLinkResult =
  | {
      ok: true;
      entry: SettingsSearchEntry;
      key: string;
      row: string | null;
      target: string;
      anchorId: string | null;
    }
  | {
      ok: false;
      errorCode: SettingsDeepLinkErrorCode;
      key: string | null;
      row: string | null;
    };

const entryByKey = new Map(settingsSearchIndex.map((entry) => [entry.key, entry] as const));
const rowKeyPattern = /^[a-zA-Z0-9._:-]{1,80}$/;

function readText(value: string | null | undefined) {
  const next = typeof value === "string" ? value.trim() : "";
  return next.length > 0 ? next : null;
}

function sanitizeAnchorToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function withPatchedQuery(path: string, patch: Record<string, string | null>) {
  const url = new URL(path, "https://settings.local");
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

export function toSettingsRowAnchorId(rowKey: string) {
  const token = sanitizeAnchorToken(rowKey);
  return token.length > 0 ? `row-${token}` : "row-target";
}

export function toSettingsDeepLinkHref({
  key,
  row,
  source,
}: {
  key: string;
  row?: string | null;
  source?: string;
}) {
  const encodedKey = encodeURIComponent(key);
  const sp = new URLSearchParams();
  if (row && readText(row)) sp.set("row", row.trim());
  if (source && readText(source)) sp.set("source", source.trim());
  const query = sp.toString();
  return query ? `${SETTINGS_DEEPLINK_BASE_PATH}/${encodedKey}?${query}` : `${SETTINGS_DEEPLINK_BASE_PATH}/${encodedKey}`;
}

export function resolveSettingsDeepLink({
  key,
  row,
}: {
  key: string | null | undefined;
  row?: string | null | undefined;
}): ResolveSettingsDeepLinkResult {
  const normalizedKey = readText(key);
  const normalizedRow = readText(row);

  if (!normalizedKey) {
    return {
      ok: false,
      errorCode: "missing_key",
      key: null,
      row: normalizedRow,
    };
  }

  const entry = entryByKey.get(normalizedKey);
  if (!entry) {
    return {
      ok: false,
      errorCode: "unknown_key",
      key: normalizedKey,
      row: normalizedRow,
    };
  }

  if (normalizedRow && !rowKeyPattern.test(normalizedRow)) {
    return {
      ok: false,
      errorCode: "invalid_row",
      key: normalizedKey,
      row: normalizedRow,
    };
  }

  const targetWithQuery = withPatchedQuery(entry.path, {
    row: normalizedRow,
    source: "deeplink",
  });

  const anchorId = normalizedRow ? toSettingsRowAnchorId(normalizedRow) : null;
  const target = anchorId ? `${targetWithQuery}#${anchorId}` : targetWithQuery;

  return {
    ok: true,
    entry,
    key: normalizedKey,
    row: normalizedRow,
    target,
    anchorId,
  };
}
