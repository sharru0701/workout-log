import { eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { generatedSession, plan as planTable, workoutLog } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { invalidateStatsCacheForUser } from "@/server/stats/cache";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { resolveRequestLocale } from "@/lib/i18n/messages";

type Ctx = { params: Promise<{ planId: string }> };

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function PATCHImpl(req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { planId } = await ctx.params;
    const userId = getAuthenticatedUserId();
    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      params?: unknown;
      autoProgression?: unknown;
    };

    const rows = await db
      .select()
      .from(planTable)
      .where(eq(planTable.id, planId))
      .limit(1);
    const found = rows[0];
    if (!found) return NextResponse.json({ error: locale === "ko" ? "플랜을 찾을 수 없습니다." : "Plan not found." }, { status: 404 });
    if (found.userId !== userId) return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });

    const hasNamePatch = typeof body.name === "string";
    const nextName = hasNamePatch ? String(body.name).trim() : "";
    if (hasNamePatch && !nextName) {
      return NextResponse.json({ error: locale === "ko" ? "플랜 이름은 비워둘 수 없습니다." : "Plan name must not be empty." }, { status: 400 });
    }
    const hasParamsPatch =
      (body.params !== undefined && body.params !== null && typeof body.params === "object" && !Array.isArray(body.params)) ||
      typeof body.autoProgression === "boolean";
    if (!hasNamePatch && !hasParamsPatch) {
      return NextResponse.json({ error: locale === "ko" ? "수정할 내용이 없습니다." : "No patch payload." }, { status: 400 });
    }

    const currentParams = asRecord(found.params);
    const paramPatch = asRecord(body.params);
    const nextParams: Record<string, unknown> = {
      ...currentParams,
      ...paramPatch,
    };
    if (typeof body.autoProgression === "boolean") {
      nextParams.autoProgression = body.autoProgression;
    }

    const [updated] = await db
      .update(planTable)
      .set({
        name: hasNamePatch ? nextName : undefined,
        params: hasParamsPatch ? nextParams : undefined,
        updatedAt: new Date(),
      })
      .where(eq(planTable.id, planId))
      .returning();

    return NextResponse.json({ plan: updated }, { status: 200 });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const PATCH = withApiLogging(PATCHImpl);

async function DELETEImpl(_: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { planId } = await ctx.params;
    const userId = getAuthenticatedUserId();

    const rows = await db
      .select()
      .from(planTable)
      .where(eq(planTable.id, planId))
      .limit(1);
    const found = rows[0];
    if (!found) return NextResponse.json({ error: locale === "ko" ? "플랜을 찾을 수 없습니다." : "Plan not found." }, { status: 404 });
    if (found.userId !== userId) return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });

    const result = await db.transaction(async (tx) => {
      const sessionRows = await tx
        .select({ id: generatedSession.id })
        .from(generatedSession)
        .where(eq(generatedSession.planId, planId));
      const sessionIds = sessionRows.map((row) => row.id);

      const deletedLogs = await tx
        .delete(workoutLog)
        .where(
          sessionIds.length > 0
            ? or(eq(workoutLog.planId, planId), inArray(workoutLog.generatedSessionId, sessionIds))
            : eq(workoutLog.planId, planId),
        )
        .returning({ id: workoutLog.id });

      await tx.delete(planTable).where(eq(planTable.id, planId));
      await invalidateStatsCacheForUser(userId, tx);

      return {
        deletedLogCount: deletedLogs.length,
        deletedGeneratedSessionCount: sessionIds.length,
      };
    });

    return NextResponse.json(
      {
        deleted: true,
        planId,
        deletedLogCount: result.deletedLogCount,
        deletedGeneratedSessionCount: result.deletedGeneratedSessionCount,
      },
      { status: 200 },
    );
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const DELETE = withApiLogging(DELETEImpl);
