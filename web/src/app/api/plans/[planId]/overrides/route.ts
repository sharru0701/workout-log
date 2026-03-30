import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { planOverride, plan as planTable } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { resolveRequestLocale } from "@/lib/i18n/messages";

type Ctx = { params: Promise<{ planId: string }> };

/**
 * v0 patch types:
 * - ADD_ACCESSORY (SESSION scope):
 *   {
 *     "scope":"SESSION",
 *     "weekNumber":1,
 *     "sessionKey":"W1D1",
 *     "patch":{
 *       "op":"ADD_ACCESSORY",
 *       "value":{
 *         "exerciseName":"Dips",
 *         "sets":[ {"setNumber":1,"reps":10,"weightKg":0,"rpe":8}, ... ],
 *         "order": 99
 *       }
 *     },
 *     "note":"Add dips as accessory"
 *   }
 */
async function POSTImpl(req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { planId } = await ctx.params;
    const body = await req.json();

    const userId = getAuthenticatedUserId();

    const planRow = await db.select().from(planTable).where(eq(planTable.id, planId)).limit(1);
    const p = planRow[0];
    if (!p) return NextResponse.json({ error: locale === "ko" ? "플랜을 찾을 수 없습니다." : "Plan not found." }, { status: 404 });
    if (p.userId !== userId) return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });

    const scope = body.scope;
    const patch = body.patch;

    if (!scope || !patch) {
      return NextResponse.json({ error: locale === "ko" ? "scope와 patch가 필요합니다." : "scope and patch are required." }, { status: 400 });
    }

    const [created] = await db
      .insert(planOverride)
      .values({
        planId,
        scope,
        weekNumber: body.weekNumber ?? null,
        sessionKey: body.sessionKey ?? null,
        patch,
        note: body.note ?? null,
      })
      .returning();

    return NextResponse.json({ override: created }, { status: 201 });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const POST = withApiLogging(POSTImpl);
