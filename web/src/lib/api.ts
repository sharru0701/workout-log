type ApiCachePolicy = "swr" | "network-only" | "cache-only";

type ApiGetOptions = {
  cachePolicy?: ApiCachePolicy;
  cacheKey?: string;
  maxAgeMs?: number;
  staleWhileRevalidateMs?: number;
  dedupe?: boolean;
  signal?: AbortSignal;
};

type ApiMutationOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  invalidateCache?: boolean;
};

type ApiCacheEntry = {
  data: unknown;
  updatedAt: number;
  lastAccessedAt: number;
};

type ApiNetworkListener = (inflightCount: number) => void;

const DEFAULT_MAX_AGE_MS = 8_000;
const DEFAULT_STALE_WHILE_REVALIDATE_MS = 52_000;
const API_CACHE_MAX_ENTRIES = 180;

const apiResponseCache = new Map<string, ApiCacheEntry>();
const apiInflightRequests = new Map<string, Promise<unknown>>();
const apiNetworkListeners = new Set<ApiNetworkListener>();
let apiNetworkInflightCount = 0;

function cloneData<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function cacheNow() {
  return Date.now();
}

function notifyApiNetworkListeners() {
  for (const listener of apiNetworkListeners) {
    listener(apiNetworkInflightCount);
  }
}

function beginApiNetworkRequest() {
  apiNetworkInflightCount += 1;
  notifyApiNetworkListeners();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    apiNetworkInflightCount = Math.max(0, apiNetworkInflightCount - 1);
    notifyApiNetworkListeners();
  };
}

function trimApiCache() {
  if (apiResponseCache.size <= API_CACHE_MAX_ENTRIES) return;
  const entries = [...apiResponseCache.entries()];
  entries.sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
  const removeCount = entries.length - API_CACHE_MAX_ENTRIES;
  for (let i = 0; i < removeCount; i += 1) {
    const key = entries[i]?.[0];
    if (!key) continue;
    apiResponseCache.delete(key);
  }
}

function writeApiCache(key: string, data: unknown) {
  const now = cacheNow();
  apiResponseCache.set(key, {
    data: cloneData(data),
    updatedAt: now,
    lastAccessedAt: now,
  });
  trimApiCache();
}

function readApiCache(key: string): ApiCacheEntry | null {
  const entry = apiResponseCache.get(key);
  if (!entry) return null;
  entry.lastAccessedAt = cacheNow();
  return entry;
}

function resolveApiErrorMessage(
  body: unknown,
  fallbackMessage: string,
) {
  if (body && typeof body === "object" && "error" in body) {
    const message = (body as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallbackMessage;
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const endNetworkRequest = beginApiNetworkRequest();
  try {
    const res = await fetch(path, {
      cache: "no-store",
      signal,
    });
    const body = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      throw new Error(resolveApiErrorMessage(body, `GET ${path} failed: ${res.status}`));
    }
    return (body ?? {}) as T;
  } finally {
    endNetworkRequest();
  }
}

async function requestAndCache<T>(
  path: string,
  cacheKey: string,
  { dedupe = true, signal }: Pick<ApiGetOptions, "dedupe" | "signal">,
): Promise<T> {
  const shouldDedupe = dedupe && !signal;
  if (shouldDedupe) {
    const inflight = apiInflightRequests.get(cacheKey);
    if (inflight) {
      return cloneData((await inflight) as T);
    }
  }

  const request = (async () => {
    const data = await fetchJson<T>(path, signal);
    writeApiCache(cacheKey, data);
    return data;
  })();

  if (shouldDedupe) {
    apiInflightRequests.set(cacheKey, request as Promise<unknown>);
  }

  try {
    return cloneData(await request);
  } finally {
    if (shouldDedupe) {
      apiInflightRequests.delete(cacheKey);
    }
  }
}

export function apiInvalidateCache(cacheKeyPrefix?: string) {
  if (!cacheKeyPrefix) {
    apiResponseCache.clear();
    return;
  }
  for (const key of apiResponseCache.keys()) {
    if (!key.startsWith(cacheKeyPrefix)) continue;
    apiResponseCache.delete(key);
  }
}

export function getApiNetworkInflightCount() {
  return apiNetworkInflightCount;
}

export function subscribeApiNetworkInflight(listener: ApiNetworkListener) {
  apiNetworkListeners.add(listener);
  listener(apiNetworkInflightCount);
  return () => {
    apiNetworkListeners.delete(listener);
  };
}

export async function apiGet<T>(path: string, options: ApiGetOptions = {}): Promise<T> {
  const {
    cachePolicy = "swr",
    cacheKey = path,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
    staleWhileRevalidateMs = DEFAULT_STALE_WHILE_REVALIDATE_MS,
    dedupe = true,
    signal,
  } = options;

  if (cachePolicy === "network-only") {
    return requestAndCache<T>(path, cacheKey, { dedupe, signal });
  }

  const cachedEntry = readApiCache(cacheKey);
  if (cachedEntry) {
    const ageMs = cacheNow() - cachedEntry.updatedAt;

    if (ageMs <= maxAgeMs) {
      return cloneData(cachedEntry.data as T);
    }

    if (cachePolicy === "swr" && ageMs <= maxAgeMs + staleWhileRevalidateMs) {
      if (!apiInflightRequests.has(cacheKey)) {
        void requestAndCache<T>(path, cacheKey, { dedupe: true }).catch(() => {
          // Keep stale cache when background refresh fails.
        });
      }
      return cloneData(cachedEntry.data as T);
    }
  }

  if (cachePolicy === "cache-only") {
    throw new Error(`GET ${path} failed: cache miss`);
  }

  return requestAndCache<T>(path, cacheKey, { dedupe, signal });
}

async function apiMutate<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options: ApiMutationOptions = {},
) {
  const { signal, headers, invalidateCache = true } = options;
  const requestHeaders: Record<string, string> = {};
  if (body !== undefined) {
    requestHeaders["content-type"] = "application/json";
  }
  if (headers) {
    Object.assign(requestHeaders, headers);
  }

  const endNetworkRequest = beginApiNetworkRequest();
  try {
    const res = await fetch(path, {
      method,
      headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    const data = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      throw new Error(resolveApiErrorMessage(data, `${method} ${path} failed: ${res.status}`));
    }
    if (invalidateCache) {
      apiInvalidateCache();
    }
    return (data ?? {}) as T;
  } finally {
    endNetworkRequest();
  }
}

export async function apiPost<T>(path: string, body: unknown, options?: ApiMutationOptions): Promise<T> {
  return apiMutate<T>("POST", path, body, options);
}

export async function apiPut<T>(path: string, body: unknown, options?: ApiMutationOptions): Promise<T> {
  return apiMutate<T>("PUT", path, body, options);
}

export async function apiPatch<T>(path: string, body: unknown, options?: ApiMutationOptions): Promise<T> {
  return apiMutate<T>("PATCH", path, body, options);
}

export async function apiDelete<T>(path: string, options?: ApiMutationOptions): Promise<T> {
  return apiMutate<T>("DELETE", path, undefined, options);
}
