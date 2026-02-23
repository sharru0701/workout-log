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
    const bucket = (searchParams.get("bucket") ?? "week").toLowerCase(); // day|week|month
    const perExercise = searchParams.get("perExercise") === "1";
    const maxExercisesRaw = Number(searchParams.get("maxExercises") ?? "12");
    const maxExercises = Number.isFinite(maxExercisesRaw)
      ? Math.max(1, Math.min(40, Math.floor(maxExercisesRaw)))
      : 12;

    const { from, to, rangeDays } = parseDateRangeFromSearchParams(searchParams, 180);

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

    const unit = bucket === "day" ? "day" : bucket === "month" ? "month" : "week";

    const cacheParams = {
      from: from.toISOString(),
      to: to.toISOString(),
      bucket: unit,
      exerciseId: resolvedExerciseId,
      exerciseName: resolvedExerciseName ?? exerciseName ?? null,
      perExercise,
      maxExercises,
    };

    const cached = await getStatsCache<{
      from: string;
      to: string;
      rangeDays: number;
      bucket: "day" | "week" | "month";
      exerciseId: string | null;
      exercise: string | null;
      series: Array<{ period: string; tonnage: number; reps: number; sets: number }>;
      byExercise?: Array<{
        exerciseId: string | null;
        exerciseName: string;
        totals: { tonnage: number; reps: number; sets: number };
        series: Array<{ period: string; tonnage: number; reps: number; sets: number }>;
      }>;
    }>({
      userId,
      metric: "volume_series",
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

    const unitSql = sql.raw(`'${unit}'`); // safe: controlled above
    const periodExpr = sql`date_trunc(${unitSql}, ${workoutLog.performedAt} at time zone 'UTC')`;

    const baseWhere = and(
      eq(workoutLog.userId, userId),
      gte(workoutLog.performedAt, from),
      lte(workoutLog.performedAt, to),
    );
    const where = filterByExercise ? and(baseWhere, filterByExercise) : baseWhere;

    const rows = await db
      .select({
        period: sql<string>`to_char(${periodExpr}, 'YYYY-MM-DD')`,
        tonnage: sql<number>`coalesce(sum(${workoutSet.weightKg} * ${workoutSet.reps}), 0)`,
        reps: sql<number>`coalesce(sum(${workoutSet.reps}), 0)`,
        sets: sql<number>`count(*)`,
      })
      .from(workoutLog)
      .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
      .where(where)
      .groupBy(periodExpr)
      .orderBy(periodExpr);

    const series = rows.map((r) => ({
      period: r.period,
      tonnage: Number(r.tonnage ?? 0),
      reps: Number(r.reps ?? 0),
      sets: Number(r.sets ?? 0),
    }));

    let byExercise:
      | Array<{
          exerciseId: string | null;
          exerciseName: string;
          totals: { tonnage: number; reps: number; sets: number };
          series: Array<{ period: string; tonnage: number; reps: number; sets: number }>;
        }>
      | undefined;

    if (perExercise) {
      const keyExpr = sql<string>`coalesce(${workoutSet.exerciseId}::text, lower(${workoutSet.exerciseName}))`;
      const idExpr = workoutSet.exerciseId;
      const nameExpr = sql<string>`coalesce(${exercise.name}, ${workoutSet.exerciseName})`;

      const perRows = await db
        .select({
          exerciseKey: keyExpr,
          exerciseId: idExpr,
          exerciseName: nameExpr,
          period: sql<string>`to_char(${periodExpr}, 'YYYY-MM-DD')`,
          tonnage: sql<number>`coalesce(sum(${workoutSet.weightKg} * ${workoutSet.reps}), 0)`,
          reps: sql<number>`coalesce(sum(${workoutSet.reps}), 0)`,
          sets: sql<number>`count(*)`,
        })
        .from(workoutLog)
        .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
        .leftJoin(exercise, eq(exercise.id, workoutSet.exerciseId))
        .where(where)
        .groupBy(keyExpr, idExpr, nameExpr, periodExpr)
        .orderBy(periodExpr);

      const grouped = new Map<
        string,
        {
          exerciseId: string | null;
          exerciseName: string;
          totals: { tonnage: number; reps: number; sets: number };
          series: Array<{ period: string; tonnage: number; reps: number; sets: number }>;
        }
      >();

      for (const r of perRows) {
        const key = String(r.exerciseKey ?? "unknown");
        if (!grouped.has(key)) {
          grouped.set(key, {
            exerciseId: r.exerciseId ?? null,
            exerciseName: String(r.exerciseName ?? "Unknown"),
            totals: { tonnage: 0, reps: 0, sets: 0 },
            series: [],
          });
        }
        const bucketRow = {
          period: String(r.period),
          tonnage: Number(r.tonnage ?? 0),
          reps: Number(r.reps ?? 0),
          sets: Number(r.sets ?? 0),
        };
        const g = grouped.get(key)!;
        g.series.push(bucketRow);
        g.totals.tonnage += bucketRow.tonnage;
        g.totals.reps += bucketRow.reps;
        g.totals.sets += bucketRow.sets;
      }

      byExercise = Array.from(grouped.values())
        .sort((a, b) => b.totals.tonnage - a.totals.tonnage)
        .slice(0, maxExercises);
    }

    const payload = {
      from: from.toISOString(),
      to: to.toISOString(),
      rangeDays,
      bucket: unit as "day" | "week" | "month",
      exerciseId: resolvedExerciseId,
      exercise: resolvedExerciseName ?? exerciseName ?? null,
      series,
      byExercise,
    };

    await setStatsCache({
      userId,
      metric: "volume_series",
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
