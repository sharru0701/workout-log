import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { workoutLog, workoutSet } from "@/server/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const days = Number(searchParams.get("days") ?? "180");
    const bucket = (searchParams.get("bucket") ?? "week").toLowerCase(); // day|week|month

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const since = new Date();
    since.setDate(since.getDate() - (Number.isFinite(days) ? days : 180));

    const unit = bucket === "day" ? "day" : bucket === "month" ? "month" : "week";
    const unitSql = sql.raw(`'${unit}'`); // safe: unit is controlled above

    const rows = await db
      .select({
        period: sql<string>`to_char(date_trunc(${unitSql}, ${workoutLog.performedAt}), 'YYYY-MM-DD')`,
        tonnage: sql<number>`coalesce(sum(${workoutSet.weightKg} * ${workoutSet.reps}), 0)`,
        reps: sql<number>`coalesce(sum(${workoutSet.reps}), 0)`,
        sets: sql<number>`count(*)`,
      })
      .from(workoutSet)
      .innerJoin(workoutLog, sql`${workoutLog.id} = ${workoutSet.logId}`)
      .where(and(eq(workoutLog.userId, userId), gte(workoutLog.performedAt, since)))
      .groupBy(sql`date_trunc(${unitSql}, ${workoutLog.performedAt})`)
      .orderBy(sql`date_trunc(${unitSql}, ${workoutLog.performedAt}) asc`);

    const series = rows.map((r) => ({
      period: r.period,
      tonnage: Number(r.tonnage ?? 0),
      reps: Number(r.reps ?? 0),
      sets: Number(r.sets ?? 0),
    }));

    return NextResponse.json({ rangeDays: days, bucket: unit, series });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
