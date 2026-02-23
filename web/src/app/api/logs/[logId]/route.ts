import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { generatedSession, workoutLog, workoutSet } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

type Ctx = { params: Promise<{ logId: string }> };

async function GETImpl(_req: Request, ctx: Ctx) {
  try {
    const { logId } = await ctx.params;
    const userId = getAuthenticatedUserId();

    const logRows = await db
      .select({
        id: workoutLog.id,
        userId: workoutLog.userId,
        planId: workoutLog.planId,
        generatedSessionId: workoutLog.generatedSessionId,
        performedAt: workoutLog.performedAt,
        durationMinutes: workoutLog.durationMinutes,
        notes: workoutLog.notes,
        tags: workoutLog.tags,
        createdAt: workoutLog.createdAt,
      })
      .from(workoutLog)
      .where(eq(workoutLog.id, logId))
      .limit(1);

    const log = logRows[0];
    if (!log) return NextResponse.json({ error: "log not found" }, { status: 404 });
    if (log.userId !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const sets = await db
      .select({
        id: workoutSet.id,
        logId: workoutSet.logId,
        exerciseId: workoutSet.exerciseId,
        exerciseName: workoutSet.exerciseName,
        sortOrder: workoutSet.sortOrder,
        setNumber: workoutSet.setNumber,
        reps: workoutSet.reps,
        weightKg: workoutSet.weightKg,
        rpe: workoutSet.rpe,
        isExtra: workoutSet.isExtra,
        meta: workoutSet.meta,
      })
      .from(workoutSet)
      .where(eq(workoutSet.logId, logId))
      .orderBy(asc(workoutSet.sortOrder), asc(workoutSet.setNumber), asc(workoutSet.id));

    const generated = log.generatedSessionId
      ? (
          await db
            .select({
              id: generatedSession.id,
              sessionKey: generatedSession.sessionKey,
              snapshot: generatedSession.snapshot,
              updatedAt: generatedSession.updatedAt,
            })
            .from(generatedSession)
            .where(eq(generatedSession.id, log.generatedSessionId))
            .limit(1)
        )[0] ?? null
      : null;

    return NextResponse.json({
      item: {
        ...log,
        sets,
        generatedSession: generated,
      },
    });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);
