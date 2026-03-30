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

function canReadTemplate(t: any, userId?: string | null) {
  if (t.visibility === "PUBLIC") return true;
  return Boolean(userId && t.ownerUserId === userId);
}

async function GETImpl(_req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { slug } = await ctx.params;
    const userId = getAuthenticatedUserId();

    const tRows = await db.select().from(programTemplate).where(eq(programTemplate.slug, slug)).limit(1);
    const t = tRows[0];
    if (!t) return NextResponse.json({ error: locale === "ko" ? "템플릿을 찾을 수 없습니다." : "Template not found." }, { status: 404 });
    if (!canReadTemplate(t, userId)) return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });

    const versions = await db
      .select()
      .from(programVersion)
      .where(eq(programVersion.templateId, t.id))
      .orderBy(desc(programVersion.version));

    return NextResponse.json({ template: t, versions });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

/**
 * POST /api/templates/{slug}/versions
 * body:
 * {
 *   baseVersionId?: "uuid",   // optional
 *   definition?: {...},       // optional (defaults to base definition)
 *   defaults?: {...},         // optional
 *   changelog?: "text"        // optional
 * }
 */
async function POSTImpl(req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { slug } = await ctx.params;
    const body = await req.json();

    const userId = getAuthenticatedUserId();

    const tRows = await db.select().from(programTemplate).where(eq(programTemplate.slug, slug)).limit(1);
    const t = tRows[0];
    if (!t) return NextResponse.json({ error: locale === "ko" ? "템플릿을 찾을 수 없습니다." : "Template not found." }, { status: 404 });

    if (t.visibility === "PRIVATE" && t.ownerUserId !== userId) {
      return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });
    }
    if (t.visibility === "PUBLIC" && !t.ownerUserId) {
      return NextResponse.json(
        { error: locale === "ko" ? "공개 기본 템플릿은 읽기 전용입니다. 먼저 포크해 주세요." : "Public base templates are read-only. Fork first." },
        { status: 403 },
      );
    }

    // base version: either explicit id, or latest
    let base: any | null = null;
    if (body.baseVersionId) {
      const b = await db.select().from(programVersion).where(eq(programVersion.id, body.baseVersionId)).limit(1);
      base = b[0] ?? null;
      if (!base) return NextResponse.json({ error: locale === "ko" ? "baseVersion을 찾을 수 없습니다." : "baseVersion not found." }, { status: 404 });
      if (base.templateId !== t.id) return NextResponse.json({ error: locale === "ko" ? "baseVersion이 이 템플릿과 일치하지 않습니다." : "baseVersion mismatch." }, { status: 400 });
    } else {
      const b = await db
        .select()
        .from(programVersion)
        .where(eq(programVersion.templateId, t.id))
        .orderBy(desc(programVersion.version))
        .limit(1);
      base = b[0] ?? null;
      if (!base) return NextResponse.json({ error: locale === "ko" ? "템플릿에 버전이 없습니다." : "No versions for template." }, { status: 400 });
    }

    // next version number
    const latest = await db
      .select()
      .from(programVersion)
      .where(eq(programVersion.templateId, t.id))
      .orderBy(desc(programVersion.version))
      .limit(1);

    const nextVersion = (latest[0]?.version ?? 0) + 1;

    const [created] = await db
      .insert(programVersion)
      .values({
        templateId: t.id,
        version: nextVersion,
        parentVersionId: base.id,
        definition: body.definition ?? base.definition,
        defaults: body.defaults ?? base.defaults,
        changelog: body.changelog ?? `Derived from v${base.version}`,
      })
      .returning();

    return NextResponse.json({ programVersion: created }, { status: 201 });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const GET = withApiLogging(GETImpl);

export const POST = withApiLogging(POSTImpl);
