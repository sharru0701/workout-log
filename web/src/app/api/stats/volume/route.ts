import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { workoutLog, workoutSet } from "@/server/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const days = Number(searchParams.get("days") ?? "30");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const since = new Date();
    since.setDate(since.getDate() - (Number.isFinite(days) ? days : 30));

    const rows = await db
      .select({
        exerciseName: workoutSet.exerciseName,
        tonnage: sql<number>`coalesce(sum(${workoutSet.weightKg} * ${workoutSet.reps}), 0)`,
        reps: sql<number>`coalesce(sum(${workoutSet.reps}), 0)`,
        sets: sql<number>`count(*)`,
      })
      .from(workoutSet)
      .innerJoin(workoutLog, eq(workoutLog.id, workoutSet.logId))
      .where(and(eq(workoutLog.userId, userId), gte(workoutLog.performedAt, since)))
      .groupBy(workoutSet.exerciseName)
      .orderBy(sql`coalesce(sum(${workoutSet.weightKg} * ${workoutSet.reps}), 0) desc`);

    const byExercise = rows.map((r) => ({
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

    return NextResponse.json({ rangeDays: days, totals, byExercise });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}