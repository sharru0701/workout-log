import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { plan as planTable } from "@/server/db/schema";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

type Ctx = { params: Promise<{ planId: string }> };

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function PATCHImpl(req: Request, ctx: Ctx) {
  try {
    const { planId } = await ctx.params;
    const userId = getAuthenticatedUserId();
    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      params?: unknown;
      autoProgression?: unknown;
    };

    const rows = await db
      .select()
      .from(planTable)
      .where(eq(planTable.id, planId))
      .limit(1);
    const found = rows[0];
    if (!found) return NextResponse.json({ error: "plan not found" }, { status: 404 });
    if (found.userId !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const hasNamePatch = typeof body.name === "string";
    const nextName = hasNamePatch ? String(body.name).trim() : "";
    if (hasNamePatch && !nextName) {
      return NextResponse.json({ error: "name must not be empty" }, { status: 400 });
    }
    const hasParamsPatch =
      (body.params !== undefined && body.params !== null && typeof body.params === "object" && !Array.isArray(body.params)) ||
      typeof body.autoProgression === "boolean";
    if (!hasNamePatch && !hasParamsPatch) {
      return NextResponse.json({ error: "no patch payload" }, { status: 400 });
    }

    const currentParams = asRecord(found.params);
    const paramPatch = asRecord(body.params);
    const nextParams: Record<string, unknown> = {
      ...currentParams,
      ...paramPatch,
    };
    if (typeof body.autoProgression === "boolean") {
      nextParams.autoProgression = body.autoProgression;
    }

    const [updated] = await db
      .update(planTable)
      .set({
        name: hasNamePatch ? nextName : undefined,
        params: hasParamsPatch ? nextParams : undefined,
        updatedAt: new Date(),
      })
      .where(eq(planTable.id, planId))
      .returning();

    return NextResponse.json({ plan: updated }, { status: 200 });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const PATCH = withApiLogging(PATCHImpl);
