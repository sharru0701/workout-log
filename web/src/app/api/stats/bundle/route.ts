// PERF: 5개 stats API 요청을 1개로 통합하는 번들 엔드포인트
// stats/page.tsx에서 호출하는 5개 GET 요청을 단일 서버 사이드 병렬 처리로 대체
// 캐시 파라미터를 일 단위 문자열로 고정해 동일 날짜 내 캐시 히트율 향상
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { exercise, generatedSession, plan, workoutLog, workoutSet } from "@/server/db/schema";
import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { resolveLoggedTotalLoadKg } from "@/lib/bodyweight-load";
import { getStatsCache, setStatsCache } from "@/server/stats/cache";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { resolveRequestLocale } from "@/lib/i18n/messages";
import { apiErrorResponse } from "@/app/api/_utils/error-response";

function epley1RM(weightKg: number, reps: number) {
  return weightKg * (1 + reps / 30);
}

type PrPoint = { date: string; e1rm: number; weightKg: number; reps: number };

type PrItem = {
  exerciseId: string | null;
  exerciseName: string;
  best: PrPoint;
  latest: PrPoint;
  improvement: number;
};

type PlanCompliance = {
  planId: string;
  planName: string;
  planned: number;
  done: number;
  compliance: number;
};

type ComplianceResult = {
  planned: number;
  done: number;
  compliance: number;
  byPlan: PlanCompliance[];
};

async function fetchSavedLogs(userId: string, from: Date, to: Date): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(workoutLog)
    .where(and(eq(workoutLog.userId, userId), gte(workoutLog.performedAt, from), lte(workoutLog.performedAt, to)));
  return Number(rows[0]?.n ?? 0);
}

async function fetchVolumeTonnage(userId: string, from: Date, to: Date): Promise<number> {
  const rows = await db
    .select({ tonnage: sql<number>`coalesce(sum(${workoutSet.weightKg} * ${workoutSet.reps}), 0)` })
    .from(workoutLog)
    .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
    .where(and(eq(workoutLog.userId, userId), gte(workoutLog.performedAt, from), lte(workoutLog.performedAt, to)));
  return Number(rows[0]?.tonnage ?? 0);
}

