/**
 * JWKS (JSON Web Key Set) fetcher with in-memory caching.
 *
 * 외부 IdP의 공개키를 가져와 ID token 서명 검증에 사용한다. Per-instance
 * memory cache (TTL 1h)로 매 로그인 호출마다 JWKS를 새로 받지 않게 한다.
 */

export type JsonWebKey = {
  kty: string;
  kid?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

export type JsonWebKeySet = {
  keys: JsonWebKey[];
};

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

declare global {
  var __jwksCache:
    | Map<string, { fetchedAt: number; value: JsonWebKeySet }>
    | undefined;
}

const cache: Map<string, { fetchedAt: number; value: JsonWebKeySet }> =
  globalThis.__jwksCache ?? new Map();
globalThis.__jwksCache = cache;

export type FetchJwksOptions = {
  url: string;
  ttlMs?: number;
};

export async function fetchJwks({
  url,
  ttlMs = DEFAULT_TTL_MS,
}: FetchJwksOptions): Promise<JsonWebKeySet> {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && now - hit.fetchedAt < ttlMs) {
    return hit.value;
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`JWKS fetch failed (${response.status}) for ${url}`);
  }
  const json = (await response.json()) as JsonWebKeySet;
  if (!json || !Array.isArray(json.keys)) {
    throw new Error(`JWKS payload malformed for ${url}`);
  }
  cache.set(url, { fetchedAt: now, value: json });
  return json;
}

export function findJwk(
  jwks: JsonWebKeySet,
  predicate: (key: JsonWebKey) => boolean,
): JsonWebKey | null {
  return jwks.keys.find(predicate) ?? null;
}

/**
 * 테스트나 강제 갱신을 위해 캐시를 비운다.
 */
export function clearJwksCache(url?: string) {
  if (url) {
    cache.delete(url);
  } else {
    cache.clear();
  }
}
