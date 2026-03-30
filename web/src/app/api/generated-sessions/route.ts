import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { generatedSession } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { apiErrorResponse } from "@/app/api/_utils/error-response";

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const planId = searchParams.get("planId")?.trim() ?? "";
    const sessionId = searchParams.get("id")?.trim() ?? "";
    const includeSnapshot =
      searchParams.get("includeSnapshot") === "1" ||
      searchParams.get("includeSnapshot")?.toLowerCase() === "true";
    const limitRaw = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 20;

    const filters = [eq(generatedSession.userId, userId)];
    if (planId) filters.push(eq(generatedSession.planId, planId));
    if (sessionId) filters.push(eq(generatedSession.id, sessionId));

    const where = and(...filters);

    const items = includeSnapshot
      ? await db
          .select({
            id: generatedSession.id,
            sessionKey: generatedSession.sessionKey,
            updatedAt: generatedSession.updatedAt,
            snapshot: generatedSession.snapshot,
          })
          .from(generatedSession)
          .where(where)
          .orderBy(desc(generatedSession.updatedAt))
          .limit(limit)
      : await db
          .select({
            id: generatedSession.id,
            sessionKey: generatedSession.sessionKey,
            updatedAt: generatedSession.updatedAt,
          })
          .from(generatedSession)
          .where(where)
          .orderBy(desc(generatedSession.updatedAt))
          .limit(limit);

    return NextResponse.json({ items });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const GET = withApiLogging(GETImpl);
