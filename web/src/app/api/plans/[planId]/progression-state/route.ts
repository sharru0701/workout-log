import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import {
  plan as planTable,
  planRuntimeState,
  programTemplate,
  programVersion,
} from "@/server/db/schema";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { resolveAutoProgressionProgram } from "@/server/progression/reducer";
import { resolveRequestLocale } from "@/lib/i18n/messages";
import { apiErrorResponse } from "@/app/api/_utils/error-response";

type Ctx = { params: Promise<{ planId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { planId } = await ctx.params;
    const userId = getAuthenticatedUserId();

    const planRows = await db
      .select({
        id: planTable.id,
        userId: planTable.userId,
        params: planTable.params,
        rootProgramVersionId: planTable.rootProgramVersionId,
      })
      .from(planTable)
      .where(eq(planTable.id, planId))
      .limit(1);

    const plan = planRows[0];
    if (!plan) return NextResponse.json({ error: locale === "ko" ? "대상을 찾을 수 없습니다." : "Not found." }, { status: 404 });
    if (plan.userId !== userId) return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });

    const params = (plan.params ?? {}) as Record<string, unknown>;
    if (params.autoProgression !== true || !plan.rootProgramVersionId) {
      return NextResponse.json({ program: null, state: null });
    }

    const versionRows = await db
      .select({
        id: programVersion.id,
        templateId: programVersion.templateId,
        definition: programVersion.definition,
      })
      .from(programVersion)
      .where(eq(programVersion.id, plan.rootProgramVersionId))
      .limit(1);
    const version = versionRows[0];
    if (!version) return NextResponse.json({ program: null, state: null });

    const templateRows = await db
      .select({ id: programTemplate.id, slug: programTemplate.slug })
      .from(programTemplate)
      .where(eq(programTemplate.id, version.templateId))
      .limit(1);
    const template = templateRows[0];
    if (!template) return NextResponse.json({ program: null, state: null });

    const program = resolveAutoProgressionProgram(template.slug, version.definition);
    if (!program) return NextResponse.json({ program: null, state: null });

    const runtimeRows = await db
      .select({ state: planRuntimeState.state })
      .from(planRuntimeState)
      .where(eq(planRuntimeState.planId, planId))
      .limit(1);
    const state = runtimeRows[0]?.state ?? null;

    return NextResponse.json({ program, state });
  } catch (e) {
    console.error("[progression-state] error", e);
    return apiErrorResponse(e);
  }
}
