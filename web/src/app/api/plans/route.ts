import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { plan, planModule, programTemplate, programVersion, workoutLog } from "@/server/db/schema";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { withApiLogging } from "@/server/observability/apiRoute";
import { getAuthenticatedUserId } from "@/server/auth/user";

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function withAutoProgressionDefaults(value: unknown) {
  const next = { ...toRecord(value) };
  next.autoProgression = true;
  return next;
}

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
          params: withAutoProgressionDefaults(body.params),
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
      params: withAutoProgressionDefaults(body.params),
    })
    .returning();

  return NextResponse.json({ plan: p }, { status: 201 });
}

async function GETImpl() {
  const userId = getAuthenticatedUserId();

  const baseItems = await db
    .select()
    .from(plan)
    .where(eq(plan.userId, userId))
    .orderBy(desc(plan.createdAt));

  if (baseItems.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const rootVersionIds = Array.from(
    new Set(
      baseItems
        .map((item) => item.rootProgramVersionId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const versionRows =
    rootVersionIds.length > 0
      ? await db
          .select({
            versionId: programVersion.id,
            templateName: programTemplate.name,
          })
          .from(programVersion)
          .leftJoin(programTemplate, eq(programTemplate.id, programVersion.templateId))
          .where(inArray(programVersion.id, rootVersionIds))
      : [];
  const versionNameById = new Map<string, string>();
  for (const row of versionRows) {
    if (!row.versionId) continue;
    const label = String(row.templateName ?? "").trim();
    if (!label) continue;
    versionNameById.set(row.versionId, label);
  }

  const planIds = baseItems.map((item) => item.id);
  const logRows = await db
    .select({
      planId: workoutLog.planId,
      performedAt: workoutLog.performedAt,
    })
    .from(workoutLog)
    .where(
      and(
        eq(workoutLog.userId, userId),
        isNotNull(workoutLog.planId),
        inArray(workoutLog.planId, planIds),
      ),
    )
    .orderBy(desc(workoutLog.performedAt));
  const lastPerformedAtByPlanId = new Map<string, Date>();
  for (const row of logRows) {
    const planId = row.planId;
    if (!planId) continue;
    if (lastPerformedAtByPlanId.has(planId)) continue;
    lastPerformedAtByPlanId.set(planId, row.performedAt);
  }

  const items = baseItems.map((item) => {
    const baseProgramName =
      (item.rootProgramVersionId && versionNameById.get(item.rootProgramVersionId)) ??
      (item.type === "COMPOSITE" ? "복합 플랜" : "프로그램 정보 없음");
    return {
      ...item,
      baseProgramName,
      lastPerformedAt: lastPerformedAtByPlanId.get(item.id) ?? null,
    };
  });

  return NextResponse.json({ items });
}

export const POST = withApiLogging(POSTImpl);

export const GET = withApiLogging(GETImpl);
