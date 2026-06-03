import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import {
  generatedSession,
  plan as planTable,
  planModule,
  planProgressEvent,
  planRuntimeState,
  programTemplate,
  programVersion,
  workoutLog,
} from "@/server/db/schema";
import { requireAuthenticatedUserId } from "@/server/auth/user";
import { buildSessionKey } from "@/lib/session-key";
import { resolveRequestLocale } from "@/lib/i18n/messages";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { previewSessionExercises } from "@/server/program-engine/generateSession";

type Ctx = { params: Promise<{ planId: string }> };

type ProgressionTarget = "SQUAT" | "BENCH" | "DEADLIFT" | "OHP" | "PULL";

const PROGRESSION_TARGET_SET = new Set<ProgressionTarget>([
  "SQUAT",
  "BENCH",
  "DEADLIFT",
  "OHP",
  "PULL",
]);

const TARGET_LABELS: Record<ProgressionTarget, { ko: string; en: string }> = {
  SQUAT: { ko: "스쿼트", en: "Back Squat" },
  BENCH: { ko: "벤치 프레스", en: "Bench Press" },
  DEADLIFT: { ko: "데드리프트", en: "Deadlift" },
  OHP: { ko: "오버헤드 프레스", en: "Overhead Press" },
  PULL: { ko: "풀업", en: "Pull-Up" },
};

export type CycleOverviewSessionStatus = "DONE" | "TODAY" | "PLANNED";

export type CycleOverviewTarget = {
  progressionTarget: ProgressionTarget;
  label: string;
  weightKg: number | null;
  lastDeltaKg: number | null;
  lastEventType: "INCREASE" | "HOLD" | "RESET" | null;
};

export type CycleOverviewSessionSet = {
  reps: number | null;
  weightKg: number | null;
  percent: number | null;
  rpe: number | null;
  note: string | null;
};

export type CycleOverviewSessionExercise = {
  exerciseName: string;
  role: "MAIN" | "ASSIST";
  progressionTarget: ProgressionTarget | null;
  sets: CycleOverviewSessionSet[];
};

export type CycleOverviewSession = {
  week: number;
  day: number;
  sessionKey: string;
  status: CycleOverviewSessionStatus;
  sessionDate: string | null;
  logId: string | null;
  exercises: CycleOverviewSessionExercise[];
};

