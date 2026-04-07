import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { generatedSession, plan, planProgressEvent, workoutLog, workoutSet } from "@/server/db/schema";
import { getExerciseById, resolveExerciseByName } from "@/server/exercise/resolve";
import { applyAutoProgressionFromLog } from "@/server/progression/autoProgression";
import { buildProgressionSummary, readProgressEventByLog } from "@/server/progression/summary";
import { invalidateStatsCacheForUser } from "@/server/stats/cache";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { resolveRequestLocale } from "@/lib/i18n/messages";

type LogCursor = {
  performedAt: string;
  id: string;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeTimezone(raw: string | null) {
  const timezone = raw?.trim();
  if (!timezone) return "UTC";

  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

function dateOnlyInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function resolvePerformedAt(raw: unknown) {
  if (typeof raw !== "string" || !raw.trim()) {
    return new Date();
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseCursor(raw: string | null): LogCursor | null {
  if (!raw) return null;

  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as LogCursor;
    if (typeof decoded?.performedAt !== "string" || typeof decoded?.id !== "string") return null;
    return decoded;
  } catch {
    return null;
  }
}

function encodeCursor(cursor: LogCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function parseBooleanQueryParam(raw: string | null, defaultValue: boolean) {
  if (raw == null) return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  return defaultValue;
}

function buildLocalDateRangeFilter(dateFilter: string, timezone: string) {
  return sql`
    ${workoutLog.performedAt} >= (to_date(${dateFilter}, 'YYYY-MM-DD')::timestamp at time zone ${timezone})
    and ${workoutLog.performedAt} < ((to_date(${dateFilter}, 'YYYY-MM-DD') + interval '1 day')::timestamp at time zone ${timezone})
  `;
}

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const planId = searchParams.get("planId")?.trim() ?? "";
    const dateFilter = searchParams.get("date")?.trim() ?? "";
    const timezone = normalizeTimezone(searchParams.get("timezone"));
    const cursor = parseCursor(searchParams.get("cursor"));
    const includeSets = parseBooleanQueryParam(searchParams.get("includeSets"), true);
    const includeGeneratedSession = parseBooleanQueryParam(searchParams.get("includeGeneratedSession"), true);
    const includeProgression = parseBooleanQueryParam(searchParams.get("includeProgression"), true);
    const limitRaw = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 20;

    const filters: Array<any> = [eq(workoutLog.userId, userId)];

    if (planId) {
      filters.push(eq(workoutLog.planId, planId));
    }

    if (DATE_ONLY_PATTERN.test(dateFilter)) {
      filters.push(buildLocalDateRangeFilter(dateFilter, timezone));
    }

    if (cursor) {
      const cursorDate = new Date(cursor.performedAt);
      if (!Number.isNaN(cursorDate.getTime())) {
        filters.push(
          or(
            lt(workoutLog.performedAt, cursorDate),
            and(eq(workoutLog.performedAt, cursorDate), lt(workoutLog.id, cursor.id)),
          ),
        );
      }
    }

    const logs = await db
      .select({
        id: workoutLog.id,
        userId: workoutLog.userId,
        planId: workoutLog.planId,
        generatedSessionId: workoutLog.generatedSessionId,
        performedAt: workoutLog.performedAt,
        durationMinutes: workoutLog.durationMinutes,
        notes: workoutLog.notes,
        tags: workoutLog.tags,
        createdAt: workoutLog.createdAt,
      })
      .from(workoutLog)
      .where(and(...filters))
      .orderBy(desc(workoutLog.performedAt), desc(workoutLog.id))
      .limit(limit + 1);

    const hasMore = logs.length > limit;
    const pageLogs = hasMore ? logs.slice(0, limit) : logs;
    const logIds = pageLogs.map((l) => l.id);

    const generatedSessionIds = includeGeneratedSession
      ? Array.from(
          new Set(pageLogs.map((log) => log.generatedSessionId).filter((value): value is string => Boolean(value))),
        )
      : [];

    // PERF: 요청한 detail level에 맞춰 보조 쿼리를 선택적으로 실행
    const [sets, sessions, events] = await Promise.all([
      includeSets && logIds.length > 0
        ? db
            .select({
              id: workoutSet.id,
              logId: workoutSet.logId,
              exerciseId: workoutSet.exerciseId,
              exerciseName: workoutSet.exerciseName,
              sortOrder: workoutSet.sortOrder,
              setNumber: workoutSet.setNumber,
              reps: workoutSet.reps,
              weightKg: workoutSet.weightKg,
              rpe: workoutSet.rpe,
              isExtra: workoutSet.isExtra,
              meta: workoutSet.meta,
            })
            .from(workoutSet)
            .where(inArray(workoutSet.logId, logIds))
            .orderBy(asc(workoutSet.sortOrder), asc(workoutSet.setNumber), asc(workoutSet.id))
        : Promise.resolve([] as any[]),
      includeGeneratedSession && generatedSessionIds.length > 0
        ? db
            .select({
              id: generatedSession.id,
              sessionKey: generatedSession.sessionKey,
            })
            .from(generatedSession)
            .where(inArray(generatedSession.id, generatedSessionIds))
        : Promise.resolve([] as any[]),
      includeProgression && logIds.length > 0
        ? db
            .select({
              id: planProgressEvent.id,
              logId: planProgressEvent.logId,
              eventType: planProgressEvent.eventType,
              programSlug: planProgressEvent.programSlug,
              reason: planProgressEvent.reason,
              beforeState: planProgressEvent.beforeState,
              afterState: planProgressEvent.afterState,
              meta: planProgressEvent.meta,
              createdAt: planProgressEvent.createdAt,
            })
            .from(planProgressEvent)
            .where(inArray(planProgressEvent.logId, logIds))
            .orderBy(desc(planProgressEvent.createdAt), desc(planProgressEvent.id))
        : Promise.resolve([] as any[]),
    ]);

    const setsByLogId = new Map<string, Array<any>>();
    for (const s of sets) {
      const list = setsByLogId.get(s.logId) ?? [];
      list.push(s);
      setsByLogId.set(s.logId, list);
    }

    const generatedSessionsById = new Map<string, { id: string; sessionKey: string }>();
    for (const session of sessions) {
      generatedSessionsById.set(session.id, session);
    }

    const progressionSummaryByLogId = new Map<string, ReturnType<typeof buildProgressionSummary>>();
    for (const event of events) {
      if (!event.logId) continue;
      if (progressionSummaryByLogId.has(event.logId)) continue;
      progressionSummaryByLogId.set(
        event.logId,
        buildProgressionSummary({
          mode: "upsert",
          eventRow: event,
        }),
      );
    }

    const items = pageLogs.map((log) => ({
      ...log,
      sets: includeSets ? (setsByLogId.get(log.id) ?? []) : [],
      generatedSession: includeGeneratedSession && log.generatedSessionId
        ? (generatedSessionsById.get(log.generatedSessionId) ?? null)
        : null,
      progression: includeProgression ? (progressionSummaryByLogId.get(log.id) ?? null) : null,
    }));

    const last = pageLogs[pageLogs.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor({ performedAt: last.performedAt.toISOString(), id: last.id }) : null;

    return NextResponse.json({ items, nextCursor, limit });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

async function POSTImpl(req: Request) {
  try {
    const locale = await resolveRequestLocale();
    const body = await req.json();
    const userId = getAuthenticatedUserId();
    const timezone = normalizeTimezone(typeof body.timezone === "string" ? body.timezone : null);
    const performedAt = resolvePerformedAt(body.performedAt);

    const sets = Array.isArray(body.sets) ? body.sets : [];
    if (sets.length === 0) {
      return NextResponse.json({ error: locale === "ko" ? "세트 정보가 필요합니다." : "Sets are required." }, { status: 400 });
    }
    if (!performedAt) {
      return NextResponse.json({ error: locale === "ko" ? "performedAt은 올바른 날짜/시간이어야 합니다." : "performedAt must be a valid datetime." }, { status: 400 });
    }

    const submittedPlanId = typeof body.planId === "string" && body.planId.trim() ? body.planId.trim() : null;
    const submittedGeneratedSessionId =
      typeof body.generatedSessionId === "string" && body.generatedSessionId.trim()
        ? body.generatedSessionId.trim()
        : null;
    let effectivePlan:
      | {
          id: string;
          userId: string;
          params: unknown;
        }
      | null = null;

    // PERF: planId와 generatedSessionId 조회를 병렬로 실행
    const [planResult, sessionResult] = await Promise.all([
      submittedPlanId
        ? db.select({ id: plan.id, userId: plan.userId, params: plan.params }).from(plan).where(eq(plan.id, submittedPlanId)).limit(1)
        : Promise.resolve(null),
      submittedGeneratedSessionId
        ? db.select({ id: generatedSession.id, userId: generatedSession.userId, planId: generatedSession.planId }).from(generatedSession).where(eq(generatedSession.id, submittedGeneratedSessionId)).limit(1)
        : Promise.resolve(null),
    ]);

    if (submittedPlanId) {
      const p = planResult as Array<{ id: string; userId: string; params: unknown }> | null;
      if (!p?.[0]) return NextResponse.json({ error: locale === "ko" ? "플랜을 찾을 수 없습니다." : "Plan not found." }, { status: 404 });
      if (p[0].userId !== userId) return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });
      effectivePlan = p[0];
    }

    if (submittedGeneratedSessionId) {
      const s = sessionResult as Array<{ id: string; userId: string; planId: string }> | null;
      if (!s?.[0]) return NextResponse.json({ error: locale === "ko" ? "생성된 세션을 찾을 수 없습니다." : "Generated session not found." }, { status: 404 });
      if (s[0].userId !== userId) return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });
      if (submittedPlanId && s[0].planId !== submittedPlanId) {
        return NextResponse.json(
          { error: locale === "ko" ? "generatedSession이 전달된 planId에 속하지 않습니다." : "generatedSession does not belong to the provided planId." },
          { status: 400 },
        );
      }
      if (!effectivePlan && s[0].planId) {
        const p = await db
          .select({ id: plan.id, userId: plan.userId, params: plan.params })
          .from(plan)
          .where(eq(plan.id, s[0].planId))
          .limit(1);
        if (!p[0]) return NextResponse.json({ error: locale === "ko" ? "플랜을 찾을 수 없습니다." : "Plan not found." }, { status: 404 });
        if (p[0].userId !== userId) return NextResponse.json({ error: locale === "ko" ? "권한이 없습니다." : "Forbidden." }, { status: 403 });
        effectivePlan = p[0];
      }
    }

    if ((effectivePlan?.params as { autoProgression?: unknown } | null)?.autoProgression === true) {
      const performedDate = dateOnlyInTimezone(performedAt, timezone);
      const todayDate = dateOnlyInTimezone(new Date(), timezone);
      if (performedDate < todayDate) {
        return NextResponse.json(
          {
            error:
              locale === "ko"
                ? "자동 진행 플랜은 오늘 이전 날짜에 새 운동기록을 추가할 수 없습니다. 기존 기록을 수정해 주세요."
                : "Auto-progression plans cannot create new workout logs for dates before today. Edit the existing log instead.",
          },
          { status: 400 },
        );
      }
    }

    // PERF: exercise resolution을 트랜잭션 밖에서 미리 수행 → DB lock 시간 단축
    const resolvedByName = new Map<string, string | null>();
    const resolvedById = new Map<string, string | null>();

    const uniqueExerciseIds = Array.from(
      new Set(sets.map((s: any) => (typeof s.exerciseId === "string" && s.exerciseId.trim() ? s.exerciseId.trim() : null)).filter(Boolean) as string[]),
    );
    const uniqueExerciseNames: string[] = Array.from(
      new Set(
        sets
          .filter((s: any) => !(typeof s.exerciseId === "string" && s.exerciseId.trim()))
          .map((s: any) => String(s.exerciseName ?? "").trim().toLowerCase())
          .filter((n: string): n is string => n.length > 0),
      ),
    );

    await Promise.all([
      ...uniqueExerciseIds.map(async (id) => {
        const found = await getExerciseById(id);
        resolvedById.set(id, found?.id ?? null);
      }),
      ...uniqueExerciseNames.map(async (nameLower) => {
        const found = await resolveExerciseByName(nameLower);
        resolvedById.set(nameLower, found?.id ?? null);
        resolvedByName.set(nameLower, found?.id ?? null);
      }),
    ]);

    const created = await db.transaction(async (tx) => {
      const [log] = await tx
        .insert(workoutLog)
        .values({
          userId,
          planId: submittedPlanId,
          generatedSessionId: submittedGeneratedSessionId,
          performedAt,
          durationMinutes: body.durationMinutes ?? null,
          notes: body.notes ?? null,
          tags: body.tags ?? null,
        })
        .returning();

      await tx.insert(workoutSet).values(
        sets.map((s: any, idx: number) => {
          const exerciseName = String(s.exerciseName ?? "").trim();
          if (!exerciseName) {
            throw new Error("exerciseName is required for all sets");
          }

          const submittedExerciseId =
            typeof s.exerciseId === "string" && s.exerciseId.trim() ? s.exerciseId.trim() : null;

          let exerciseId: string | null = null;
          if (submittedExerciseId) {
            exerciseId = resolvedById.get(submittedExerciseId) ?? null;
          } else {
            exerciseId = resolvedByName.get(exerciseName.toLowerCase()) ?? null;
          }

          return {
            logId: log.id,
            exerciseId,
            exerciseName,
            sortOrder: s.sortOrder ?? idx,
            setNumber: s.setNumber ?? 1,
            reps: s.reps ?? null,
            weightKg: s.weightKg ?? null,
            rpe: s.rpe ?? null,
            isExtra: Boolean(s.isExtra ?? false),
            meta: s.meta ?? {},
          };
        }),
      );

      const progressionOverride =
        body.progressionOverride === "hold" || body.progressionOverride === "increase" || body.progressionOverride === "reset"
          ? body.progressionOverride
          : null;
      const progressionResult = await applyAutoProgressionFromLog({
        tx,
        userId,
        planId: submittedPlanId,
        logId: log.id,
        sets,
        progressionOverride,
      });
      const progressionEvent = await readProgressEventByLog({
        tx,
        planId: submittedPlanId,
        logId: log.id,
      });

      await invalidateStatsCacheForUser(userId, tx);

      return {
        log,
        progression: buildProgressionSummary({
          mode: "upsert",
          applyResult: progressionResult,
          eventRow: progressionEvent,
        }),
      };
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const GET = withApiLogging(GETImpl);

export const POST = withApiLogging(POSTImpl);
