import { and, asc, eq, gt, inArray, or } from "drizzle-orm";
import {
  plan as planTable,
  planProgressEvent,
  planRuntimeState,
  programTemplate,
  programVersion,
  workoutLog,
  workoutSet,
} from "@/server/db/schema";
import {
  LoggedSetInput,
  ProgressionProgram,
  readIncrementOverride,
  reduceProgressionState,
  resolveAutoProgressionProgram,
  rulesFor,
} from "./reducer";

const AUTO_PROGRESSION_ENGINE_VERSION = 1;

export type ProgressionOverride = "hold" | "increase" | "reset";

type ApplyAutoProgressionInput = {
  tx: any;
  userId: string;
  planId: string | null | undefined;
  logId: string;
  sets: unknown[];
  mode?: "upsert" | "replay";
  progressionOverride?: ProgressionOverride | null;
  progressionTargetOverridesKg?: Record<string, number> | null;
};

function snapTo2p5(value: number) {
  return Math.max(0, Math.round(value / 2.5) * 2.5);
}

function readOverrideWorkKg(
  overrides: Record<string, number> | null | undefined,
  key: string,
  target: string,
): number | null {
  if (!overrides) return null;
  const byKey = overrides[key];
  if (typeof byKey === "number" && Number.isFinite(byKey) && byKey >= 0) return snapTo2p5(byKey);
  const byTarget = overrides[target];
  if (typeof byTarget === "number" && Number.isFinite(byTarget) && byTarget >= 0) return snapTo2p5(byTarget);
  return null;
}

type ResolvedAutoProgressionContext =
  | {
      ok: true;
      planId: string;
      userId: string;
      params: Record<string, unknown>;
      templateSlug: string;
      progressionProgram: ProgressionProgram;
    }
  | {
      ok: false;
      reason:
        | "skip:no-plan"
        | "skip:forbidden-plan"
        | "skip:disabled"
        | "skip:no-root-program"
        | "skip:version-missing"
        | "skip:template-missing"
        | "skip:unsupported-program";
    };

function toLoggedSetRows(sets: unknown[]): LoggedSetInput[] {
  const out: LoggedSetInput[] = [];
  for (const raw of sets) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const exerciseName = String(item.exerciseName ?? "").trim();
    if (!exerciseName) continue;
    out.push({
      exerciseName,
      reps: typeof item.reps === "number" ? item.reps : Number(item.reps ?? 0),
      weightKg:
        typeof item.weightKg === "number" ? item.weightKg : Number(item.weightKg ?? 0),
      isExtra: Boolean(item.isExtra ?? false),
      meta: (item.meta ?? {}) as Record<string, unknown>,
    });
  }
  return out;
}

async function resolveAutoProgressionContext(input: {
  tx: any;
  userId: string;
  planId: string | null | undefined;
}): Promise<ResolvedAutoProgressionContext> {
  const planId = input.planId?.trim();
  if (!planId) return { ok: false, reason: "skip:no-plan" };

  const planRows = await input.tx
    .select({
      id: planTable.id,
      userId: planTable.userId,
      params: planTable.params,
      rootProgramVersionId: planTable.rootProgramVersionId,
    })
    .from(planTable)
    .where(eq(planTable.id, planId))
    .limit(1);
  const plan = planRows[0];
  if (!plan || plan.userId !== input.userId) {
    return { ok: false, reason: "skip:forbidden-plan" };
  }

  const params = (plan.params ?? {}) as Record<string, unknown>;
  if (params.autoProgression !== true) return { ok: false, reason: "skip:disabled" };
  if (!plan.rootProgramVersionId) return { ok: false, reason: "skip:no-root-program" };

  const versionRows = await input.tx
    .select({
      id: programVersion.id,
      templateId: programVersion.templateId,
      definition: programVersion.definition,
    })
    .from(programVersion)
    .where(eq(programVersion.id, plan.rootProgramVersionId))
    .limit(1);
  const version = versionRows[0];
  if (!version) return { ok: false, reason: "skip:version-missing" };

  const templateRows = await input.tx
    .select({
      id: programTemplate.id,
      slug: programTemplate.slug,
    })
    .from(programTemplate)
    .where(eq(programTemplate.id, version.templateId))
    .limit(1);
  const template = templateRows[0];
  if (!template) return { ok: false, reason: "skip:template-missing" };

  const progressionProgram = resolveAutoProgressionProgram(template.slug, version.definition);
  if (!progressionProgram) return { ok: false, reason: "skip:unsupported-program" };

  return {
    ok: true,
    planId,
    userId: input.userId,
    params,
    templateSlug: template.slug,
    progressionProgram,
  };
}

