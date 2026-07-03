/**
 * Sliding window rate limiter backed by Upstash Redis (REST API).
 *
 * 별도 SDK 없이 fetch + pipeline endpoint만 사용. Edge runtime 호환.
 * 알고리즘은 sorted set 기반 sliding window:
 *
 * 1. ZREMRANGEBYSCORE key 0 (now - windowMs)  — 윈도우 밖 entry 제거
 * 2. ZADD key {now} {now}-{rand}              — 현재 요청 추가
 * 3. ZCARD key                                 — 윈도우 안 entry 개수
 * 4. PEXPIRE key {windowMs}                    — TTL 유지
 *
 * 4개 명령을 한 번의 HTTP pipeline 호출로 묶어 round-trip 1회로 처리.
 * count > max 인 경우, 가장 오래된 entry의 score로 retryAfter 계산을 위해
 * ZRANGE 추가 호출이 필요하지만, 여기선 단순화를 위해 windowMs를 그대로
 * retryAfter로 반환한다 (보수적).
 *
 * 환경변수:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

export type RedisRateLimitInput = {
  key: string;
  max: number;
  windowMs: number;
};

export type RedisRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function isRedisRateLimitConfigured(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL ?? "").trim() &&
      (process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim(),
  );
}

type UpstashPipelineEntry = { result?: unknown; error?: string };

async function callPipeline(
  url: string,
  token: string,
  commands: Array<Array<string | number>>,
): Promise<UpstashPipelineEntry[]> {
  const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(commands),
    // DOM lib 없는 core에서 undici RequestInit 타입에 cache가 없어 캐스트(런타임 동일).
    ...({ cache: "no-store" } as RequestInit),
  });
  if (!response.ok) {
    throw new Error(`upstash pipeline failed (${response.status})`);
  }
  return (await response.json()) as UpstashPipelineEntry[];
}

export async function redisRateLimit(
  input: RedisRateLimitInput,
): Promise<RedisRateLimitResult> {
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();
  if (!url || !token) {
    throw new Error("Upstash Redis is not configured");
  }

  const { key: rawKey, max, windowMs } = input;
  const namespacedKey = `wl:rl:${rawKey}`;
  const now = Date.now();
  const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
  const cutoff = now - windowMs;

  const results = await callPipeline(url, token, [
    ["ZREMRANGEBYSCORE", namespacedKey, "0", String(cutoff)],
    ["ZADD", namespacedKey, String(now), member],
    ["ZCARD", namespacedKey],
    ["PEXPIRE", namespacedKey, String(windowMs)],
  ]);

  const cardEntry = results[2];
  const count = Number(cardEntry?.result ?? 0);

  if (count > max) {
    // Compensate: roll back the ZADD so that excess attempts don't bump the
    // window size beyond max. retryAfterMs falls back to windowMs (conservative).
    await callPipeline(url, token, [
      ["ZREM", namespacedKey, member],
    ]).catch(() => {});
    return { allowed: false, remaining: 0, retryAfterMs: windowMs };
  }

  return {
    allowed: true,
    remaining: Math.max(0, max - count),
    retryAfterMs: 0,
  };
}
