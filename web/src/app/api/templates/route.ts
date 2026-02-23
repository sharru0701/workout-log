import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { programTemplate, programVersion } from "@/server/db/schema";
import { and, asc, desc, eq, gt, inArray, or } from "drizzle-orm";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

type TemplateCursor = {
  name: string;
  id: string;
};

function parseCursor(raw: string | null): TemplateCursor | null {
  if (!raw) return null;

  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as TemplateCursor;
    if (typeof decoded?.name !== "string" || typeof decoded?.id !== "string") return null;
    return decoded;
  } catch {
    return null;
  }
}

function encodeCursor(cursor: TemplateCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const cursor = parseCursor(searchParams.get("cursor"));
    const limitRaw = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 20;

    const visibilityFilter = or(
      eq(programTemplate.visibility, "PUBLIC"),
      and(eq(programTemplate.visibility, "PRIVATE"), eq(programTemplate.ownerUserId, userId)),
    );

    const cursorFilter = cursor
      ? or(
          gt(programTemplate.name, cursor.name),
          and(eq(programTemplate.name, cursor.name), gt(programTemplate.id, cursor.id)),
        )
      : undefined;

    const where = cursorFilter ? and(visibilityFilter, cursorFilter) : visibilityFilter;

    const templates = await db
      .select()
      .from(programTemplate)
      .where(where)
      .orderBy(asc(programTemplate.name), asc(programTemplate.id))
      .limit(limit + 1);

    const hasMore = templates.length > limit;
    const pageTemplates = hasMore ? templates.slice(0, limit) : templates;

    const templateIds = pageTemplates.map((t) => t.id);
    const latestVersionByTemplateId = new Map<string, (typeof programVersion.$inferSelect)>();

    if (templateIds.length > 0) {
      const versionRows = await db
        .select()
        .from(programVersion)
        .where(inArray(programVersion.templateId, templateIds))
        .orderBy(asc(programVersion.templateId), desc(programVersion.version));

      for (const row of versionRows) {
        if (!latestVersionByTemplateId.has(row.templateId)) {
          latestVersionByTemplateId.set(row.templateId, row);
        }
      }
    }

    const items = pageTemplates.map((t) => ({
      ...t,
      latestVersion: latestVersionByTemplateId.get(t.id) ?? null,
    }));

    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? encodeCursor({ name: last.name, id: last.id }) : null;

    return NextResponse.json({ items, nextCursor, limit });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);
