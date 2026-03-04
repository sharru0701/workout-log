import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { generatedSession, workoutLog, workoutSet } from "@/server/db/schema";
import { getExerciseById, resolveExerciseByName } from "@/server/exercise/resolve";
import { invalidateStatsCacheForUser } from "@/server/stats/cache";
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

async function PATCHImpl(req: Request, ctx: Ctx) {
  try {
    const { logId } = await ctx.params;
    const userId = getAuthenticatedUserId();
    const body = await req.json();

    const sets = Array.isArray(body.sets) ? body.sets : [];
    if (sets.length === 0) {
      return NextResponse.json({ error: "sets required" }, { status: 400 });
    }

    const existingRows = await db
      .select({
        id: workoutLog.id,
        userId: workoutLog.userId,
        planId: workoutLog.planId,
        generatedSessionId: workoutLog.generatedSessionId,
      })
      .from(workoutLog)
      .where(eq(workoutLog.id, logId))
      .limit(1);

    const existing = existingRows[0];
    if (!existing) return NextResponse.json({ error: "log not found" }, { status: 404 });
    if (existing.userId !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const submittedPlanId =
      typeof body.planId === "string" && body.planId.trim() ? body.planId.trim() : existing.planId;
    const submittedGeneratedSessionId =
      typeof body.generatedSessionId === "string" && body.generatedSessionId.trim()
        ? body.generatedSessionId.trim()
        : existing.generatedSessionId;

    if (submittedPlanId !== existing.planId) {
      return NextResponse.json({ error: "planId change is not allowed on log update" }, { status: 400 });
    }
    if (submittedGeneratedSessionId !== existing.generatedSessionId) {
      return NextResponse.json({ error: "generatedSessionId change is not allowed on log update" }, { status: 400 });
    }

    if (submittedGeneratedSessionId) {
      const s = await db
        .select({ id: generatedSession.id, userId: generatedSession.userId, planId: generatedSession.planId })
        .from(generatedSession)
        .where(eq(generatedSession.id, submittedGeneratedSessionId))
        .limit(1);
      if (!s[0]) return NextResponse.json({ error: "generatedSession not found" }, { status: 404 });
      if (s[0].userId !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      if (submittedPlanId && s[0].planId !== submittedPlanId) {
        return NextResponse.json(
          { error: "generatedSession does not belong to provided planId" },
          { status: 400 },
        );
      }
    }

    const resolvedByName = new Map<string, string | null>();
    const resolvedById = new Map<string, string | null>();

    const updated = await db.transaction(async (tx) => {
      const [log] = await tx
        .update(workoutLog)
        .set({
          performedAt: body.performedAt ? new Date(body.performedAt) : undefined,
          durationMinutes:
            body.durationMinutes === undefined ? undefined : (body.durationMinutes ?? null),
          notes: body.notes === undefined ? undefined : (body.notes ?? null),
          tags: body.tags === undefined ? undefined : (body.tags ?? null),
        })
        .where(eq(workoutLog.id, logId))
        .returning({
          id: workoutLog.id,
        });

      await tx.delete(workoutSet).where(eq(workoutSet.logId, logId));

      await tx.insert(workoutSet).values(
        await Promise.all(
          sets.map(async (s: any, idx: number) => {
            const exerciseName = String(s.exerciseName ?? "").trim();
            if (!exerciseName) {
              throw new Error("exerciseName is required for all sets");
            }

            const submittedExerciseId =
              typeof s.exerciseId === "string" && s.exerciseId.trim() ? s.exerciseId.trim() : null;

            let exerciseId: string | null = null;
            if (submittedExerciseId) {
              if (resolvedById.has(submittedExerciseId)) {
                exerciseId = resolvedById.get(submittedExerciseId) ?? null;
              } else {
                const found = await getExerciseById(submittedExerciseId);
                exerciseId = found?.id ?? null;
                resolvedById.set(submittedExerciseId, exerciseId);
              }
            } else {
              const key = exerciseName.toLowerCase();
              if (resolvedByName.has(key)) {
                exerciseId = resolvedByName.get(key) ?? null;
              } else {
                const found = await resolveExerciseByName(exerciseName);
                exerciseId = found?.id ?? null;
                resolvedByName.set(key, exerciseId);
              }
            }

            return {
              logId,
              exerciseId,
              exerciseName,
              sortOrder: s.sortOrder ?? idx,
              setNumber: s.setNumber ?? 1,
              reps: s.reps ?? null,
              weightKg: s.weightKg ?? null,
              rpe: s.rpe ?? null,
              isExtra: Boolean(s.isExtra ?? false),
              meta: s.meta ?? {},
            };
          }),
        ),
      );

      await invalidateStatsCacheForUser(userId, tx);

      return log;
    });

    return NextResponse.json({ log: updated }, { status: 200 });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);
export const PATCH = withApiLogging(PATCHImpl);
