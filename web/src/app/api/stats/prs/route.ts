import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { exercise, workoutLog, workoutSet } from "@/server/db/schema";
import { and, eq, gte, lte, or, sql } from "drizzle-orm";
import { getExerciseById, resolveExerciseByName } from "@/server/exercise/resolve";
import { getStatsCache, setStatsCache } from "@/server/stats/cache";
import { parseDateRangeFromSearchParams } from "@/server/stats/range";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

function epley1RM(weightKg: number, reps: number) {
  return weightKg * (1 + reps / 30);
}

type PrPoint = {
  date: string;
  e1rm: number;
  weightKg: number;
  reps: number;
};

type PrItemInternal = {
  exerciseId: string | null;
  exerciseName: string;
  first: PrPoint;
  best: PrPoint;
  latest: PrPoint;
};

type PrItem = {
  exerciseId: string | null;
  exerciseName: string;
  best: PrPoint;
  latest: PrPoint;
  improvement: number;
};

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const exerciseId = searchParams.get("exerciseId")?.trim() ?? "";
    const exerciseName = searchParams.get("exercise") ?? searchParams.get("exerciseName");
    const limitRaw = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 20;

    const { from, to, rangeDays } = parseDateRangeFromSearchParams(searchParams, 365);

    let resolvedExerciseId: string | null = null;
    let resolvedExerciseName: string | null = null;
    if (exerciseId) {
      const byId = await getExerciseById(exerciseId);
      if (byId) {
        resolvedExerciseId = byId.id;
        resolvedExerciseName = byId.name;
      } else {
        resolvedExerciseId = exerciseId;
      }
    } else if (exerciseName) {
      const resolved = await resolveExerciseByName(exerciseName);
      if (resolved) {
        resolvedExerciseId = resolved.id;
        resolvedExerciseName = resolved.name;
      } else {
        resolvedExerciseName = exerciseName;
      }
    }

    const cacheParams = {
      from: from.toISOString(),
      to: to.toISOString(),
      exerciseId: resolvedExerciseId,
      exerciseName: resolvedExerciseName ?? exerciseName ?? null,
      limit,
    };

    const cached = await getStatsCache<{
      from: string;
      to: string;
      rangeDays: number;
      items: PrItem[];
    }>({
      userId,
      metric: "prs",
      params: cacheParams,
      maxAgeSeconds: 300,
    });
    if (cached) return NextResponse.json(cached);

    const exerciseFilter = resolvedExerciseId
      ? resolvedExerciseName
        ? or(
            eq(workoutSet.exerciseId, resolvedExerciseId),
            and(
              sql`${workoutSet.exerciseId} is null`,
              sql`lower(${workoutSet.exerciseName}) = lower(${resolvedExerciseName})`,
            ),
          )
        : eq(workoutSet.exerciseId, resolvedExerciseId)
      : resolvedExerciseName
        ? sql`lower(${workoutSet.exerciseName}) = lower(${resolvedExerciseName})`
        : undefined;

    const baseWhere = and(
      eq(workoutLog.userId, userId),
      gte(workoutLog.performedAt, from),
      lte(workoutLog.performedAt, to),
      sql`${workoutSet.weightKg} is not null`,
      sql`${workoutSet.reps} is not null`,
    );
    const where = exerciseFilter ? and(baseWhere, exerciseFilter) : baseWhere;

    const rows = await db
      .select({
        performedAt: workoutLog.performedAt,
        exerciseId: workoutSet.exerciseId,
        exerciseName: sql<string>`coalesce(${exercise.name}, ${workoutSet.exerciseName})`,
        weightKg: workoutSet.weightKg,
        reps: workoutSet.reps,
      })
      .from(workoutLog)
      .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
      .leftJoin(exercise, eq(exercise.id, workoutSet.exerciseId))
      .where(where)
      .orderBy(workoutLog.performedAt);

    const byExercise = new Map<string, PrItemInternal>();
    for (const r of rows) {
      const weightKg = Number(r.weightKg ?? 0);
      const reps = Number(r.reps ?? 0);
      if (!weightKg || !reps) continue;

      const e1rm = Math.round(epley1RM(weightKg, reps) * 10) / 10;
      const date = new Date(r.performedAt).toISOString().slice(0, 10);
      const point: PrPoint = { date, e1rm, weightKg, reps };

      const key = r.exerciseId ?? String(r.exerciseName ?? "").trim().toLowerCase();
      if (!key) continue;

      if (!byExercise.has(key)) {
        byExercise.set(key, {
          exerciseId: r.exerciseId ?? null,
          exerciseName: String(r.exerciseName ?? "Unknown"),
          first: point,
          best: point,
          latest: point,
        });
        continue;
      }

      const cur = byExercise.get(key)!;
      if (point.e1rm > cur.best.e1rm) {
        cur.best = point;
      }
      if (
        point.date > cur.latest.date ||
        (point.date === cur.latest.date && point.e1rm >= cur.latest.e1rm)
      ) {
        cur.latest = point;
      }
    }

    const items = Array.from(byExercise.values())
      .map((x) => ({
        exerciseId: x.exerciseId,
        exerciseName: x.exerciseName,
        best: x.best,
        latest: x.latest,
        improvement: Math.round((x.best.e1rm - x.first.e1rm) * 10) / 10,
      }))
      .sort((a, b) => b.best.e1rm - a.best.e1rm)
      .slice(0, limit);

    const payload = {
      from: from.toISOString(),
      to: to.toISOString(),
      rangeDays,
      items,
    };

    await setStatsCache({
      userId,
      metric: "prs",
      params: cacheParams,
      payload,
    });

    return NextResponse.json(payload);
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);