export type CycleOverviewResponse = {
  programName: string;
  programSlug: string | null;
  planType: "SINGLE" | "COMPOSITE" | "MANUAL";
  autoProgression: boolean;
  cycleNumber: number;
  totalWeeksInCycle: number | null;
  sessionsPerWeek: number | null;
  current: { week: number; day: number; sessionKey: string };
  targets: CycleOverviewTarget[];
  sessions: CycleOverviewSession[];
};

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const locale = await resolveRequestLocale();
    const localeKey = locale === "ko" ? "ko" : "en";
    const { planId } = await ctx.params;
    const userId = await requireAuthenticatedUserId();

    const planRows = await db
      .select({
        id: planTable.id,
        name: planTable.name,
        userId: planTable.userId,
        type: planTable.type,
        params: planTable.params,
        rootProgramVersionId: planTable.rootProgramVersionId,
      })
      .from(planTable)
      .where(eq(planTable.id, planId))
      .limit(1);
    const plan = planRows[0];

    if (!plan) {
      return NextResponse.json(
        { error: localeKey === "ko" ? "대상을 찾을 수 없습니다." : "Not found." },
        { status: 404 },
      );
    }
    if (plan.userId !== userId) {
      return NextResponse.json(
        { error: localeKey === "ko" ? "권한이 없습니다." : "Forbidden." },
        { status: 403 },
      );
    }

    const params = (plan.params ?? {}) as Record<string, unknown>;
    const autoProgression = params.autoProgression === true;

    const [runtimeRows, versionRows, moduleRows] = await Promise.all([
      db
        .select({ state: planRuntimeState.state })
        .from(planRuntimeState)
        .where(eq(planRuntimeState.planId, planId))
        .limit(1),
      plan.rootProgramVersionId
        ? db
            .select({
              version: programVersion,
              template: programTemplate,
            })
            .from(programVersion)
            .innerJoin(
              programTemplate,
              eq(programVersion.templateId, programTemplate.id),
            )
            .where(eq(programVersion.id, plan.rootProgramVersionId))
            .limit(1)
        : Promise.resolve([] as Array<{
            version: typeof programVersion.$inferSelect;
            template: typeof programTemplate.$inferSelect;
          }>),
      plan.type === "COMPOSITE"
        ? db
            .select({
              module: planModule,
              version: programVersion,
              template: programTemplate,
            })
            .from(planModule)
            .innerJoin(
              programVersion,
              eq(planModule.programVersionId, programVersion.id),
            )
            .innerJoin(
              programTemplate,
              eq(programVersion.templateId, programTemplate.id),
            )
            .where(eq(planModule.planId, planId))
        : Promise.resolve([] as Array<{
            module: typeof planModule.$inferSelect;
            version: typeof programVersion.$inferSelect;
            template: typeof programTemplate.$inferSelect;
          }>),
    ]);

    const runtimeState = (runtimeRows[0]?.state ?? null) as Record<
      string,
      unknown
    > | null;
    const programRow = versionRows[0] ?? null;
    const definition = programRow?.version.definition ?? null;
    const programName = programRow?.template.name ?? plan.name;
    const programSlug = programRow?.template.slug ?? null;

    const previewModules = moduleRows
      .slice()
      .sort((a, b) => (a.module.priority ?? 0) - (b.module.priority ?? 0))
      .map((row) => ({
        target: row.module.target,
        params: row.module.params,
        version: {
          definition: row.version.definition,
          defaults: row.version.defaults,
        },
        templateSlug: row.template.slug,
      }));
    const previewRootVersion = programRow
      ? {
          definition: programRow.version.definition,
          defaults: programRow.version.defaults,
        }
      : null;

    const totalWeeksInCycle = totalWeeksFromDefinition(definition);
    const sessionsPerWeek = sessionsPerWeekFromParams(params);

    const cycleNumber = clampPositiveInt(runtimeState?.cycle, 1);
    const currentWeek = clampPositiveInt(runtimeState?.week, 1);
    const currentDay = clampPositiveInt(runtimeState?.day, 1);
    const sessionKeyMode = String(params?.sessionKeyMode ?? "").toUpperCase();
    const startDate = extractStartDate(params);

    const currentSessionKey = buildSessionKey({
      mode: sessionKeyMode,
      sessionDate: startDate ?? todayKey(),
      cycle: cycleNumber,
      week: currentWeek,
      day: currentDay,
      autoProgression,
    });

    const targets = buildTargetChips(runtimeState, localeKey);

    if (targets.length > 0) {
      const recentEvents = await db
        .select({
          eventType: planProgressEvent.eventType,
          meta: planProgressEvent.meta,
          createdAt: planProgressEvent.createdAt,
        })
        .from(planProgressEvent)
        .where(eq(planProgressEvent.planId, planId))
        .orderBy(desc(planProgressEvent.createdAt))
        .limit(20);

      const seenTargets = new Set<ProgressionTarget>();
      for (const event of recentEvents) {
        const decisions = (event.meta as Record<string, unknown> | null)
          ?.targetDecisions;
        if (!Array.isArray(decisions)) continue;
        for (const decision of decisions) {
          if (!decision || typeof decision !== "object") continue;
          const d = decision as Record<string, unknown>;
          const t = String(d.progressionTarget ?? "").toUpperCase();
          if (!isProgressionTarget(t)) continue;
          if (seenTargets.has(t)) continue;
          const chip = targets.find((x) => x.progressionTarget === t);
          if (!chip) continue;
          const eventType = String(d.eventType ?? "").toUpperCase();
          if (
            eventType !== "INCREASE" &&
            eventType !== "HOLD" &&
            eventType !== "RESET"
          ) {
            continue;
          }
          const before = d.before as Record<string, unknown> | undefined;
          const after = d.after as Record<string, unknown> | undefined;
          const beforeKg = Number(before?.workKg);
          const afterKg = Number(after?.workKg);
          if (Number.isFinite(beforeKg) && Number.isFinite(afterKg)) {
            chip.lastDeltaKg = roundDelta(afterKg - beforeKg);
          }
          chip.lastEventType = eventType;
          seenTargets.add(t);
        }
        if (seenTargets.size >= targets.length) break;
      }
    }

    const sessions: CycleOverviewSession[] = [];
    const candidateKeys: string[] = [];

    if (totalWeeksInCycle && sessionsPerWeek) {
      for (let w = 1; w <= totalWeeksInCycle; w++) {
        for (let d = 1; d <= sessionsPerWeek; d++) {
          const idxInCycle = (w - 1) * sessionsPerWeek + (d - 1);
          const sessionDate =
            cycleNumber === 1 && startDate
              ? addDaysISO(startDate, idxInCycle)
              : null;
          const sk = buildSessionKey({
            mode: sessionKeyMode,
            sessionDate: sessionDate ?? todayKey(),
            cycle: cycleNumber,
            week: w,
            day: d,
            autoProgression,
          });
          candidateKeys.push(sk);
          const isToday = w === currentWeek && d === currentDay;
          const isBefore =
            w < currentWeek || (w === currentWeek && d < currentDay);

          let previewExercises: CycleOverviewSessionExercise[] = [];
          try {
            const planned = previewSessionExercises({
              planType: plan.type as
                | "SINGLE"
                | "COMPOSITE"
                | "MANUAL",
              planParams: params,
              runtimeState,
              rootVersion: previewRootVersion,
              rootTemplateSlug: programSlug,
              modules: previewModules,
              week: w,
              day: d,
            });
            previewExercises = planned.map((ex) => ({
              exerciseName: ex.exerciseName,
              role: ex.role,
              progressionTarget: ex.progressionTarget ?? null,
              sets: ex.sets.map((s) => ({
                reps: s.reps ?? null,
                weightKg: s.targetWeightKg ?? null,
                percent: s.percent ?? null,
                rpe: s.rpe ?? null,
                note: s.note ?? null,
              })),
            }));
          } catch {
            previewExercises = [];
          }

          sessions.push({
            week: w,
            day: d,
            sessionKey: sk,
            status: isToday ? "TODAY" : isBefore ? "DONE" : "PLANNED",
            sessionDate,
            logId: null,
            exercises: previewExercises,
          });
        }
      }

      if (candidateKeys.length > 0) {
        const generatedRows = await db
          .select({
            id: generatedSession.id,
            sessionKey: generatedSession.sessionKey,
          })
          .from(generatedSession)
          .where(
            and(
              eq(generatedSession.planId, planId),
              inArray(generatedSession.sessionKey, candidateKeys),
            ),
          );
        const sessionIdByKey = new Map(
          generatedRows.map((r) => [r.sessionKey, r.id]),
        );
        const sessionIds = generatedRows.map((r) => r.id);
        const logRows =
          sessionIds.length > 0
            ? await db
                .select({
                  id: workoutLog.id,
                  generatedSessionId: workoutLog.generatedSessionId,
                })
                .from(workoutLog)
                .where(
                  and(
                    eq(workoutLog.userId, userId),
                    eq(workoutLog.planId, planId),
                    inArray(workoutLog.generatedSessionId, sessionIds),
                  ),
                )
            : [];
        const logByGenId = new Map(
          logRows
            .filter((r): r is { id: string; generatedSessionId: string } =>
              Boolean(r.generatedSessionId),
            )
            .map((r) => [r.generatedSessionId, r.id]),
        );
        for (const s of sessions) {
          const genId = sessionIdByKey.get(s.sessionKey);
          if (!genId) continue;
          const logId = logByGenId.get(genId);
          if (logId) {
            s.logId = logId;
            if (s.status !== "TODAY") s.status = "DONE";
          }
        }
      }
    }

    const response: CycleOverviewResponse = {
      programName,
      programSlug,
      planType: plan.type as CycleOverviewResponse["planType"],
      autoProgression,
      cycleNumber,
      totalWeeksInCycle,
      sessionsPerWeek,
      current: {
        week: currentWeek,
        day: currentDay,
        sessionKey: currentSessionKey,
      },
      targets,
      sessions,
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error("[cycle-overview] error", e);
    return apiErrorResponse(e);
  }
}

