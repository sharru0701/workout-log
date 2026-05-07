/**
 * 단순 in-memory rate limiter — login/signup brute-force 방어용.
 *
 * Sliding window: 지난 windowMs 내 시도 횟수가 max를 넘으면 차단.
 * 키별 최대 1024개 entry까지만 보관 (메모리 누수 방지) — 가장 오래된 entry부터 삭제.
 *
 * 한계:
 * - 단일 인스턴스 메모리 — 멀티 프로세스/노드에서는 분산 저장(Redis) 필요.
 * - 서버 재시작 시 카운터 reset.
 * - Vercel Edge에서는 작동 안 함 (Node runtime 전용).
 *
 * 본 앱은 단일 인스턴스 가정이라 충분.
 */

type Bucket = { timestamps: number[] };

const MAX_KEYS = 1024;
const buckets = new Map<string, Bucket>();

function pruneOld(bucket: Bucket, now: number, windowMs: number) {
  const cutoff = now - windowMs;
  // 시간순 push라 가정 → 앞에서부터 자르기
  let i = 0;
  while (i < bucket.timestamps.length && bucket.timestamps[i] < cutoff) {
    i++;
  }
  if (i > 0) bucket.timestamps.splice(0, i);
}

function evictIfFull() {
  if (buckets.size <= MAX_KEYS) return;
  // 가장 오래된 키부터 제거
  const overflow = buckets.size - MAX_KEYS;
  let removed = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    removed++;
    if (removed >= overflow) break;
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function rateLimit(input: {
  key: string;
  max: number;
  windowMs: number;
}): RateLimitResult {
  const { key, max, windowMs } = input;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
    evictIfFull();
  }
  pruneOld(bucket, now, windowMs);

  if (bucket.timestamps.length >= max) {
    const earliest = bucket.timestamps[0];
    const retryAfterMs = Math.max(0, windowMs - (now - earliest));
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, max - bucket.timestamps.length),
    retryAfterMs: 0,
  };
}

/**
 * Request에서 client IP 추출 (proxy 헤더 우선).
 * 정확한 IP가 없으면 "unknown" 반환 (anonymous bucket).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