async function fetchCompliance(userId: string, from: Date, to: Date): Promise<ComplianceResult> {
  const locale = await resolveRequestLocale();
  const plannedAtExpr = sql<Date>`coalesce(${generatedSession.scheduledAt}, ${generatedSession.updatedAt})`;
  const plannedRows = await db
    .select({ id: generatedSession.id, planId: generatedSession.planId, sessionKey: generatedSession.sessionKey })
    .from(generatedSession)
    .where(and(eq(generatedSession.userId, userId), gte(plannedAtExpr, from), lte(plannedAtExpr, to)));

  if (plannedRows.length === 0) return { planned: 0, done: 0, compliance: 0, byPlan: [] };

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
    ? await db.select({ id: plan.id, name: plan.name }).from(plan).where(inArray(plan.id, uniquePlanIds))
    : [];
  const planNameById = new Map(planRows.map((r) => [r.id, r.name]));

  const byPlanMap = new Map<string, { plannedKeys: Set<string>; done: number }>();
  for (const row of plannedRows) {
    if (!byPlanMap.has(row.planId)) byPlanMap.set(row.planId, { plannedKeys: new Set(), done: 0 });
    byPlanMap.get(row.planId)!.plannedKeys.add(`${row.planId}:${row.sessionKey}`);
  }

  const plannedById = new Map(plannedRows.map((r) => [r.id, r.planId]));
  for (const doneId of doneSet) {
    if (!doneId) continue;
    const pId = plannedById.get(doneId);
    if (pId) byPlanMap.get(pId)!.done += 1;
  }

  const byPlan: PlanCompliance[] = Array.from(byPlanMap.entries())
    .map(([pId, bucket]) => ({
      planId: pId,
      planName: planNameById.get(pId) ?? (locale === "ko" ? "알 수 없는 플랜" : "Unknown plan"),
      planned: bucket.plannedKeys.size,
      done: bucket.done,
      compliance: bucket.plannedKeys.size > 0 ? Math.round((bucket.done / bucket.plannedKeys.size) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.planned - a.planned || b.compliance - a.compliance);

  return {
    planned,
    done,
    compliance: planned > 0 ? Math.round((done / planned) * 1000) / 1000 : 0,
    byPlan,
  };
}

async function fetchPrs(userId: string, from: Date, to: Date, limit: number): Promise<PrItem[]> {
  const locale = await resolveRequestLocale();
  const rows = await db
    .select({
      performedAt: workoutLog.performedAt,
      exerciseId: workoutSet.exerciseId,
      exerciseName: sql<string>`coalesce(${exercise.name}, ${workoutSet.exerciseName})`,
      weightKg: workoutSet.weightKg,
      reps: workoutSet.reps,
      meta: workoutSet.meta,
    })
    .from(workoutLog)
    .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
    .leftJoin(exercise, eq(exercise.id, workoutSet.exerciseId))
    .where(
      and(
        eq(workoutLog.userId, userId),
        gte(workoutLog.performedAt, from),
        lte(workoutLog.performedAt, to),
        sql`${workoutSet.weightKg} is not null`,
        sql`${workoutSet.reps} is not null`,
      ),
    )
    .orderBy(workoutLog.performedAt);

  type Internal = {
    exerciseId: string | null;
    exerciseName: string;
    first: PrPoint;
    best: PrPoint;
    latest: PrPoint;
  };
  const byExercise = new Map<string, Internal>();

  for (const r of rows) {
    const weightKg = resolveLoggedTotalLoadKg({
      exerciseName: String(r.exerciseName ?? ""),
      weightKg: r.weightKg,
      meta: r.meta as Record<string, unknown> | null | undefined,
    });
    const reps = Number(r.reps ?? 0);
    if (!weightKg || !reps) continue;

    const e1rm = Math.round(epley1RM(weightKg, reps) * 10) / 10;
    const date = new Date(r.performedAt).toISOString().slice(0, 10);
    const point: PrPoint = { date, e1rm, weightKg, reps };
    const key = r.exerciseId ?? String(r.exerciseName ?? "").trim().toLowerCase();
    if (!key) continue;

    if (!byExercise.has(key)) {
      byExercise.set(key, {
        exerciseId: r.exerciseId ?? null,
        exerciseName: String(r.exerciseName ?? (locale === "ko" ? "알 수 없는 운동" : "Unknown Exercise")),
        first: point,
        best: point,
        latest: point,
      });
      continue;
    }

    const cur = byExercise.get(key)!;
    if (point.e1rm > cur.best.e1rm) cur.best = point;
    if (point.date > cur.latest.date || (point.date === cur.latest.date && point.e1rm >= cur.latest.e1rm)) {
      cur.latest = point;
    }
  }

  return Array.from(byExercise.values())
    .map((x) => ({
      exerciseId: x.exerciseId,
      exerciseName: x.exerciseName,
      best: x.best,
      latest: x.latest,
      improvement: Math.round((x.best.e1rm - x.first.e1rm) * 10) / 10,
    }))
    .sort((a, b) => b.best.e1rm - a.best.e1rm)
    .slice(0, limit);
}

async function GETImpl(req: Request) {
  try {
    const userId = getAuthenticatedUserId();
    const url = new URL(req.url);
    // days=0 means "all time"; default 30
    const daysParam = url.searchParams.get("days");
    const days = daysParam !== null ? parseInt(daysParam, 10) : 30;

    const to = new Date();
    const from = days > 0 ? new Date(to.getTime() - days * 86_400_000) : new Date(0);

    // PERF: 캐시 파라미터를 일 단위 문자열로 고정 → 동일 날짜 내 반복 요청에서 캐시 히트
    const cacheParams = {
      to: to.toISOString().slice(0, 10),
      from: from.toISOString().slice(0, 10),
      days,
      prsLimit: 10,
    };

    const cached = await getStatsCache<{
      sessions30d: number;
      tonnage30d: number;
      compliance90d: ComplianceResult;
      prs90d: PrItem[];
    }>({ userId, metric: "bundle_v2", params: cacheParams, maxAgeSeconds: 300 });
    if (cached) return NextResponse.json(cached);

    const [sessions30d, tonnage30d, compliance90d, prs90d] = await Promise.all([
      fetchSavedLogs(userId, from, to),
      fetchVolumeTonnage(userId, from, to),
      fetchCompliance(userId, from, to),
      fetchPrs(userId, from, to, 10),
    ]);

    const payload = { sessions30d, tonnage30d, compliance90d, prs90d };
    await setStatsCache({ userId, metric: "bundle_v2", params: cacheParams, payload });

    return NextResponse.json(payload);
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const GET = withApiLogging(GETImpl);
