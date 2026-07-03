import type { Context } from "hono";

import { getClientIp, rateLimit } from "@workout/core/auth/rate-limit";

export { getClientIp };

/**
 * Sliding-window rate limit for the publicly-reachable auth routes.
 *
 * The Bearer adaptation dropped the per-IP/per-email limiting that still guards
 * the web-native cookie auth routes (see routes/auth.ts header comment). Since
 * apps/api is exposed at a stable public origin, that left login/signup open to
 * credential stuffing and signup abuse — this restores the same limits.
 *
 * apps/api runs as a single always-on process, so the in-memory limiter in
 * `@workout/core/auth/rate-limit` is effective here (unlike per-instance serverless,
 * where each cold container starts with an empty map). Upstash Redis is used
 * automatically when its env vars are configured.
 *
 * Returns a 429 Response when any bucket is over its limit, or `null` to proceed.
 */
export async function enforceAuthRateLimit(
  c: Context,
  buckets: Array<{ key: string; max: number; windowMs: number }>,
  message = "Too many attempts. Try again later.",
): Promise<Response | null> {
  for (const bucket of buckets) {
    const result = await rateLimit(bucket);
    if (!result.allowed) {
      return c.json({ error: message }, 429, {
        "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
      });
    }
  }
  return null;
}
