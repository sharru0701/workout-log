import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { workoutLog, workoutSet } from "@/server/db/schema";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { getExerciseById, resolveExerciseByName } from "@/server/exercise/resolve";
import { getStatsCache, setStatsCache } from "@/server/stats/cache";
import { parseDateRangeFromSearchParams } from "@/server/stats/range";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

function epley1RM(weightKg: number, reps: number) {
  return weightKg * (1 + reps / 30);
}

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const exerciseId = searchParams.get("exerciseId")?.trim() ?? "";
    const exerciseName = (searchParams.get("exerciseId") ? null : searchParams.get("exercise")) ?? searchParams.get("exerciseName");

    if (!exerciseId && !exerciseName) {
      return NextResponse.json(
        { error: "exerciseId or exercise is required" },
        { status: 400 },
      );
    }
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

    const cacheParams = {
      from: from.toISOString(),
      to: to.toISOString(),
      exerciseId: resolvedExerciseId,
      exerciseName: resolvedExerciseName ?? exerciseName ?? null,
    };
    const cached = await getStatsCache<{
      from: string;
      to: string;
      rangeDays: number;
      exercise: string | null;
      exerciseId: string | null;
      best: { date: string; e1rm: number; weightKg: number; reps: number } | null;
      series: Array<{ date: string; e1rm: number; weightKg: number; reps: number }>;
    }>({
      userId,
      metric: "e1rm_best",
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
      : sql`lower(${workoutSet.exerciseName}) = lower(${resolvedExerciseName ?? ""})`;

    const rows = await db
      .select({
        performedAt: workoutLog.performedAt,
        weightKg: workoutSet.weightKg,
        reps: workoutSet.reps,
      })
      .from(workoutLog)
      .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
      .where(
        and(
          eq(workoutLog.userId, userId),
          exerciseFilter,
          gte(workoutLog.performedAt, from),
          lte(workoutLog.performedAt, to),
          sql`${workoutSet.weightKg} is not null`,
          sql`${workoutSet.reps} is not null`,
        ),
      )
      .orderBy(desc(workoutLog.performedAt))
      .limit(5000);

    const points = rows
      .map((r) => {
        const w = Number(r.weightKg ?? 0);
        const reps = Number(r.reps ?? 0);
        if (!w || !reps) return null;
        return {
          performedAt: r.performedAt,
          weightKg: w,
          reps,
          e1rm: Math.round(epley1RM(w, reps) * 10) / 10,
        };
      })
      .filter(Boolean) as Array<{ performedAt: Date; weightKg: number; reps: number; e1rm: number }>;

    // best e1rm per day
    const bestByDay = new Map<string, (typeof points)[number]>();
    for (const p of points) {
      const dayKey = p.performedAt.toISOString().slice(0, 10);
      const cur = bestByDay.get(dayKey);
      if (!cur || p.e1rm > cur.e1rm) bestByDay.set(dayKey, p);
    }

    const series = Array.from(bestByDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, p]) => ({
        date,
        e1rm: Number(p.e1rm),
        weightKg: Number(p.weightKg),
        reps: Number(p.reps),
      }));

    const best = series.reduce(
      (acc, p) => (!acc || p.e1rm > acc.e1rm ? p : acc),
      null as null | (typeof series)[number],
    );

    const payload = {
      from: from.toISOString(),
      to: to.toISOString(),
      rangeDays,
      exercise: resolvedExerciseName ?? exerciseName ?? resolvedExerciseId ?? null,
      exerciseId: resolvedExerciseId,
      best,
      series,
    };

    await setStatsCache({
      userId,
      metric: "e1rm_best",
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
