import { cookies } from "next/headers";
import { findActiveSession, SESSION_COOKIE_NAME } from "./session";

const FALLBACK_AUTH_USER_ID = "dev";

/**
 * Sync variant — env-only.
 *
 * Server components and API routes that have a request scope should prefer
 * {@link requireAuthenticatedUserId} (async, cookie-aware). This sync variant
 * is kept for backward compatibility and for code paths without a request
 * scope (e.g. background jobs).
 */
export function getAuthenticatedUserId(): string {
  const userId = (
    process.env.WORKOUT_AUTH_USER_ID ?? FALLBACK_AUTH_USER_ID
  ).trim();
  if (!userId) {
    throw new Error("WORKOUT_AUTH_USER_ID must not be empty");
  }
  return userId;
}

/**
 * Cookie session 우선, 없으면 환경변수 fallback.
 * Server components / API routes / server actions에서 사용.
 */
export async function requireAuthenticatedUserId(): Promise<string> {
  const userId = await tryAuthenticatedUserId();
  if (!userId) {
    throw new Error("Unauthorized: no active session");
  }
  return userId;
}

/**
 * 같은 우선순위지만 미인증 시 null 반환 (UnauthorizedError 던지지 않음).
 * 미들웨어가 보호하지 못하는 영역에서의 graceful fallback에 사용.
 */
export async function tryAuthenticatedUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const session = await findActiveSession(token);
      if (session) return session.userId;
    }
  } catch {
    // cookies() may throw outside request scope (e.g. background jobs)
  }
  const env = (process.env.WORKOUT_AUTH_USER_ID ?? "").trim();
  if (env) return env;
  return null;
}
