import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { planOverride, plan as planTable } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

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
    const { planId } = await ctx.params;
    const body = await req.json();

    const userId = getAuthenticatedUserId();

    const planRow = await db.select().from(planTable).where(eq(planTable.id, planId)).limit(1);
    const p = planRow[0];
    if (!p) return NextResponse.json({ error: "plan not found" }, { status: 404 });
    if (p.userId !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const scope = body.scope;
    const patch = body.patch;

    if (!scope || !patch) {
      return NextResponse.json({ error: "scope and patch required" }, { status: 400 });
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
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const POST = withApiLogging(POSTImpl);
