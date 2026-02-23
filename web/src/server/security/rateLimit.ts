type Bucket = {
  count: number;
  resetAtMs: number;
};

type GlobalRateLimitState = typeof globalThis & {
  __workoutRateLimitBuckets?: Map<string, Bucket>;
};

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function getBuckets() {
  const g = globalThis as GlobalRateLimitState;
  if (!g.__workoutRateLimitBuckets) {
    g.__workoutRateLimitBuckets = new Map<string, Bucket>();
  }
  return g.__workoutRateLimitBuckets;
}

function gcOldBuckets(nowMs: number, buckets: Map<string, Bucket>) {
  if (buckets.size <= 2000) return;
  for (const [k, v] of buckets.entries()) {
    if (v.resetAtMs <= nowMs) buckets.delete(k);
  }
}

export function checkIpRateLimit(input: {
  req: Request;
  route: string;
  method: string;
}): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const nowMs = Date.now();
  const buckets = getBuckets();
  gcOldBuckets(nowMs, buckets);

  const methodUpper = input.method.toUpperCase();
  const writeMethod = methodUpper !== "GET" && methodUpper !== "HEAD" && methodUpper !== "OPTIONS";
  const windowMs = 60_000;
  const limit = writeMethod ? 120 : 600;
  const ip = getClientIp(input.req);

  const key = `${methodUpper}:${input.route}:${ip}`;
  const current = buckets.get(key);

  if (!current || current.resetAtMs <= nowMs) {
    buckets.set(key, { count: 1, resetAtMs: nowMs + windowMs });
    return { ok: true };
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAtMs - nowMs) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  current.count += 1;
  buckets.set(key, current);
  return { ok: true };
}
