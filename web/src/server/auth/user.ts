const FALLBACK_AUTH_USER_ID = "dev";

/**
 * Current auth model: a single authenticated app user from env.
 * This removes userId-by-parameter trust and prevents cross-user access.
 */
export function getAuthenticatedUserId(): string {
  const userId = (process.env.WORKOUT_AUTH_USER_ID ?? FALLBACK_AUTH_USER_ID).trim();
  if (!userId) {
    throw new Error("WORKOUT_AUTH_USER_ID must not be empty");
  }
  return userId;
}
