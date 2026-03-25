// PERF: 통합 홈 데이터 엔드포인트
// 기존: 클라이언트에서 5개 HTTP 요청(4개 병렬 + 1개 순차) → RTT 150ms × 2회 = 300ms+ 대기
// 변경: 서버에서 모든 DB 쿼리를 병렬 실행 후 1회 응답 → RTT 150ms × 1회만 발생
import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  exercise,
  plan,
  programTemplate,
  programVersion,
  workoutLog,
  workoutSet,
} from "@/server/db/schema";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { generateAndSaveSession } from "@/server/program-engine/generateSession";
import { getStatsCache, setStatsCache } from "@/server/stats/cache";
import { resolveLoggedTotalLoadKg } from "@/lib/bodyweight-load";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeTimezone(raw: string | null): string {
  const tz = raw?.trim();
  if (!tz) return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return "UTC";
  }
}

function dateOnlyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function epley1RM(weightKg: number, reps: number) {
  return weightKg * (1 + reps / 30);
}

// ─── Plans ───────────────────────────────────────────────────────────────────

async function fetchPlans(userId: string) {
  const baseItems = await db
    .select()
    .from(plan)
    .where(eq(plan.userId, userId))
    .orderBy(desc(plan.createdAt));

  if (baseItems.length === 0) return { items: [] };

  const rootVersionIds = Array.from(
    new Set(
      baseItems.map((p) => p.rootProgramVersionId).filter((v): v is string => Boolean(v)),
    ),
  );

  const versionRows =
    rootVersionIds.length > 0
      ? await db
          .select({ versionId: programVersion.id, templateName: programTemplate.name })
          .from(programVersion)
          .leftJoin(programTemplate, eq(programTemplate.id, programVersion.templateId))
          .where(inArray(programVersion.id, rootVersionIds))
      : [];

  const versionNameById = new Map<string, string>();
  for (const row of versionRows) {
    if (!row.versionId) continue;
    const label = String(row.templateName ?? "").trim();
    if (label) versionNameById.set(row.versionId, label);
  }

  const planIds = baseItems.map((p) => p.id);
  const logRows = await db
    .select({ planId: workoutLog.planId, performedAt: workoutLog.performedAt })
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
    const pId = row.planId;
    if (!pId || lastPerformedAtByPlanId.has(pId)) continue;
    lastPerformedAtByPlanId.set(pId, row.performedAt);
  }

  const items = baseItems.map((item) => {
    const baseProgramName =
      (item.rootProgramVersionId && versionNameById.get(item.rootProgramVersionId)) ??
      (item.type === "COMPOSITE" ? "복합 플랜" : "프로그램 정보 없음");
    return {
      ...item,
      baseProgramName,
      lastPerformedAt: lastPerformedAtByPlanId.get(item.id)?.toISOString() ?? null,
    };
  });

  return { items };
}

// ─── Logs ────────────────────────────────────────────────────────────────────

async function fetchLogs(userId: string, limit: number) {
  const logs = await db
    .select({
      id: workoutLog.id,
      planId: workoutLog.planId,
      performedAt: workoutLog.performedAt,
    })
    .from(workoutLog)
    .where(eq(workoutLog.userId, userId))
    .orderBy(desc(workoutLog.performedAt))
    .limit(limit);

  if (logs.length === 0) return { items: [] };

  const logIds = logs.map((l) => l.id);
  const sets = await db
    .select({
      logId: workoutSet.logId,
      exerciseName: workoutSet.exerciseName,
      reps: workoutSet.reps,
      weightKg: workoutSet.weightKg,
      meta: workoutSet.meta,
    })
    .from(workoutSet)
    .where(inArray(workoutSet.logId, logIds));

  const setsByLogId = new Map<string, Array<{ exerciseName: string; reps: number | null; weightKg: number | null; meta: Record<string, unknown> | null }>>();
  for (const s of sets) {
    const list = setsByLogId.get(s.logId) ?? [];
    list.push({ exerciseName: s.exerciseName, reps: s.reps, weightKg: s.weightKg, meta: s.meta as Record<string, unknown> | null });
    setsByLogId.set(s.logId, list);
  }

  const items = logs.map((l) => ({
    id: l.id,
    planId: l.planId,
    performedAt: l.performedAt.toISOString(),
    sets: setsByLogId.get(l.id) ?? [],
  }));

  return { items };
}

// ─── PRs ─────────────────────────────────────────────────────────────────────

async function fetchPrs(userId: string, from: Date, to: Date, limit: number) {
  // PERF: 날짜를 일 단위로 잘라 동일 날짜 내 반복 요청에서 캐시 히트율 향상
  const cacheParams = {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    exerciseId: null,
    exerciseName: null,
    limit,
  };

  // PERF: stats 캐시 우선 확인 (DB → in-memory → 응답, 캐시 히트 시 ~2ms)
  const cached = await getStatsCache<{ items: unknown[] }>({
    userId,
    metric: "prs",
    params: cacheParams,
    maxAgeSeconds: 300,
  });
  if (cached) return { items: cached.items };

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

  type PrPoint = { date: string; e1rm: number; weightKg: number; reps: number };
  type PrEntry = { exerciseId: string | null; exerciseName: string; first: PrPoint; best: PrPoint; latest: PrPoint };
  const byExercise = new Map<string, PrEntry>();

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
      byExercise.set(key, { exerciseId: r.exerciseId ?? null, exerciseName: String(r.exerciseName ?? "Unknown"), first: point, best: point, latest: point });
      continue;
    }

    const cur = byExercise.get(key)!;
    if (point.e1rm > cur.best.e1rm) cur.best = point;
    if (point.date > cur.latest.date || (point.date === cur.latest.date && point.e1rm >= cur.latest.e1rm)) {
      cur.latest = point;
    }
  }

  const items = Array.from(byExercise.values())
    .map((x) => ({
      exerciseId: x.exerciseId,
      exerciseName: x.exerciseName,
      best: x.best,
      latest: x.latest,
      improvement: Math.round((x.best.e1rm - x.first.e1rm) * 10) / 10,
    }))
    .sort((a, b) => b.best.e1rm - a.best.e1rm)
    .slice(0, limit);

  await setStatsCache({ userId, metric: "prs", params: cacheParams, payload: { items } });
  return { items };
}

