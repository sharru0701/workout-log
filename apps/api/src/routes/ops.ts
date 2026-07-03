import { Hono } from "hono";
import type { Context } from "hono";

import { db } from "@workout/core/db/client";
import { lt } from "@workout/core/db/ops";
import { authSession } from "@workout/core/db/schema";

import { apiError } from "../lib/http";

// ─────────────────────────────────────────────────────────────────────────────
// Ops — infra/cron endpoints (NOT user-scoped). Auth is the WORKOUT_OPS_TOKEN
// admin secret via Authorization: Bearer, matching the web route. These endpoints
// are destructive (delete expired sessions) and publicly reachable, so the gate
// FAILS CLOSED: if WORKOUT_OPS_TOKEN is unset the endpoint is denied. For local
// dev, set WORKOUT_OPS_ALLOW_NO_TOKEN=1 to opt into the old open behavior. Ported
// from web/src/app/api/ops/sessions/prune. (ops/migrations is intentionally not
// ported: it reads the migrations dir from process.cwd(), which is web-layout
// specific, and is a web-deployment health check.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WORKOUT_OPS_TOKEN gate. Fails closed: an unset token denies access (return
 * false) unless WORKOUT_OPS_ALLOW_NO_TOKEN=1 is explicitly set for local dev.
 * When the token is set, the Bearer value must match.
 */
function opsTokenOk(c: Context): boolean {
  const expected = (process.env.WORKOUT_OPS_TOKEN ?? "").trim();
  if (!expected) {
    return (process.env.WORKOUT_OPS_ALLOW_NO_TOKEN ?? "").trim() === "1";
  }
  const auth = c.req.header("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return provided === expected;
}

export const opsRoutes = new Hono();

// GET /api/ops/sessions/prune — dry-run: count expired sessions (monitoring).
opsRoutes.get("/sessions/prune", async (c) => {
  if (!opsTokenOk(c)) return c.json({ error: "Unauthorized" }, 401);
  try {
    const rows = await db
      .select({ token: authSession.token })
      .from(authSession)
      .where(lt(authSession.expiresAt, new Date()))
      .limit(1000);
    return c.json({
      expired: rows.length,
      truncated: rows.length === 1000,
      at: new Date().toISOString(),
    });
  } catch (e) {
    return apiError(c, e);
  }
});

// POST /api/ops/sessions/prune — delete expired auth_session rows.
opsRoutes.post("/sessions/prune", async (c) => {
  if (!opsTokenOk(c)) return c.json({ error: "Unauthorized" }, 401);
  try {
    const result = await db.delete(authSession).where(lt(authSession.expiresAt, new Date()));
    const deleted = (result as { rowCount?: number | null })?.rowCount ?? 0;
    return c.json({ deleted, at: new Date().toISOString() });
  } catch (e) {
    return apiError(c, e);
  }
});
