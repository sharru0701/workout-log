import { and, asc, eq, gt, or } from "drizzle-orm";
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
  reduceProgressionState,
  resolveAutoProgressionProgram,
} from "./reducer";

const AUTO_PROGRESSION_ENGINE_VERSION = 1;

type ApplyAutoProgressionInput = {
  tx: any;
  userId: string;
  planId: string | null | undefined;
  logId: string;
  sets: unknown[];
  mode?: "upsert" | "replay";
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

export async function applyAutoProgressionFromLog(input: ApplyAutoProgressionInput) {
  const mode = input.mode ?? "upsert";
  const planId = input.planId?.trim();
  if (!planId) return { applied: false, reason: "skip:no-plan" as const };

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
  if (!plan || plan.userId !== input.userId) return { applied: false, reason: "skip:forbidden-plan" as const };

  const params = (plan.params ?? {}) as Record<string, unknown>;
  if (params.autoProgression !== true) return { applied: false, reason: "skip:disabled" as const };
  if (!plan.rootProgramVersionId) return { applied: false, reason: "skip:no-root-program" as const };

  const versionRows = await input.tx
    .select({
      id: programVersion.id,
      templateId: programVersion.templateId,
    })
    .from(programVersion)
    .where(eq(programVersion.id, plan.rootProgramVersionId))
    .limit(1);
  const version = versionRows[0];
  if (!version) return { applied: false, reason: "skip:version-missing" as const };

  const templateRows = await input.tx
    .select({
      id: programTemplate.id,
      slug: programTemplate.slug,
    })
    .from(programTemplate)
    .where(eq(programTemplate.id, version.templateId))
    .limit(1);
  const template = templateRows[0];
  if (!template) return { applied: false, reason: "skip:template-missing" as const };

  const program = resolveAutoProgressionProgram(template.slug);
  if (!program) return { applied: false, reason: "skip:unsupported-program" as const };
  const progressionProgram = program;
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

  async function upsertRuntimeState(nextState: unknown) {
    await input.tx
      .insert(planRuntimeState)
      .values({
        planId,
        userId: input.userId,
        engineVersion: AUTO_PROGRESSION_ENGINE_VERSION,
        state: nextState,
      })
      .onConflictDoUpdate({
        target: planRuntimeState.planId,
        set: {
          userId: input.userId,
          engineVersion: AUTO_PROGRESSION_ENGINE_VERSION,
          state: nextState,
          updatedAt: new Date(),
        },
      });
  }

  function toEventMeta(reduced: ReturnType<typeof reduceProgressionState>) {
    return {
      didAdvanceSession: reduced.didAdvanceSession,
      targetDecisions: reduced.targetDecisions,
      outcomes: reduced.outcomes,
      engineVersion: AUTO_PROGRESSION_ENGINE_VERSION,
    };
  }

  async function applySingleFromState(beforeState: Record<string, unknown>) {
    const reduced = reduceProgressionState({
      program: progressionProgram,
      previousState: beforeState,
      planParams: params,
      sets: toLoggedSetRows(input.sets),
      logId: input.logId,
    });
    await input.tx.insert(planProgressEvent).values({
      planId,
      logId: input.logId,
      userId: input.userId,
      eventType: reduced.eventType,
      programSlug: template.slug,
      reason: reduced.reason,
      beforeState,
      afterState: reduced.nextState,
      meta: toEventMeta(reduced),
    });
    await upsertRuntimeState(reduced.nextState);
    return reduced;
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
        eq(planProgressEvent.planId, planId),
        eq(planProgressEvent.logId, input.logId),
        eq(planProgressEvent.programSlug, template.slug),
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
      .where(eq(planRuntimeState.planId, planId))
      .limit(1);
    const runtime = runtimeRows[0] ?? null;
    const beforeState = (runtime?.state ?? {}) as Record<string, unknown>;
    const reduced = await applySingleFromState(beforeState);
    return {
      applied: true,
      reason: reduced.reason,
      eventType: reduced.eventType,
      programSlug: template.slug,
    };
  }

  if (!existingEvent) {
    const runtimeRows = await input.tx
      .select({
        id: planRuntimeState.id,
        state: planRuntimeState.state,
      })
      .from(planRuntimeState)
      .where(eq(planRuntimeState.planId, planId))
      .limit(1);
    const runtime = runtimeRows[0] ?? null;
    const beforeState = (runtime?.state ?? {}) as Record<string, unknown>;
    const reduced = await applySingleFromState(beforeState);
    return {
      applied: true,
      reason: reduced.reason,
      eventType: reduced.eventType,
      programSlug: template.slug,
    };
  }

  const replayFirst = reduceProgressionState({
    program: progressionProgram,
    previousState: existingEvent.beforeState ?? {},
    planParams: params,
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
      meta: toEventMeta(replayFirst),
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
        eq(planProgressEvent.planId, planId),
        eq(planProgressEvent.programSlug, template.slug),
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
      program: progressionProgram,
      previousState: runningState,
      planParams: params,
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
        meta: toEventMeta(reduced),
      })
      .where(eq(planProgressEvent.id, row.eventId));
  }

  await upsertRuntimeState(runningState);
  return {
    applied: true,
    reason: "replay:updated",
    eventType: replayFirst.eventType,
    programSlug: template.slug,
  };
}