function totalWeeksFromDefinition(definition: unknown): number | null {
  if (!definition || typeof definition !== "object") return null;
  const def = definition as Record<string, unknown>;
  const schedule = def.schedule as Record<string, unknown> | undefined;
  const weeksFromSchedule = Number(schedule?.weeks);
  if (Number.isFinite(weeksFromSchedule) && weeksFromSchedule > 0) {
    return Math.floor(weeksFromSchedule);
  }
  const kind = String(def.kind ?? "").toLowerCase();
  if (kind === "531") return 4;
  if (kind === "operator") return 6;
  if (kind === "candito-linear") return 6;
  if (kind === "asymptote") return 4;
  const family = String(def.programFamily ?? "").toLowerCase();
  if (family === "operator" || def.operatorStyle === true) return 6;
  if (family === "wendler-531") return 4;
  if (family === "asymptote") return 4;
  return null;
}

function sessionsPerWeekFromParams(
  params: Record<string, unknown>,
): number | null {
  const schedule = params.schedule;
  if (Array.isArray(schedule) && schedule.length > 0) return schedule.length;
  const explicit = Number(params.sessionsPerWeek);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  return null;
}

function clampPositiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function extractStartDate(params: Record<string, unknown>): string | null {
  const sd = params?.startDate;
  if (typeof sd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sd)) return sd;
  return null;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(startDate: string, days: number): string {
  const d = new Date(`${startDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function roundDelta(value: number) {
  return Math.round(value * 100) / 100;
}

function isProgressionTarget(value: string): value is ProgressionTarget {
  return PROGRESSION_TARGET_SET.has(value as ProgressionTarget);
}

function buildTargetChips(
  runtimeState: Record<string, unknown> | null,
  localeKey: "ko" | "en",
): CycleOverviewTarget[] {
  const out: CycleOverviewTarget[] = [];
  const raw = (runtimeState?.targets ?? {}) as Record<string, unknown>;
  for (const value of Object.values(raw)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const t = String(v.progressionTarget ?? "").toUpperCase();
    if (!isProgressionTarget(t)) continue;
    if (out.some((x) => x.progressionTarget === t)) continue;
    const workKg = Number(v.workKg);
    out.push({
      progressionTarget: t,
      label: TARGET_LABELS[t][localeKey],
      weightKg: Number.isFinite(workKg) && workKg > 0 ? workKg : null,
      lastDeltaKg: null,
      lastEventType: null,
    });
  }
  return out;
}
