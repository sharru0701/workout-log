import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { generatedSession, workoutLog, workoutSet } from "@/server/db/schema";
import { rebuildAutoProgressionForPlan } from "@/server/progression/autoProgression";
import { buildProgressionSummary, readProgressEventByLog } from "@/server/progression/summary";
import { invalidateStatsCacheForUser } from "@/server/stats/cache";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { resolveRequestLocale } from "@/lib/i18n/messages";
import { upsertWorkoutLogService } from "@/server/services/workout-log/upsert-log";

type Ctx = { params: Promise<{ logId: string }> };

async function GETImpl(_req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
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
    if (!log) return NextResponse.json({ error: locale === "ko" ? "기록을 찾을 수 없습니다." : "Log not found." }, { status: 404 });
    if (log.userId !== userId) return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });

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
    const progressionEvent = await readProgressEventByLog({
      tx: db,
      planId: log.planId,
      logId,
    });
    const progressionSummary = progressionEvent
      ? buildProgressionSummary({
          mode: "upsert",
          eventRow: progressionEvent,
        })
      : null;

    return NextResponse.json({
      item: {
        ...log,
        sets,
        generatedSession: generated,
        progression: progressionSummary,
      },
    });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

async function PATCHImpl(req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { logId } = await ctx.params;
    const userId = getAuthenticatedUserId();
    const body = await req.json();

    const sets = Array.isArray(body.sets) ? body.sets : [];

    // Date-only move: sets 없이 performedAt만 전달된 경우 날짜만 업데이트
    if (sets.length === 0) {
      if (!body.performedAt) {
        return NextResponse.json({ error: locale === "ko" ? "세트 정보가 필요합니다." : "Sets are required." }, { status: 400 });
      }

      const existingRows = await db
        .select({ id: workoutLog.id, userId: workoutLog.userId, planId: workoutLog.planId })
        .from(workoutLog)
        .where(eq(workoutLog.id, logId))
        .limit(1);

      const existing = existingRows[0];
      if (!existing) return NextResponse.json({ error: locale === "ko" ? "기록을 찾을 수 없습니다." : "Log not found." }, { status: 404 });
      if (existing.userId !== userId) return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });

      await db.transaction(async (tx) => {
        await tx.update(workoutLog)
          .set({ performedAt: new Date(body.performedAt) })
          .where(eq(workoutLog.id, logId));

        if (existing.planId) {
          await rebuildAutoProgressionForPlan({ tx, userId, planId: existing.planId });
        }
        await invalidateStatsCacheForUser(userId, tx);
      });

      return NextResponse.json({ updated: true, logId });
    }

    const updated = await upsertWorkoutLogService({
      logId,
      userId,
      locale,
      timezone: typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : "UTC",
      performedAt: body.performedAt ? new Date(body.performedAt) : undefined,
      durationMinutes: body.durationMinutes,
      notes: body.notes,
      tags: body.tags,
      planId: typeof body.planId === "string" && body.planId.trim() ? body.planId.trim() : undefined,
      generatedSessionId: typeof body.generatedSessionId === "string" && body.generatedSessionId.trim() ? body.generatedSessionId.trim() : undefined,
      sets,
      progressionOverride: body.progressionOverride === "hold" || body.progressionOverride === "increase" || body.progressionOverride === "reset" ? body.progressionOverride : null,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

async function DELETEImpl(_req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { logId } = await ctx.params;
    const userId = getAuthenticatedUserId();

    const existingRows = await db
      .select({
        id: workoutLog.id,
        userId: workoutLog.userId,
        planId: workoutLog.planId,
      })
      .from(workoutLog)
      .where(eq(workoutLog.id, logId))
      .limit(1);

    const existing = existingRows[0];
    if (!existing) return NextResponse.json({ error: locale === "ko" ? "기록을 찾을 수 없습니다." : "Log not found." }, { status: 404 });
    if (existing.userId !== userId) return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });

    const deleted = await db.transaction(async (tx) => {
      await tx.delete(workoutLog).where(eq(workoutLog.id, logId));

      const rebuildResult = existing.planId
        ? await rebuildAutoProgressionForPlan({
            tx,
            userId,
            planId: existing.planId,
          })
        : { applied: false as const, reason: "skip:no-plan" as const };

      await invalidateStatsCacheForUser(userId, tx);

      return rebuildResult;
    });

    return NextResponse.json(
      {
        deleted: true,
        logId,
        progressionRebuilt: deleted.applied,
        progressionRebuildReason: deleted.reason,
      },
      { status: 200 },
    );
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const GET = withApiLogging(GETImpl);
export const PATCH = withApiLogging(PATCHImpl);
export const DELETE = withApiLogging(DELETEImpl);
