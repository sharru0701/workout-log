import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { plan, planModule, programTemplate, programVersion } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { resolveRequestLocale } from "@/lib/i18n/messages";

type Ctx = {
  params: Promise<{ slug: string }>;
};

async function DELETEImpl(_: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { slug } = await ctx.params;
    const userId = getAuthenticatedUserId();
    const normalizedSlug = String(slug ?? "").trim();
    if (!normalizedSlug) {
      return NextResponse.json({ error: locale === "ko" ? "slug가 필요합니다." : "slug is required." }, { status: 400 });
    }

    const templateRows = await db
      .select({
        id: programTemplate.id,
        slug: programTemplate.slug,
        name: programTemplate.name,
        visibility: programTemplate.visibility,
        ownerUserId: programTemplate.ownerUserId,
      })
      .from(programTemplate)
      .where(eq(programTemplate.slug, normalizedSlug))
      .limit(1);

    const template = templateRows[0];
    if (!template) {
      return NextResponse.json({ error: locale === "ko" ? "템플릿을 찾을 수 없습니다." : "Template not found." }, { status: 404 });
    }
    if (template.visibility !== "PRIVATE") {
      return NextResponse.json({ error: locale === "ko" ? "공개 템플릿은 삭제할 수 없습니다." : "Public templates cannot be deleted." }, { status: 403 });
    }
    if (template.ownerUserId !== userId) {
      return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });
    }

    const versions = await db
      .select({ id: programVersion.id })
      .from(programVersion)
      .where(eq(programVersion.templateId, template.id));
    const versionIds = versions.map((entry) => entry.id);

    let deletedPlanCount = 0;
    await db.transaction(async (tx) => {
      const affectedPlanIds = new Set<string>();

      if (versionIds.length > 0) {
        const rootPlans = await tx
          .select({ id: plan.id })
          .from(plan)
          .where(and(eq(plan.userId, userId), inArray(plan.rootProgramVersionId, versionIds)));
        rootPlans.forEach((entry) => affectedPlanIds.add(entry.id));

        const modulePlans = await tx
          .select({ id: plan.id })
          .from(planModule)
          .innerJoin(plan, eq(planModule.planId, plan.id))
          .where(and(eq(plan.userId, userId), inArray(planModule.programVersionId, versionIds)));
        modulePlans.forEach((entry) => affectedPlanIds.add(entry.id));
      }

      const planIds = Array.from(affectedPlanIds);
      if (planIds.length > 0) {
        const deletedPlans = await tx
          .delete(plan)
          .where(and(eq(plan.userId, userId), inArray(plan.id, planIds)))
          .returning({ id: plan.id });
        deletedPlanCount = deletedPlans.length;
      }

      const deletedTemplates = await tx
        .delete(programTemplate)
        .where(
          and(
            eq(programTemplate.id, template.id),
            eq(programTemplate.visibility, "PRIVATE"),
            eq(programTemplate.ownerUserId, userId),
          ),
        )
        .returning({
          id: programTemplate.id,
          slug: programTemplate.slug,
          name: programTemplate.name,
        });

      if (!deletedTemplates[0]) {
        throw new Error("template delete failed");
      }
    });

    return NextResponse.json({
      deleted: true,
      template: {
        id: template.id,
        slug: template.slug,
        name: template.name,
      },
      deletedPlanCount,
    });
  } catch (e: any) {
    if (e?.code === "23503") {
      return NextResponse.json(
        {
          error:
            locale === "ko"
              ? "이 템플릿은 아직 플랜 모듈에서 참조 중입니다."
              : "This template is still referenced by plan modules.",
        },
        { status: 409 },
      );
    }
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const DELETE = withApiLogging(DELETEImpl);
