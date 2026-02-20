import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { workoutLog, workoutSet } from "@/server/db/schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userId = body.userId as string;
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const sets = Array.isArray(body.sets) ? body.sets : [];
    if (sets.length === 0) {
      return NextResponse.json({ error: "sets required" }, { status: 400 });
    }

    const created = await db.transaction(async (tx) => {
      const [log] = await tx
        .insert(workoutLog)
        .values({
          userId,
          planId: body.planId ?? null,
          generatedSessionId: body.generatedSessionId ?? null,
          performedAt: body.performedAt ? new Date(body.performedAt) : new Date(),
          durationMinutes: body.durationMinutes ?? null,
          notes: body.notes ?? null,
          tags: body.tags ?? null,
        })
        .returning();

      await tx.insert(workoutSet).values(
        sets.map((s: any, idx: number) => ({
          logId: log.id,
          exerciseName: String(s.exerciseName),
          sortOrder: s.sortOrder ?? idx,
          setNumber: s.setNumber ?? 1,
          reps: s.reps ?? null,
          weightKg: s.weightKg ?? null,
          rpe: s.rpe ?? null,
          isExtra: Boolean(s.isExtra ?? false),
          meta: s.meta ?? {},
        })),
      );

      return log;
    });

    return NextResponse.json({ log: created }, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
