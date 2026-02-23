import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { generatedSession } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const planId = searchParams.get("planId");
    const limitRaw = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 20;

    const where = planId
      ? and(eq(generatedSession.userId, userId), eq(generatedSession.planId, planId))
      : eq(generatedSession.userId, userId);

    const items = await db
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
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);
