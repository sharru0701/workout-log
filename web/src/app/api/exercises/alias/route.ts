import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { exercise, exerciseAlias } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";

async function POSTImpl(req: Request) {
  try {
    const body = await req.json();
    const exerciseId = String(body.exerciseId ?? "").trim();
    const alias = String(body.alias ?? "").trim();

    if (!exerciseId || !alias) {
      return NextResponse.json({ error: "exerciseId and alias are required" }, { status: 400 });
    }

    const exerciseRows = await db
      .select({ id: exercise.id, name: exercise.name })
      .from(exercise)
      .where(eq(exercise.id, exerciseId))
      .limit(1);
    if (!exerciseRows[0]) {
      return NextResponse.json({ error: "exercise not found" }, { status: 404 });
    }

    const existingAlias = await db
      .select({
        id: exerciseAlias.id,
        exerciseId: exerciseAlias.exerciseId,
        alias: exerciseAlias.alias,
      })
      .from(exerciseAlias)
      .where(eq(exerciseAlias.alias, alias))
      .limit(1);

    if (existingAlias[0] && existingAlias[0].exerciseId !== exerciseId) {
      return NextResponse.json({ error: "alias already mapped to another exercise" }, { status: 409 });
    }
    if (existingAlias[0] && existingAlias[0].exerciseId === exerciseId) {
      return NextResponse.json({ alias: existingAlias[0], created: false });
    }

    const inserted = await db
      .insert(exerciseAlias)
      .values({
        exerciseId,
        alias,
      })
      .onConflictDoNothing()
      .returning({
        id: exerciseAlias.id,
        exerciseId: exerciseAlias.exerciseId,
        alias: exerciseAlias.alias,
      });

    if (inserted[0]) {
      return NextResponse.json({ alias: inserted[0], created: true }, { status: 201 });
    }

    const aliasRows = await db
      .select({
        id: exerciseAlias.id,
        exerciseId: exerciseAlias.exerciseId,
        alias: exerciseAlias.alias,
      })
      .from(exerciseAlias)
      .where(and(eq(exerciseAlias.exerciseId, exerciseId), eq(exerciseAlias.alias, alias)))
      .limit(1);

    return NextResponse.json({ alias: aliasRows[0] ?? null, created: false });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const POST = withApiLogging(POSTImpl);
