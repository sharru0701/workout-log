import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { exercise, plan, workoutLog, workoutSet } from "@/server/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { resolveLoggedTotalLoadKg } from "@/lib/bodyweight-load";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";

function epley1RM(weightKg: number, reps: number) {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

async function GETImpl(req: Request) {
  try {
    const userId = getAuthenticatedUserId();
    const { searchParams } = new URL(req.url);
    const lookbackDays = Number(searchParams.get("days") ?? "30");
    const topLimit = Number(searchParams.get("limit") ?? "5");

    const from = new Date();
    from.setDate(from.getDate() - lookbackDays);

    // 1. 역동적으로 "주요 운동" 추출
    // 최근 30일간 중량이 가장 높았던 상위 n개 종목을 찾습니다.
    const priorityExercises = await db
      .select({
        exerciseId: workoutSet.exerciseId,
        exerciseName: workoutSet.exerciseName,
        maxWeight: sql<number>`max(${workoutSet.weightKg})`,
        totalTonnage: sql<number>`sum(${workoutSet.weightKg} * ${workoutSet.reps})`,
      })
      .from(workoutLog)
      .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
      .where(
        and(
          eq(workoutLog.userId, userId),
          gte(workoutLog.performedAt, from),
          sql`${workoutSet.weightKg} > 0`
        )
      )
      .groupBy(workoutSet.exerciseId, workoutSet.exerciseName)
      .orderBy(desc(sql`max(${workoutSet.weightKg})`))
      .limit(topLimit);

    if (priorityExercises.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const results = [];

    // 2. 각 운동별 상세 지표 (e1RM, PR, 최근 추이) 조회
    for (const ex of priorityExercises) {
      const exerciseFilter = ex.exerciseId 
        ? eq(workoutSet.exerciseId, ex.exerciseId)
        : eq(workoutSet.exerciseName, ex.exerciseName);

      // 전체 기간 최고기록 (Best e1RM)
      const allTimeBestRows = await db
        .select({
          weightKg: workoutSet.weightKg,
          reps: workoutSet.reps,
          performedAt: workoutLog.performedAt,
          exerciseName: workoutSet.exerciseName,
          meta: workoutSet.meta,
        })
        .from(workoutLog)
        .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
        .where(
          and(
            eq(workoutLog.userId, userId),
            exerciseFilter,
            sql`${workoutSet.weightKg} is not null`,
            sql`${workoutSet.reps} > 0`
          )
        )
        .orderBy(desc(workoutLog.performedAt))
        .limit(1000);

      const points = allTimeBestRows.map(r => {
        const w = resolveLoggedTotalLoadKg({
          exerciseName: r.exerciseName,
          weightKg: r.weightKg,
          meta: r.meta as any
        });
        const reps = Number(r.reps || 0);
        if (w === null || w === undefined) return null;
        return {
          date: r.performedAt.toISOString().slice(0, 10),
          e1rm: epley1RM(w, reps),
          weightKg: w,
          reps
        };
      }).filter((p): p is { date: string; e1rm: number; weightKg: number; reps: number } => p !== null);

      if (points.length === 0) continue;

      const best = points.reduce((acc, p) => p.e1rm > acc.e1rm ? p : acc, points[0]);
      const current = points[0]; // 최신 기록

      // 최근 8주 추이 (스파크라인용)
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
      const recentSeries = points
        .filter(p => new Date(p.date) >= eightWeeksAgo)
        .reverse(); // 시간순

      results.push({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        current: {
          e1rm: Math.round(current.e1rm * 10) / 10,
          date: current.date,
          weightKg: current.weightKg,
          reps: current.reps,
        },
        best: {
          e1rm: Math.round(best.e1rm * 10) / 10,
          date: best.date,
        },
        recentSeries: recentSeries.map(p => Math.round(p.e1rm * 10) / 10),
        improvement: best.e1rm > 0 ? (current.e1rm / best.e1rm - 1) * 100 : 0
      });
    }

    return NextResponse.json({
      items: results,
      recordedAt: new Date().toISOString(),
    });

  } catch (e: any) {
    logError("api.stats.strength_summary.error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);
