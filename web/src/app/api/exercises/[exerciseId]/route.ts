import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { exercise } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";

type Ctx = {
  params: Promise<{ exerciseId: string }>;
};

async function PATCHImpl(req: Request, ctx: Ctx) {
  try {
    const { exerciseId } = await ctx.params;
    const id = String(exerciseId ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
    }

    const body = await req.json();
    const nextName =
      body.name === undefined || body.name === null ? null : String(body.name).trim();
    const nextCategory =
      body.category === undefined
        ? undefined
        : body.category === null
          ? null
          : String(body.category).trim() || null;

    const currentRows = await db
      .select({ id: exercise.id, name: exercise.name, category: exercise.category })
      .from(exercise)
      .where(eq(exercise.id, id))
      .limit(1);
    const current = currentRows[0];
    if (!current) {
      return NextResponse.json({ error: "exercise not found" }, { status: 404 });
    }

    if (nextName !== null && !nextName) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }

    const targetName = nextName ?? current.name;
    if (targetName !== current.name) {
      const duplicate = await db
        .select({ id: exercise.id })
        .from(exercise)
        .where(and(eq(exercise.name, targetName), ne(exercise.id, id)))
        .limit(1);
      if (duplicate[0]) {
        return NextResponse.json({ error: "exercise name already exists" }, { status: 409 });
      }
    }

    const [updated] = await db
      .update(exercise)
      .set({
        name: targetName,
        category: nextCategory === undefined ? current.category : nextCategory,
      })
      .where(eq(exercise.id, id))
      .returning({
        id: exercise.id,
        name: exercise.name,
        category: exercise.category,
      });

    return NextResponse.json({ exercise: updated });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

async function DELETEImpl(_: Request, ctx: Ctx) {
  try {
    const { exerciseId } = await ctx.params;
    const id = String(exerciseId ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(exercise)
      .where(eq(exercise.id, id))
      .returning({
        id: exercise.id,
        name: exercise.name,
      });

    if (!deleted) {
      return NextResponse.json({ error: "exercise not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, exercise: deleted });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const PATCH = withApiLogging(PATCHImpl);

export const DELETE = withApiLogging(DELETEImpl);
