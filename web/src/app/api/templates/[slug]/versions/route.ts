import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { programTemplate, programVersion } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

type Ctx = { params: Promise<{ slug: string }> };

function canReadTemplate(t: any, userId?: string | null) {
  if (t.visibility === "PUBLIC") return true;
  return Boolean(userId && t.ownerUserId === userId);
}

async function GETImpl(_req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    const userId = getAuthenticatedUserId();

    const tRows = await db.select().from(programTemplate).where(eq(programTemplate.slug, slug)).limit(1);
    const t = tRows[0];
    if (!t) return NextResponse.json({ error: "template not found" }, { status: 404 });
    if (!canReadTemplate(t, userId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const versions = await db
      .select()
      .from(programVersion)
      .where(eq(programVersion.templateId, t.id))
      .orderBy(desc(programVersion.version));

    return NextResponse.json({ template: t, versions });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
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
    const { slug } = await ctx.params;
    const body = await req.json();

    const userId = getAuthenticatedUserId();

    const tRows = await db.select().from(programTemplate).where(eq(programTemplate.slug, slug)).limit(1);
    const t = tRows[0];
    if (!t) return NextResponse.json({ error: "template not found" }, { status: 404 });

    if (t.visibility === "PRIVATE" && t.ownerUserId !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (t.visibility === "PUBLIC" && !t.ownerUserId) {
      return NextResponse.json(
        { error: "Public base templates are read-only. Fork first." },
        { status: 403 },
      );
    }

    // base version: either explicit id, or latest
    let base: any | null = null;
    if (body.baseVersionId) {
      const b = await db.select().from(programVersion).where(eq(programVersion.id, body.baseVersionId)).limit(1);
      base = b[0] ?? null;
      if (!base) return NextResponse.json({ error: "baseVersion not found" }, { status: 404 });
      if (base.templateId !== t.id) return NextResponse.json({ error: "baseVersion mismatch" }, { status: 400 });
    } else {
      const b = await db
        .select()
        .from(programVersion)
        .where(eq(programVersion.templateId, t.id))
        .orderBy(desc(programVersion.version))
        .limit(1);
      base = b[0] ?? null;
      if (!base) return NextResponse.json({ error: "no versions for template" }, { status: 400 });
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
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);

export const POST = withApiLogging(POSTImpl);
