import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { programTemplate, programVersion } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

type Ctx = { params: Promise<{ id: string }> };

async function PUTImpl(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const userId = getAuthenticatedUserId();

    const definition = body.definition;
    if (!definition) {
      return NextResponse.json({ error: "definition required" }, { status: 400 });
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
    if (!version) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!version.templateOwnerUserId || version.templateOwnerUserId !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const [updated] = await db
      .update(programVersion)
      .set({ definition })
      .where(eq(programVersion.id, id))
      .returning();
    return NextResponse.json({ programVersion: updated });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const PUT = withApiLogging(PUTImpl);
