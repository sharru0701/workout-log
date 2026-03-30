import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { programTemplate, programVersion } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { resolveRequestLocale } from "@/lib/i18n/messages";

type Ctx = { params: Promise<{ id: string }> };

async function PUTImpl(req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const { id } = await ctx.params;
    const body = await req.json();
    const userId = getAuthenticatedUserId();

    const definition = body.definition;
    if (!definition) {
      return NextResponse.json({ error: locale === "ko" ? "definition이 필요합니다." : "definition is required." }, { status: 400 });
    }

    const versionRows = await db
      .select({
        id: programVersion.id,
        templateId: programVersion.templateId,
        templateOwnerUserId: programTemplate.ownerUserId,
      })
      .from(programVersion)
      .innerJoin(programTemplate, eq(programTemplate.id, programVersion.templateId))
      .where(eq(programVersion.id, id))
      .limit(1);

    const version = versionRows[0];
    if (!version) return NextResponse.json({ error: locale === "ko" ? "대상을 찾을 수 없습니다." : "Not found." }, { status: 404 });
    if (!version.templateOwnerUserId || version.templateOwnerUserId !== userId) {
      return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });
    }

    const [updated] = await db
      .update(programVersion)
      .set({ definition })
      .where(eq(programVersion.id, id))
      .returning();
    return NextResponse.json({ programVersion: updated });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const PUT = withApiLogging(PUTImpl);
