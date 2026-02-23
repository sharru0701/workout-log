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

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const exerciseId = searchParams.get("exerciseId")?.trim() ?? "";
    const exerciseName = searchParams.get("exercise") ?? searchParams.get("exerciseName");
    const comparePrev = searchParams.get("comparePrev") === "1";

    const { from, to, rangeDays } = parseDateRangeFromSearchParams(searchParams, 30);

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
      comparePrev,
    };
    const cached = await getStatsCache<{
      from: string;
      to: string;
      rangeDays: number;
      totals: { tonnage: number; reps: number; sets: number };
      previousTotals?: { tonnage: number; reps: number; sets: number };
      trend?: { tonnageDelta: number; repsDelta: number; setsDelta: number };
      byExercise: Array<{
        exerciseId?: string | null;
        exerciseName: string;
        tonnage: number;
        reps: number;
        sets: number;
      }>;
    }>({
      userId,
      metric: "volume_totals",
      params: cacheParams,
      maxAgeSeconds: 300,
    });
    if (cached) return NextResponse.json(cached);

    const filterByExercise = resolvedExerciseId
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

    const groupKey = resolvedExerciseId
      ? sql<string>`${resolvedExerciseId}`
      : sql<string>`coalesce(${workoutSet.exerciseId}::text, lower(${workoutSet.exerciseName}))`;
    const groupExerciseId = resolvedExerciseId ? sql<string>`${resolvedExerciseId}` : workoutSet.exerciseId;
    const groupExerciseName = resolvedExerciseId
      ? sql<string>`${resolvedExerciseName ?? exerciseName ?? resolvedExerciseId}`
      : sql<string>`coalesce(${exercise.name}, ${workoutSet.exerciseName})`;

    const baseWhere = and(
      eq(workoutLog.userId, userId),
      gte(workoutLog.performedAt, from),
      lte(workoutLog.performedAt, to),
    );
    const where = filterByExercise ? and(baseWhere, filterByExercise) : baseWhere;

    const rows = await db
      .select({
        key: groupKey,
        exerciseId: groupExerciseId,
        exerciseName: groupExerciseName,
        tonnage: sql<number>`coalesce(sum(${workoutSet.weightKg} * ${workoutSet.reps}), 0)`,
        reps: sql<number>`coalesce(sum(${workoutSet.reps}), 0)`,
        sets: sql<number>`count(*)`,
      })
      .from(workoutLog)
      .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
      .leftJoin(exercise, eq(exercise.id, workoutSet.exerciseId))
      .where(where)
      .groupBy(groupKey, groupExerciseId, groupExerciseName)
      .orderBy(sql`coalesce(sum(${workoutSet.weightKg} * ${workoutSet.reps}), 0) desc`);

    const byExercise = rows.map((r) => ({
      exerciseId: r.exerciseId ?? null,
      exerciseName: r.exerciseName,
      tonnage: Number(r.tonnage ?? 0),
      reps: Number(r.reps ?? 0),
      sets: Number(r.sets ?? 0),
    }));

    const totals = byExercise.reduce(
      (acc, r) => {
        acc.tonnage += r.tonnage;
        acc.reps += r.reps;
        acc.sets += r.sets;
        return acc;
      },
      { tonnage: 0, reps: 0, sets: 0 },
    );

    let previousTotals:
      | {
          tonnage: number;
          reps: number;
          sets: number;
        }
      | undefined;

    let trend:
      | {
          tonnageDelta: number;
          repsDelta: number;
          setsDelta: number;
        }
      | undefined;

    if (comparePrev) {
      const rangeMs = Math.max(1, to.getTime() - from.getTime());
      const prevTo = new Date(from.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - rangeMs);

      const prevBaseWhere = and(
        eq(workoutLog.userId, userId),
        gte(workoutLog.performedAt, prevFrom),
        lte(workoutLog.performedAt, prevTo),
      );
      const prevWhere = filterByExercise ? and(prevBaseWhere, filterByExercise) : prevBaseWhere;

      const prevRows = await db
        .select({
          tonnage: sql<number>`coalesce(sum(${workoutSet.weightKg} * ${workoutSet.reps}), 0)`,
          reps: sql<number>`coalesce(sum(${workoutSet.reps}), 0)`,
          sets: sql<number>`count(*)`,
        })
        .from(workoutLog)
        .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
        .where(prevWhere);

      const prev = prevRows[0] ?? { tonnage: 0, reps: 0, sets: 0 };
      previousTotals = {
        tonnage: Number(prev.tonnage ?? 0),
        reps: Number(prev.reps ?? 0),
        sets: Number(prev.sets ?? 0),
      };
      trend = {
        tonnageDelta: totals.tonnage - previousTotals.tonnage,
        repsDelta: totals.reps - previousTotals.reps,
        setsDelta: totals.sets - previousTotals.sets,
      };
    }

    const payload = {
      from: from.toISOString(),
      to: to.toISOString(),
      rangeDays,
      totals,
      previousTotals,
      trend,
      byExercise,
    };

    await setStatsCache({
      userId,
      metric: "volume_totals",
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
