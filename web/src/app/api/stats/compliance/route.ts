import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { generatedSession, workoutLog } from "@/server/db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const planId = searchParams.get("planId"); // optional
    const days = Number(searchParams.get("days") ?? "30");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const since = new Date();
    since.setDate(since.getDate() - (Number.isFinite(days) ? days : 30));

    const wherePlanned = planId
      ? and(eq(generatedSession.userId, userId), eq(generatedSession.planId, planId), gte(generatedSession.updatedAt, since))
      : and(eq(generatedSession.userId, userId), gte(generatedSession.updatedAt, since));

    const plannedRows = await db
      .select({
        id: generatedSession.id,
        planId: generatedSession.planId,
        sessionKey: generatedSession.sessionKey,
      })
      .from(generatedSession)
      .where(wherePlanned);

    const plannedKeySet = new Set(plannedRows.map((r) => `${r.planId}:${r.sessionKey}`));
    const planned = plannedKeySet.size;

    if (planned === 0) {
      return NextResponse.json({ rangeDays: days, planId: planId ?? null, planned: 0, done: 0, compliance: 0 });
    }

    const plannedIds = plannedRows.map((r) => r.id);

    const whereDone = planId
      ? and(eq(workoutLog.userId, userId), eq(workoutLog.planId, planId), gte(workoutLog.performedAt, since), inArray(workoutLog.generatedSessionId, plannedIds))
      : and(eq(workoutLog.userId, userId), gte(workoutLog.performedAt, since), inArray(workoutLog.generatedSessionId, plannedIds));

    const doneRows = await db
      .select({ id: workoutLog.generatedSessionId })
      .from(workoutLog)
      .where(whereDone);

    const done = new Set(doneRows.map((r) => r.id)).size;
    const compliance = planned > 0 ? Math.round((done / planned) * 1000) / 1000 : 0;

    return NextResponse.json({ rangeDays: days, planId: planId ?? null, planned, done, compliance });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
