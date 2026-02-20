import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { workoutLog, workoutSet } from "@/server/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";

function epley1RM(weightKg: number, reps: number) {
  return weightKg * (1 + reps / 30);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const exercise = searchParams.get("exercise");
    const days = Number(searchParams.get("days") ?? "180");

    if (!userId || !exercise) {
      return NextResponse.json(
        { error: "userId and exercise are required" },
        { status: 400 },
      );
    }

    const since = new Date();
    since.setDate(since.getDate() - (Number.isFinite(days) ? days : 180));

    const rows = await db
      .select({
        performedAt: workoutLog.performedAt,
        weightKg: workoutSet.weightKg,
        reps: workoutSet.reps,
      })
      .from(workoutSet)
      .innerJoin(workoutLog, eq(workoutLog.id, workoutSet.logId))
      .where(
        and(
          eq(workoutLog.userId, userId),
          eq(workoutSet.exerciseName, exercise),
          gte(workoutLog.performedAt, since),
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

    return NextResponse.json({ exercise, best, series });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}