import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { generatedSession, plan, workoutLog } from "@/server/db/schema";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getStatsCache, setStatsCache } from "@/server/stats/cache";
import { parseDateRangeFromSearchParams } from "@/server/stats/range";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

type PlanCompliance = {
  planId: string;
  planName: string;
  planned: number;
  done: number;
  compliance: number;
};

async function computeCompliance(input: {
  userId: string;
  planId?: string | null;
  from: Date;
  to: Date;
}): Promise<{ planned: number; done: number; compliance: number; byPlan: PlanCompliance[] }> {
  const { userId, planId, from, to } = input;

  const plannedAtExpr = sql<Date>`coalesce(${generatedSession.scheduledAt}, ${generatedSession.updatedAt})`;
  const plannedWhere = and(
    eq(generatedSession.userId, userId),
    gte(plannedAtExpr, from),
    lte(plannedAtExpr, to),
    planId ? eq(generatedSession.planId, planId) : undefined,
  );

  const plannedRows = await db
    .select({
      id: generatedSession.id,
      planId: generatedSession.planId,
      sessionKey: generatedSession.sessionKey,
    })
    .from(generatedSession)
    .where(plannedWhere);

  if (plannedRows.length === 0) {
    return { planned: 0, done: 0, compliance: 0, byPlan: [] };
  }

  const plannedKeySet = new Set(plannedRows.map((r) => `${r.planId}:${r.sessionKey}`));
  const planned = plannedKeySet.size;

  const plannedIds = plannedRows.map((r) => r.id);
  const doneRows = await db
    .select({ generatedSessionId: workoutLog.generatedSessionId })
    .from(workoutLog)
    .where(
      and(
        eq(workoutLog.userId, userId),
        gte(workoutLog.performedAt, from),
        lte(workoutLog.performedAt, to),
        inArray(workoutLog.generatedSessionId, plannedIds),
      ),
    );

  const doneSet = new Set(doneRows.map((r) => r.generatedSessionId).filter(Boolean));
  const done = doneSet.size;

  const uniquePlanIds = Array.from(new Set(plannedRows.map((r) => r.planId)));
  const planRows = uniquePlanIds.length
    ? await db
        .select({ id: plan.id, name: plan.name })
        .from(plan)
        .where(inArray(plan.id, uniquePlanIds))
    : [];
  const planNameById = new Map(planRows.map((r) => [r.id, r.name]));

  const byPlanMap = new Map<string, { plannedKeys: Set<string>; done: number }>();
  for (const row of plannedRows) {
    if (!byPlanMap.has(row.planId)) {
      byPlanMap.set(row.planId, { plannedKeys: new Set<string>(), done: 0 });
    }
    byPlanMap.get(row.planId)!.plannedKeys.add(`${row.planId}:${row.sessionKey}`);
  }

  const plannedById = new Map(plannedRows.map((r) => [r.id, r.planId]));
  for (const doneId of doneSet) {
    if (!doneId) continue;
    const pId = plannedById.get(doneId);
    if (!pId) continue;
    const bucket = byPlanMap.get(pId);
    if (!bucket) continue;
    bucket.done += 1;
  }

  const byPlan: PlanCompliance[] = Array.from(byPlanMap.entries())
    .map(([pId, bucket]) => {
      const planPlanned = bucket.plannedKeys.size;
      const planDone = bucket.done;
      return {
        planId: pId,
        planName: planNameById.get(pId) ?? "Unknown plan",
        planned: planPlanned,
        done: planDone,
        compliance: planPlanned > 0 ? Math.round((planDone / planPlanned) * 1000) / 1000 : 0,
      };
    })
    .sort((a, b) => b.planned - a.planned || b.compliance - a.compliance);

  const compliance = planned > 0 ? Math.round((done / planned) * 1000) / 1000 : 0;
  return { planned, done, compliance, byPlan };
}

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const planId = searchParams.get("planId");
    const comparePrev = searchParams.get("comparePrev") === "1";

    const { from, to, rangeDays } = parseDateRangeFromSearchParams(searchParams, 30);

    const cacheParams = {
      from: from.toISOString(),
      to: to.toISOString(),
      planId: planId ?? null,
      comparePrev,
    };

    const cached = await getStatsCache<{
      from: string;
      to: string;
      rangeDays: number;
      planId: string | null;
      planned: number;
      done: number;
      compliance: number;
      byPlan: PlanCompliance[];
      previous?: {
        planned: number;
        done: number;
        compliance: number;
      };
      trend?: {
        complianceDelta: number;
        doneDelta: number;
      };
    }>({
      userId,
      metric: "compliance",
      params: cacheParams,
      maxAgeSeconds: 300,
    });
    if (cached) return NextResponse.json(cached);

    const current = await computeCompliance({
      userId,
      planId,
      from,
      to,
    });

    let previous:
      | {
          planned: number;
          done: number;
          compliance: number;
        }
      | undefined;
    let trend:
      | {
          complianceDelta: number;
          doneDelta: number;
        }
      | undefined;

    if (comparePrev) {
      const rangeMs = Math.max(1, to.getTime() - from.getTime());
      const prevTo = new Date(from.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - rangeMs);
      const prev = await computeCompliance({
        userId,
        planId,
        from: prevFrom,
        to: prevTo,
      });

      previous = {
        planned: prev.planned,
        done: prev.done,
        compliance: prev.compliance,
      };
      trend = {
        complianceDelta: current.compliance - prev.compliance,
        doneDelta: current.done - prev.done,
      };
    }

    const payload = {
      from: from.toISOString(),
      to: to.toISOString(),
      rangeDays,
      planId: planId ?? null,
      planned: current.planned,
      done: current.done,
      compliance: current.compliance,
      byPlan: current.byPlan,
      previous,
      trend,
    };

    await setStatsCache({
      userId,
      metric: "compliance",
      params: cacheParams,
      payload,
    });

    return NextResponse.json(payload);
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);
