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
  // PERF: 전체 캐시 삭제 대신 특정 prefix만 무효화 → 유효한 캐시 엔트리 보존
  invalidateCachePrefixes?: string[];
  // 네트워크 오류 시 IndexedDB 큐에 저장 후 재연결 시 자동 전송
  queueIfOffline?: boolean;
};

function resolveBrowserLocale(): "ko" | "en" {
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang.trim().toLowerCase();
    if (lang.startsWith("ko")) return "ko";
    if (lang.startsWith("en")) return "en";
  }
  if (typeof navigator !== "undefined") {
    const lang = String(navigator.language ?? "").trim().toLowerCase();
    if (lang.startsWith("ko")) return "ko";
  }
  return "en";
}

/**
 * 뮤테이션이 오프라인 큐에 저장되었을 때 throw되는 에러.
 * 호출 측에서 isOfflineQueuedError()로 구분하여 UX 처리 가능.
 */
export class OfflineQueuedError extends Error {
  constructor(locale: "ko" | "en" = resolveBrowserLocale()) {
    super(
      locale === "ko"
        ? "요청이 오프라인 큐에 저장되었어요. 연결되면 자동으로 전송됩니다."
        : "The request was queued offline and will be sent automatically when you're back online.",
    );
    this.name = "OfflineQueuedError";
  }
}

export function isOfflineQueuedError(error: unknown): error is OfflineQueuedError {
  return error instanceof OfflineQueuedError;
}

type ApiCacheEntry = {
  data: unknown;
  updatedAt: number;
  lastAccessedAt: number;
};

type ApiInflightRequest = {
  controller: AbortController | null;
  consumers: number;
  promise: Promise<unknown>;
  settled: boolean;
};

type ApiNetworkListener = (inflightCount: number) => void;

const DEFAULT_MAX_AGE_MS = 8_000;
const DEFAULT_STALE_WHILE_REVALIDATE_MS = 52_000;
const API_CACHE_MAX_ENTRIES = 180;

const apiResponseCache = new Map<string, ApiCacheEntry>();
const apiInflightRequests = new Map<string, ApiInflightRequest>();
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

function createAbortError() {
  if (typeof DOMException === "function") {
    return new DOMException("The operation was aborted.", "AbortError");
  }
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

export function isAbortError(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
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

function releaseApiInflightConsumer(cacheKey: string, inflight: ApiInflightRequest) {
  if (inflight.consumers > 0) {
    inflight.consumers -= 1;
  }
  if (inflight.consumers > 0 || inflight.settled) return;
  if (apiInflightRequests.get(cacheKey) === inflight) {
    apiInflightRequests.delete(cacheKey);
  }
  inflight.controller?.abort();
}

async function awaitApiInflight<T>(
  cacheKey: string,
  inflight: ApiInflightRequest,
  signal?: AbortSignal,
) {
  inflight.consumers += 1;

  const release = () => {
    releaseApiInflightConsumer(cacheKey, inflight);
  };

  try {
    if (!signal) {
      return cloneData((await inflight.promise) as T);
    }

    if (signal.aborted) {
      release();
      throw createAbortError();
    }

    const data = await new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        release();
        reject(createAbortError());
      };

      signal.addEventListener("abort", onAbort, { once: true });
      inflight.promise.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve(value as T);
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        },
      );
    });

    return cloneData(data);
  } finally {
    release();
  }
}

async function requestAndCache<T>(
  path: string,
  cacheKey: string,
  { dedupe = true, signal }: Pick<ApiGetOptions, "dedupe" | "signal">,
): Promise<T> {
  const shouldDedupe = dedupe;
  if (shouldDedupe) {
    const inflight = apiInflightRequests.get(cacheKey);
    if (inflight) {
      return awaitApiInflight<T>(cacheKey, inflight, signal);
    }
  }

  if (!shouldDedupe) {
    const data = await fetchJson<T>(path, signal);
    writeApiCache(cacheKey, data);
    return cloneData(data);
  }

  const controller = new AbortController();
  const dedupedRequest = (async () => {
    const data = await fetchJson<T>(path, controller.signal);
    writeApiCache(cacheKey, data);
    return data;
  })();

  const inflight: ApiInflightRequest = {
    controller,
    consumers: 0,
    promise: dedupedRequest as Promise<unknown>,
    settled: false,
  };
  apiInflightRequests.set(cacheKey, inflight);

  void dedupedRequest
    .finally(() => {
      inflight.settled = true;
      if (apiInflightRequests.get(cacheKey) === inflight) {
        apiInflightRequests.delete(cacheKey);
      }
    })
    .catch(() => {
      // Consumers handle the request failure or abort path.
    });

  return awaitApiInflight<T>(cacheKey, inflight, signal);
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
    let res: Response;
    try {
      res = await fetch(path, {
        method,
        headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (fetchError) {
      // TypeError = 네트워크 오류 (DNS 실패, 연결 거부, 오프라인 등).
      // HTTP 오류(4xx/5xx)는 fetch가 resolve하므로 여기 오지 않음.
      if (
        options.queueIfOffline &&
        fetchError instanceof TypeError &&
        typeof window !== "undefined"
      ) {
        // 동적 import: api.ts를 서버 번들에서 분리 유지
        const { enqueueMutation } = await import("./offline-queue");
        await enqueueMutation({
          method,
          path,
          body,
          headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
          invalidateCache,
          invalidateCachePrefixes: options.invalidateCachePrefixes,
        });
        throw new OfflineQueuedError();
      }
      throw fetchError;
    }

    const data = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      throw new Error(resolveApiErrorMessage(data, `${method} ${path} failed: ${res.status}`));
    }
    if (invalidateCache) {
      const { invalidateCachePrefixes } = options;
      if (invalidateCachePrefixes?.length) {
        // PERF: 지정된 prefix만 무효화 → 나머지 캐시(plans, exercises 등) 보존
        for (const prefix of invalidateCachePrefixes) {
          apiInvalidateCache(prefix);
        }
      } else {
        apiInvalidateCache();
      }
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