// ─── Volume Series ────────────────────────────────────────────────────────────

async function fetchVolumeSeries(userId: string) {
  const cacheParams = {
    bucket: "session",
    limit: 7,
    exerciseId: null,
    exerciseName: null,
    perExercise: false,
    maxExercises: 12,
  };

  // PERF: stats 캐시 우선 확인
  const cached = await getStatsCache<{ series: unknown[] }>({
    userId,
    metric: "volume_series",
    params: cacheParams,
    maxAgeSeconds: 300,
  });
  if (cached) return { series: cached.series };

  const rows = await db
    .select({
      period: sql<string>`to_char(${workoutLog.performedAt}, 'YYYY-MM-DD')`,
      tonnage: sql<number>`coalesce(sum(${workoutSet.weightKg} * ${workoutSet.reps}), 0)`,
      reps: sql<number>`coalesce(sum(${workoutSet.reps}), 0)`,
      sets: sql<number>`count(*)`,
    })
    .from(workoutLog)
    .innerJoin(workoutSet, eq(workoutSet.logId, workoutLog.id))
    .where(eq(workoutLog.userId, userId))
    .groupBy(workoutLog.id, workoutLog.performedAt)
    .orderBy(desc(workoutLog.performedAt))
    .limit(7);

  // 오래된 순서로 역정렬해서 차트에 시간 순서대로 표시
  const series = rows.reverse().map((r) => ({
    period: r.period,
    tonnage: Number(r.tonnage ?? 0),
    reps: Number(r.reps ?? 0),
    sets: Number(r.sets ?? 0),
  }));

  await setStatsCache({ userId, metric: "volume_series", params: cacheParams, payload: { series } });
  return { series };
}

// ─── Session Generation ───────────────────────────────────────────────────────

type PlanItem = {
  id: string;
  createdAt: Date;
  lastPerformedAt: string | null;
  [key: string]: unknown;
};

type LogItem = {
  id: string;
  planId: string | null;
  performedAt: string;
  sets: Array<{ exerciseName: string; reps: number | null; weightKg: number | null }>;
};

function resolveHighlightedPlan(plans: PlanItem[], logs: LogItem[], todayKey: string): PlanItem | null {
  if (plans.length === 0) return null;
  const todayLog = logs.find((l) => l.performedAt.slice(0, 10) === todayKey && l.planId) ?? null;
  if (todayLog?.planId) {
    const found = plans.find((p) => p.id === todayLog.planId);
    if (found) return found;
  }
  const withLastPerformed = plans.filter((p) => p.lastPerformedAt).sort((a, b) => {
    const aTime = new Date(a.lastPerformedAt as string).getTime();
    const bTime = new Date(b.lastPerformedAt as string).getTime();
    return bTime - aTime;
  });
  if (withLastPerformed[0]) return withLastPerformed[0];
  return [...plans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

async function generateTodaySnapshot(
  userId: string,
  plans: PlanItem[],
  logs: LogItem[],
  nowKey: string,
  timezone: string,
) {
  const highlighted = resolveHighlightedPlan(plans, logs, nowKey);
  if (!highlighted) return null;
  try {
    const res = await generateAndSaveSession({
      userId,
      planId: highlighted.id,
      sessionDate: nowKey,
      timezone,
    });
    return res?.snapshot ?? null;
  } catch {
    return null;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const timezone = normalizeTimezone(searchParams.get("timezone"));
    const nowKey = dateOnlyInTimezone(new Date(), timezone);

    const prRangeDays = 365;
    const to = new Date();
    const prFrom = new Date(to);
    prFrom.setDate(prFrom.getDate() - prRangeDays);

    // PERF: 4개 DB 쿼리 그룹을 병렬 실행 (서버→DB 지연 ~2ms, 총 ~10-30ms)
    const [plansResult, logsResult, prsResult, volResult] = await Promise.all([
      fetchPlans(userId),
      fetchLogs(userId, 40),
      fetchPrs(userId, prFrom, to, 4),
      fetchVolumeSeries(userId),
    ]);

    // PERF: 세션 생성은 highlightedPlan이 필요해 순차 실행하지만, 서버 내부 처리라 RTT 없음
    const snapshot = await generateTodaySnapshot(
      userId,
      plansResult.items as PlanItem[],
      logsResult.items as LogItem[],
      nowKey,
      timezone,
    );

    return NextResponse.json({
      plans: plansResult.items,
      logs: logsResult.items,
      prs: prsResult.items,
      volumeSeries: volResult.series,
      snapshot,
    });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = withApiLogging(GETImpl);
