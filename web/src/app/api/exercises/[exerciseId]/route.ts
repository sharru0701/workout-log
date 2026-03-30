import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { exercise } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { resolveRequestLocale } from "@/lib/i18n/messages";

type Ctx = {
  params: Promise<{ exerciseId: string }>;
};

async function PATCHImpl(req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { exerciseId } = await ctx.params;
    const id = String(exerciseId ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: locale === "ko" ? "exerciseId가 필요합니다." : "exerciseId is required." }, { status: 400 });
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
      return NextResponse.json({ error: locale === "ko" ? "운동을 찾을 수 없습니다." : "Exercise not found." }, { status: 404 });
    }

    if (nextName !== null && !nextName) {
      return NextResponse.json({ error: locale === "ko" ? "운동 이름은 비워둘 수 없습니다." : "Exercise name cannot be empty." }, { status: 400 });
    }

    const targetName = nextName ?? current.name;
    if (targetName !== current.name) {
      const duplicate = await db
        .select({ id: exercise.id })
        .from(exercise)
        .where(and(eq(exercise.name, targetName), ne(exercise.id, id)))
        .limit(1);
      if (duplicate[0]) {
        return NextResponse.json({ error: locale === "ko" ? "이미 같은 이름의 운동이 있습니다." : "An exercise with that name already exists." }, { status: 409 });
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
    return apiErrorResponse(e);
  }
}

async function DELETEImpl(_: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { exerciseId } = await ctx.params;
    const id = String(exerciseId ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: locale === "ko" ? "exerciseId가 필요합니다." : "exerciseId is required." }, { status: 400 });
    }

    const [deleted] = await db
      .delete(exercise)
      .where(eq(exercise.id, id))
      .returning({
        id: exercise.id,
        name: exercise.name,
      });

    if (!deleted) {
      return NextResponse.json({ error: locale === "ko" ? "운동을 찾을 수 없습니다." : "Exercise not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, exercise: deleted });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const PATCH = withApiLogging(PATCHImpl);

export const DELETE = withApiLogging(DELETEImpl);
