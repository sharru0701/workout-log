import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { programTemplate, programVersion } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { resolveRequestLocale } from "@/lib/i18n/messages";

type Ctx = { params: Promise<{ slug: string }> };

async function POSTImpl(req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { slug } = await ctx.params;
    const body = await req.json();

    const userId = getAuthenticatedUserId();
    const newSlug = body.newSlug as string | undefined;
    const newName = body.newName as string | undefined;

    const srcT = await db
      .select()
      .from(programTemplate)
      .where(eq(programTemplate.slug, slug))
      .limit(1);

    const sourceTemplate = srcT[0];
    if (!sourceTemplate) return NextResponse.json({ error: locale === "ko" ? "원본 템플릿을 찾을 수 없습니다." : "Source template not found." }, { status: 404 });
    if (sourceTemplate.visibility === "PRIVATE" && sourceTemplate.ownerUserId !== userId) {
      return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });
    }

    const srcV = await db
      .select()
      .from(programVersion)
      .where(eq(programVersion.templateId, sourceTemplate.id))
      .orderBy(desc(programVersion.version))
      .limit(1);

    const sourceVersion = srcV[0];
    if (!sourceVersion) return NextResponse.json({ error: locale === "ko" ? "원본 버전을 찾을 수 없습니다." : "Source version not found." }, { status: 404 });

    const forkSlug = newSlug ?? `${slug}-${userId}-${Date.now()}`;
    const forkName = newName ?? `${sourceTemplate.name} (Fork)`;

    const created = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(programTemplate)
        .values({
          slug: forkSlug,
          name: forkName,
          type: sourceTemplate.type,
          visibility: "PRIVATE",
          ownerUserId: userId,
          parentTemplateId: sourceTemplate.id, // FK 없이도 OK (uuid 컬럼)
          description: sourceTemplate.description,
          tags: sourceTemplate.tags,
        })
        .returning();

      const [v] = await tx
        .insert(programVersion)
        .values({
          templateId: t.id,
          version: 1,
          parentVersionId: sourceVersion.id, // FK 없이도 OK
          definition: sourceVersion.definition,
          defaults: sourceVersion.defaults,
          changelog: `Forked from ${sourceTemplate.slug}@v${sourceVersion.version}`,
        })
        .returning();

      return { template: t, version: v, source: { template: sourceTemplate, version: sourceVersion } };
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const POST = withApiLogging(POSTImpl);