async function upsertAutoProgressionRuntimeState(input: {
  tx: any;
  planId: string;
  userId: string;
  nextState: unknown;
}) {
  await input.tx
    .insert(planRuntimeState)
    .values({
      planId: input.planId,
      userId: input.userId,
      engineVersion: AUTO_PROGRESSION_ENGINE_VERSION,
      state: input.nextState,
    })
    .onConflictDoUpdate({
      target: planRuntimeState.planId,
      set: {
        userId: input.userId,
        engineVersion: AUTO_PROGRESSION_ENGINE_VERSION,
        state: input.nextState,
        updatedAt: new Date(),
      },
    });
}

function toProgressionEventMeta(reduced: ReturnType<typeof reduceProgressionState>) {
  return {
    didAdvanceSession: reduced.didAdvanceSession,
    targetDecisions: reduced.targetDecisions,
    outcomes: reduced.outcomes,
    engineVersion: AUTO_PROGRESSION_ENGINE_VERSION,
  };
}

export async function applyAutoProgressionFromLog(input: ApplyAutoProgressionInput) {
  const mode = input.mode ?? "upsert";
  const context = await resolveAutoProgressionContext({
    tx: input.tx,
    userId: input.userId,
    planId: input.planId,
  });
  if (!context.ok) return { applied: false, reason: context.reason };
  const resolved = context;

  const logRows = await input.tx
    .select({
      id: workoutLog.id,
      performedAt: workoutLog.performedAt,
    })
    .from(workoutLog)
    .where(eq(workoutLog.id, input.logId))
    .limit(1);
  const currentLog = logRows[0];
  if (!currentLog) return { applied: false, reason: "skip:log-missing" as const };

  async function applySingleFromState(beforeState: Record<string, unknown>) {
    const reduced = reduceProgressionState({
      program: resolved.progressionProgram,
      previousState: beforeState,
      planParams: resolved.params,
      sets: toLoggedSetRows(input.sets),
      logId: input.logId,
    });

    let finalNextState = reduced.nextState;
    let finalEventType = reduced.eventType;
    let finalReason = reduced.reason;

    const sessionKeys = new Set(Object.keys(reduced.outcomes));
    const prevWeek = Number((beforeState.week as number | undefined) ?? 1);
    const prevDay = Number((beforeState.day as number | undefined) ?? 1);
    const isOperatorBlockEnd = resolved.progressionProgram === "operator" && prevWeek === 6 && prevDay === 3;
    const is531BlockEnd = resolved.progressionProgram === "wendler-531" && prevWeek === 4 && prevDay === 4;
    const isAsymptoteBlockEnd = resolved.progressionProgram === "asymptote" && prevWeek === 4 && prevDay === 3;
    const shouldApplyOverrideToAllTargets = isOperatorBlockEnd || is531BlockEnd || isAsymptoteBlockEnd;
    const prevTargets = ((beforeState as Record<string, unknown>).targets ?? {}) as Record<string, Record<string, unknown>>;

    // 사용자가 sheet에서 직접 조정한 타겟별 절대 workKg.
    // 있으면 protocol 기본값 대신 그 값을 사용 — 없는 타겟은 기본값으로 fallback.
    const userOverrides = input.progressionTargetOverridesKg ?? null;

    if (input.progressionOverride === "hold") {
      const nextTargets = { ...reduced.nextState.targets };
      for (const key of Object.keys(nextTargets)) {
        const target = nextTargets[key];
        if (!target) continue;
        const prev = prevTargets[key];
        const baseKg = prev ? Number(prev.workKg ?? 0) : target.workKg;
        const overrideKg = readOverrideWorkKg(userOverrides, key, target.progressionTarget);
        nextTargets[key] = {
          ...target,
          workKg: overrideKg ?? snapTo2p5(baseKg),
          successStreak: 0,
          failureStreak: 0,
        };
      }
      finalNextState = { ...reduced.nextState, targets: nextTargets };
      finalEventType = "HOLD";
      finalReason = "override:hold";
    } else if (input.progressionOverride === "increase") {
      // 이전 상태(prevTargets) 기준으로 증량 적용 — 자동 증량 중복 방지
      const nextTargets = { ...reduced.nextState.targets };
      const keysToApply = shouldApplyOverrideToAllTargets ? Object.keys(nextTargets) : Array.from(sessionKeys);
      for (const key of keysToApply) {
        const target = nextTargets[key];
        if (!target) continue;
        const prev = prevTargets[key];
        const baseKg = prev ? Number(prev.workKg ?? 0) : target.workKg;
        const overrideKg = readOverrideWorkKg(userOverrides, key, target.progressionTarget);
        let resolvedWorkKg: number;
        if (overrideKg !== null) {
          resolvedWorkKg = overrideKg;
        } else {
          const { increaseKg } = rulesFor(
            resolved.progressionProgram,
            target.progressionTarget,
            readIncrementOverride(resolved.params, key, target.progressionTarget),
          );
          resolvedWorkKg = snapTo2p5(baseKg + increaseKg);
        }
        nextTargets[key] = {
          ...target,
          workKg: resolvedWorkKg,
          successStreak: 0,
          failureStreak: 0,
        };
      }
      finalNextState = { ...reduced.nextState, targets: nextTargets };
      finalEventType = "INCREASE";
      finalReason = "override:increase";
    } else if (input.progressionOverride === "reset") {
      // 이전 상태(prevTargets) 기준으로 감소 적용
      const nextTargets = { ...reduced.nextState.targets };
      const keysToApply = shouldApplyOverrideToAllTargets ? Object.keys(nextTargets) : Array.from(sessionKeys);
      for (const key of keysToApply) {
        const target = nextTargets[key];
        if (!target) continue;
        const prev = prevTargets[key];
        const baseKg = prev ? Number(prev.workKg ?? 0) : target.workKg;
        const overrideKg = readOverrideWorkKg(userOverrides, key, target.progressionTarget);
        let resolvedWorkKg: number;
        if (overrideKg !== null) {
          resolvedWorkKg = overrideKg;
        } else {
          const rule = rulesFor(
            resolved.progressionProgram,
            target.progressionTarget,
            readIncrementOverride(resolved.params, key, target.progressionTarget),
          );
          const computedKg =
            rule.decreaseKg !== null
              ? baseKg - rule.decreaseKg
              : baseKg * rule.resetFactor;
          resolvedWorkKg = snapTo2p5(computedKg);
        }
        nextTargets[key] = {
          ...target,
          workKg: resolvedWorkKg,
          successStreak: 0,
          failureStreak: 0,
        };
      }
      finalNextState = { ...reduced.nextState, targets: nextTargets };
      finalEventType = "RESET";
      finalReason = "override:reset";
    }

    await input.tx.insert(planProgressEvent).values({
      planId: resolved.planId,
      logId: input.logId,
      userId: input.userId,
      eventType: finalEventType,
      programSlug: resolved.templateSlug,
      reason: finalReason,
      beforeState,
      afterState: finalNextState,
      meta: {
        ...toProgressionEventMeta(reduced),
        ...(input.progressionOverride ? { override: input.progressionOverride } : {}),
        ...(input.progressionTargetOverridesKg && Object.keys(input.progressionTargetOverridesKg).length > 0
          ? { targetOverridesKg: input.progressionTargetOverridesKg }
          : {}),
      },
    });
    await upsertAutoProgressionRuntimeState({
      tx: input.tx,
      planId: resolved.planId,
      userId: input.userId,
      nextState: finalNextState,
    });
    return { ...reduced, nextState: finalNextState, eventType: finalEventType, reason: finalReason };
  }

  const existingEventRows = await input.tx
    .select({
      id: planProgressEvent.id,
      beforeState: planProgressEvent.beforeState,
      afterState: planProgressEvent.afterState,
    })
    .from(planProgressEvent)
    .where(
      and(
        eq(planProgressEvent.planId, resolved.planId),
        eq(planProgressEvent.logId, input.logId),
        eq(planProgressEvent.programSlug, resolved.templateSlug),
      ),
    )
    .limit(1);
  const existingEvent = existingEventRows[0] ?? null;

  if (mode !== "replay") {
    if (existingEvent) return { applied: false, reason: "skip:already-applied" as const };

    const runtimeRows = await input.tx
      .select({
        id: planRuntimeState.id,
        state: planRuntimeState.state,
      })
      .from(planRuntimeState)
      .where(eq(planRuntimeState.planId, resolved.planId))
      .limit(1);
    const runtime = runtimeRows[0] ?? null;
    const beforeState = (runtime?.state ?? {}) as Record<string, unknown>;
    const reduced = await applySingleFromState(beforeState);
    return {
      applied: true,
      reason: reduced.reason,
      eventType: reduced.eventType,
      programSlug: resolved.templateSlug,
    };
  }

  if (!existingEvent) {
    const runtimeRows = await input.tx
      .select({
        id: planRuntimeState.id,
        state: planRuntimeState.state,
      })
      .from(planRuntimeState)
      .where(eq(planRuntimeState.planId, resolved.planId))
      .limit(1);
    const runtime = runtimeRows[0] ?? null;
    const beforeState = (runtime?.state ?? {}) as Record<string, unknown>;
    const reduced = await applySingleFromState(beforeState);
    return {
      applied: true,
      reason: reduced.reason,
      eventType: reduced.eventType,
      programSlug: resolved.templateSlug,
    };
  }

  const replayFirst = reduceProgressionState({
    program: resolved.progressionProgram,
    previousState: existingEvent.beforeState ?? {},
    planParams: resolved.params,
    sets: toLoggedSetRows(input.sets),
    logId: input.logId,
  });
  await input.tx
    .update(planProgressEvent)
    .set({
      eventType: replayFirst.eventType,
      reason: replayFirst.reason,
      beforeState: existingEvent.beforeState ?? {},
      afterState: replayFirst.nextState,
      meta: toProgressionEventMeta(replayFirst),
    })
    .where(eq(planProgressEvent.id, existingEvent.id));

  let runningState = replayFirst.nextState;
  const laterEventRows = await input.tx
    .select({
      eventId: planProgressEvent.id,
      logId: planProgressEvent.logId,
      performedAt: workoutLog.performedAt,
    })
    .from(planProgressEvent)
    .innerJoin(workoutLog, eq(planProgressEvent.logId, workoutLog.id))
    .where(
      and(
        eq(planProgressEvent.planId, resolved.planId),
        eq(planProgressEvent.programSlug, resolved.templateSlug),
        or(
          gt(workoutLog.performedAt, currentLog.performedAt),
          and(eq(workoutLog.performedAt, currentLog.performedAt), gt(workoutLog.id, currentLog.id)),
        ),
      ),
    )
    .orderBy(asc(workoutLog.performedAt), asc(workoutLog.id));

  for (const row of laterEventRows) {
    const logId = row.logId;
    if (!logId) continue;

    const laterSets = await input.tx
      .select({
        exerciseName: workoutSet.exerciseName,
        reps: workoutSet.reps,
        weightKg: workoutSet.weightKg,
        isExtra: workoutSet.isExtra,
        meta: workoutSet.meta,
      })
      .from(workoutSet)
      .where(eq(workoutSet.logId, logId))
      .orderBy(asc(workoutSet.sortOrder), asc(workoutSet.setNumber), asc(workoutSet.id));

    const reduced = reduceProgressionState({
      program: resolved.progressionProgram,
      previousState: runningState,
      planParams: resolved.params,
      sets: toLoggedSetRows(laterSets),
      logId,
    });

    const beforeReplayState = runningState;
    runningState = reduced.nextState;
    await input.tx
      .update(planProgressEvent)
      .set({
        eventType: reduced.eventType,
        reason: reduced.reason,
        beforeState: beforeReplayState,
        afterState: runningState,
        meta: toProgressionEventMeta(reduced),
      })
      .where(eq(planProgressEvent.id, row.eventId));
  }

  await upsertAutoProgressionRuntimeState({
    tx: input.tx,
    planId: resolved.planId,
    userId: input.userId,
    nextState: runningState,
  });
  return {
    applied: true,
    reason: "replay:updated",
    eventType: replayFirst.eventType,
    programSlug: resolved.templateSlug,
  };
}

