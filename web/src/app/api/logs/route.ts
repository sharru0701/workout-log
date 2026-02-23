import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { generatedSession, plan, workoutLog, workoutSet } from "@/server/db/schema";
import { getExerciseById, resolveExerciseByName } from "@/server/exercise/resolve";
import { invalidateStatsCacheForUser } from "@/server/stats/cache";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

type LogCursor = {
  performedAt: string;
  id: string;
};

function parseCursor(raw: string | null): LogCursor | null {
  if (!raw) return null;

  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as LogCursor;
    if (typeof decoded?.performedAt !== "string" || typeof decoded?.id !== "string") return null;
    return decoded;
  } catch {
    return null;
  }
}

function encodeCursor(cursor: LogCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const planId = searchParams.get("planId")?.trim() ?? "";
    const cursor = parseCursor(searchParams.get("cursor"));
    const limitRaw = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 20;

    const filters: Array<any> = [eq(workoutLog.userId, userId)];

    if (planId) {
      filters.push(eq(workoutLog.planId, planId));
    }

    if (cursor) {
      const cursorDate = new Date(cursor.performedAt);
      if (!Number.isNaN(cursorDate.getTime())) {
        filters.push(
          or(
            lt(workoutLog.performedAt, cursorDate),
            and(eq(workoutLog.performedAt, cursorDate), lt(workoutLog.id, cursor.id)),
          ),
        );
      }
    }

    const logs = await db
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
      .where(and(...filters))
      .orderBy(desc(workoutLog.performedAt), desc(workoutLog.id))
      .limit(limit + 1);

    const hasMore = logs.length > limit;
    const pageLogs = hasMore ? logs.slice(0, limit) : logs;
    const logIds = pageLogs.map((l) => l.id);

    const setsByLogId = new Map<string, Array<any>>();

    if (logIds.length > 0) {
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
        .where(inArray(workoutSet.logId, logIds))
        .orderBy(asc(workoutSet.sortOrder), asc(workoutSet.setNumber), asc(workoutSet.id));

      for (const s of sets) {
        const list = setsByLogId.get(s.logId) ?? [];
        list.push(s);
        setsByLogId.set(s.logId, list);
      }
    }

    const items = pageLogs.map((log) => ({
      ...log,
      sets: setsByLogId.get(log.id) ?? [],
    }));

    const last = pageLogs[pageLogs.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor({ performedAt: last.performedAt.toISOString(), id: last.id }) : null;

    return NextResponse.json({ items, nextCursor, limit });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

async function POSTImpl(req: Request) {
  try {
    const body = await req.json();
    const userId = getAuthenticatedUserId();

    const sets = Array.isArray(body.sets) ? body.sets : [];
    if (sets.length === 0) {
      return NextResponse.json({ error: "sets required" }, { status: 400 });
    }

    const submittedPlanId = typeof body.planId === "string" && body.planId.trim() ? body.planId.trim() : null;
    const submittedGeneratedSessionId =
      typeof body.generatedSessionId === "string" && body.generatedSessionId.trim()
        ? body.generatedSessionId.trim()
        : null;

    if (submittedPlanId) {
      const p = await db
        .select({ id: plan.id, userId: plan.userId })
        .from(plan)
        .where(eq(plan.id, submittedPlanId))
        .limit(1);
      if (!p[0]) return NextResponse.json({ error: "plan not found" }, { status: 404 });
      if (p[0].userId !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
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

    const created = await db.transaction(async (tx) => {
      const [log] = await tx
        .insert(workoutLog)
        .values({
          userId,
          planId: submittedPlanId,
          generatedSessionId: submittedGeneratedSessionId,
          performedAt: body.performedAt ? new Date(body.performedAt) : new Date(),
          durationMinutes: body.durationMinutes ?? null,
          notes: body.notes ?? null,
          tags: body.tags ?? null,
        })
        .returning();

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
              logId: log.id,
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

    return NextResponse.json({ log: created }, { status: 201 });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);

export const POST = withApiLogging(POSTImpl);
