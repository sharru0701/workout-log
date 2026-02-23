import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { plan, planModule } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { withApiLogging } from "@/server/observability/apiRoute";
import { getAuthenticatedUserId } from "@/server/auth/user";

/**
 * Minimal request shapes:
 * - SINGLE:
 *   { name, type:"SINGLE", rootProgramVersionId, params? }
 *
 * - MANUAL:
 *   { name, type:"MANUAL", rootProgramVersionId, params? }  // rootProgramVersionId should point to manual version
 *
 * - COMPOSITE:
 *   { name, type:"COMPOSITE", params?, modules: [{target, programVersionId, priority?, params?}, ...] }
 */
async function POSTImpl(req: Request) {
  const body = await req.json();

  const userId = getAuthenticatedUserId();
  const name = body.name;
  const type = body.type;

  if (!name || !type) {
    return NextResponse.json({ error: "name and type are required" }, { status: 400 });
  }

  if (type === "COMPOSITE") {
    const modules = Array.isArray(body.modules) ? body.modules : [];
    if (modules.length === 0) {
      return NextResponse.json({ error: "modules are required for COMPOSITE" }, { status: 400 });
    }

    const created = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(plan)
        .values({
          userId,
          name,
          type,
          params: body.params ?? {},
        })
        .returning();

      await tx.insert(planModule).values(
        modules.map((m: any) => ({
          planId: p.id,
          target: m.target,
          programVersionId: m.programVersionId,
          priority: m.priority ?? 0,
          params: m.params ?? {},
        })),
      );

      return p;
    });

    return NextResponse.json({ plan: created }, { status: 201 });
  }

  // SINGLE or MANUAL
  const rootProgramVersionId = body.rootProgramVersionId;
  if (!rootProgramVersionId) {
    return NextResponse.json({ error: "rootProgramVersionId is required" }, { status: 400 });
  }

  const [p] = await db
    .insert(plan)
    .values({
      userId,
      name,
      type,
      rootProgramVersionId,
      params: body.params ?? {},
    })
    .returning();

  return NextResponse.json({ plan: p }, { status: 201 });
}

async function GETImpl(_req: Request) {
  const userId = getAuthenticatedUserId();

  const items = await db
    .select()
    .from(plan)
    .where(eq(plan.userId, userId))
    .orderBy(desc(plan.createdAt));

  return NextResponse.json({ items });
}

export const POST = withApiLogging(POSTImpl);

export const GET = withApiLogging(GETImpl);