export async function rebuildAutoProgressionForPlan(input: {
  tx: any;
  userId: string;
  planId: string | null | undefined;
}) {
  const context = await resolveAutoProgressionContext(input);
  if (!context.ok) return { applied: false, reason: context.reason };
  const resolved = context;

  const remainingLogs = await input.tx
    .select({
      id: workoutLog.id,
      performedAt: workoutLog.performedAt,
    })
    .from(workoutLog)
    .where(eq(workoutLog.planId, resolved.planId))
    .orderBy(asc(workoutLog.performedAt), asc(workoutLog.id));

  await input.tx.delete(planProgressEvent).where(eq(planProgressEvent.planId, resolved.planId));

  if (remainingLogs.length === 0) {
    await input.tx.delete(planRuntimeState).where(eq(planRuntimeState.planId, resolved.planId));
    return {
      applied: true,
      reason: "rebuild:cleared" as const,
      programSlug: resolved.templateSlug,
      rebuiltLogCount: 0,
    };
  }

  const logIds = remainingLogs.map((log: { id: string }) => log.id);
  const setRows = await input.tx
    .select({
      logId: workoutSet.logId,
      exerciseName: workoutSet.exerciseName,
      reps: workoutSet.reps,
      weightKg: workoutSet.weightKg,
      isExtra: workoutSet.isExtra,
      meta: workoutSet.meta,
      sortOrder: workoutSet.sortOrder,
      setNumber: workoutSet.setNumber,
      id: workoutSet.id,
    })
    .from(workoutSet)
    .where(inArray(workoutSet.logId, logIds))
    .orderBy(asc(workoutSet.logId), asc(workoutSet.sortOrder), asc(workoutSet.setNumber), asc(workoutSet.id));

  const setsByLogId = new Map<string, typeof setRows>();
  for (const row of setRows) {
    const list = setsByLogId.get(row.logId) ?? [];
    list.push(row);
    setsByLogId.set(row.logId, list);
  }

  let runningState: Record<string, unknown> = {};
  for (const log of remainingLogs) {
    const reduced = reduceProgressionState({
      program: resolved.progressionProgram,
      previousState: runningState,
      planParams: resolved.params,
      sets: toLoggedSetRows(setsByLogId.get(log.id) ?? []),
      logId: log.id,
    });

    await input.tx.insert(planProgressEvent).values({
      planId: resolved.planId,
      logId: log.id,
      userId: input.userId,
      eventType: reduced.eventType,
      programSlug: resolved.templateSlug,
      reason: reduced.reason,
      beforeState: runningState,
      afterState: reduced.nextState,
      meta: toProgressionEventMeta(reduced),
    });

    runningState = reduced.nextState;
  }

  await upsertAutoProgressionRuntimeState({
    tx: input.tx,
    planId: resolved.planId,
    userId: input.userId,
    nextState: runningState,
  });

  return {
    applied: true,
    reason: "rebuild:updated" as const,
    programSlug: resolved.templateSlug,
    rebuiltLogCount: remainingLogs.length,
  };
}
