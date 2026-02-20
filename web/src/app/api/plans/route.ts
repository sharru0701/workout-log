import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { plan, planModule } from "@/server/db/schema";

/**
 * Minimal request shapes:
 * - SINGLE:
 *   { userId, name, type:"SINGLE", rootProgramVersionId, params? }
 *
 * - MANUAL:
 *   { userId, name, type:"MANUAL", rootProgramVersionId, params? }  // rootProgramVersionId should point to manual version
 *
 * - COMPOSITE:
 *   { userId, name, type:"COMPOSITE", params?, modules: [{target, programVersionId, priority?, params?}, ...] }
 */
export async function POST(req: Request) {
  const body = await req.json();

  const userId = body.userId;
  const name = body.name;
  const type = body.type;

  if (!userId || !name || !type) {
    return NextResponse.json({ error: "userId, name, type are required" }, { status: 400 });
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
