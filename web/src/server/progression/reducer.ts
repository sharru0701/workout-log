export type ProgressionProgram = "operator" | "greyskull-lp";

export type ProgressionEventType = "INCREASE" | "HOLD" | "RESET" | "ADVANCE_WEEK";

export type ProgressionTarget = "SQUAT" | "BENCH" | "DEADLIFT" | "OHP" | "PULL";

export type LoggedSetInput = {
  exerciseName: string;
  reps?: number | null;
  weightKg?: number | null;
  isExtra?: boolean;
  meta?: Record<string, unknown>;
};

export type TargetRuntimeState = {
  workKg: number;
  successStreak: number;
  failureStreak: number;
};

export type ProgressionRuntimeState = {
  cycle: number;
  week: number;
  day: number;
  targets: Record<string, TargetRuntimeState>;
  lastAppliedLogId: string | null;
};

type TargetOutcome = {
  total: number;
  successful: number;
  averageWeightKg: number | null;
};

export type TargetDecision = {
  target: string;
  outcome: "SUCCESS" | "FAIL";
  eventType: "INCREASE" | "HOLD" | "RESET";
  reason: string;
  before: TargetRuntimeState;
  after: TargetRuntimeState;
};

export type ReduceProgressionResult = {
  nextState: ProgressionRuntimeState;
  eventType: ProgressionEventType;
  reason: string;
  didAdvanceSession: boolean;
  targetDecisions: TargetDecision[];
  outcomes: Record<string, TargetOutcome>;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPositiveRounded2p5(value: number) {
  return Math.max(0, Math.round(value / 2.5) * 2.5);
}

function parsePlannedReps(meta: Record<string, unknown> | undefined) {
  const raw = (meta?.plannedRef as Record<string, unknown> | undefined)?.reps;
  const reps = toFiniteNumber(raw);
  return reps !== null && reps > 0 ? Math.floor(reps) : null;
}

function setWasCompleted(set: LoggedSetInput) {
  const meta = (set.meta ?? {}) as Record<string, unknown>;
  const completed = meta.completed;
  if (completed === true) return true;
  const reps = toFiniteNumber(set.reps);
  if (reps === null || reps <= 0) return false;
  const plannedReps = parsePlannedReps(meta);
  if (plannedReps === null) return true;
  return reps >= plannedReps;
}

function mapExerciseToTarget(exerciseName: string): ProgressionTarget | null {
  const normalized = String(exerciseName).trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes("squat")) return "SQUAT";
  if (normalized.includes("bench")) return "BENCH";
  if (normalized.includes("deadlift")) return "DEADLIFT";
  if (normalized.includes("overhead press") || normalized === "ohp" || normalized.includes("shoulder press")) {
    return "OHP";
  }
  if (
    normalized.includes("row") ||
    normalized.includes("pull-up") ||
    normalized.includes("pull up") ||
    normalized.includes("pulldown")
  ) {
    return "PULL";
  }
  return null;
}

function rulesFor(program: ProgressionProgram, target: string) {
  if (program === "operator") {
    return {
      increaseEverySuccesses: 3,
      failResetThreshold: 2,
      increaseKg: target === "DEADLIFT" ? 5 : 2.5,
      resetFactor: 0.95,
    };
  }

  return {
    increaseEverySuccesses: 1,
    failResetThreshold: 3,
    increaseKg: target === "DEADLIFT" ? 5 : 2.5,
    resetFactor: 0.9,
  };
}

function targetsFor(program: ProgressionProgram): ProgressionTarget[] {
  if (program === "operator") return ["SQUAT", "BENCH", "DEADLIFT"];
  return ["SQUAT", "BENCH", "OHP", "DEADLIFT", "PULL"];
}

function initTargetState(initialWorkKg: number): TargetRuntimeState {
  return {
    workKg: toPositiveRounded2p5(Math.max(0, initialWorkKg)),
    successStreak: 0,
    failureStreak: 0,
  };
}

function deriveInitialState(input: {
  previousState: unknown;
  planParams: unknown;
  outcomes: Map<string, TargetOutcome>;
  program: ProgressionProgram;
}): ProgressionRuntimeState {
  const prev = (input.previousState ?? {}) as Partial<ProgressionRuntimeState>;
  const params = (input.planParams ?? {}) as { trainingMaxKg?: Record<string, unknown> };
  const tm = params.trainingMaxKg ?? {};
  const targets = targetsFor(input.program);

  const baseTargets: Record<string, TargetRuntimeState> = {};
  for (const target of targets) {
    const prevTarget = (prev.targets ?? {})[target];
    if (prevTarget && typeof prevTarget === "object") {
      const workKg = toFiniteNumber((prevTarget as TargetRuntimeState).workKg) ?? 0;
      const successStreak = Math.max(0, Math.floor(toFiniteNumber((prevTarget as TargetRuntimeState).successStreak) ?? 0));
      const failureStreak = Math.max(0, Math.floor(toFiniteNumber((prevTarget as TargetRuntimeState).failureStreak) ?? 0));
      baseTargets[target] = { workKg: toPositiveRounded2p5(workKg), successStreak, failureStreak };
      continue;
    }

    const fromPlan = toFiniteNumber(tm[target]) ?? 0;
    const fromOutcome = input.outcomes.get(target)?.averageWeightKg ?? 0;
    baseTargets[target] = initTargetState(fromPlan > 0 ? fromPlan : fromOutcome);
  }

  const cycle = Math.max(1, Math.floor(toFiniteNumber(prev.cycle) ?? 1));
  const week = Math.max(1, Math.floor(toFiniteNumber(prev.week) ?? 1));
  const day = Math.max(1, Math.floor(toFiniteNumber(prev.day) ?? 1));

  return {
    cycle,
    week,
    day,
    targets: baseTargets,
    lastAppliedLogId: typeof prev.lastAppliedLogId === "string" ? prev.lastAppliedLogId : null,
  };
}

function summarizeEventType(decisions: TargetDecision[], didAdvanceSession: boolean): ProgressionEventType {
  if (decisions.some((decision) => decision.eventType === "RESET")) return "RESET";
  if (decisions.some((decision) => decision.eventType === "INCREASE")) return "INCREASE";
  if (didAdvanceSession) return "ADVANCE_WEEK";
  return "HOLD";
}

export function resolveAutoProgressionProgram(programSlug: string): ProgressionProgram | null {
  const slug = String(programSlug).trim().toLowerCase();
  if (slug === "operator") return "operator";
  if (slug === "greyskull-lp") return "greyskull-lp";
  return null;
}

export function extractTrainingMaxOverridesFromState(state: unknown): Record<string, number> {
  const runtime = (state ?? {}) as Partial<ProgressionRuntimeState>;
  const targets = runtime.targets ?? {};
  const out: Record<string, number> = {};

  for (const [target, targetState] of Object.entries(targets)) {
    const workKg = toFiniteNumber((targetState as TargetRuntimeState)?.workKg);
    if (workKg === null || workKg <= 0) continue;
    out[target] = toPositiveRounded2p5(workKg);
  }

  return out;
}

export function collectTargetOutcomes(sets: LoggedSetInput[]): Map<string, TargetOutcome> {
  const acc = new Map<
    string,
    { total: number; successful: number; weightSum: number; weightCount: number }
  >();

  for (const set of sets) {
    if (set.isExtra) continue;
    const target = mapExerciseToTarget(set.exerciseName);
    if (!target) continue;
    const outcome = acc.get(target) ?? { total: 0, successful: 0, weightSum: 0, weightCount: 0 };
    outcome.total += 1;
    if (setWasCompleted(set)) {
      outcome.successful += 1;
    }

    const weight = toFiniteNumber(set.weightKg);
    if (weight !== null && weight > 0) {
      outcome.weightSum += weight;
      outcome.weightCount += 1;
    }

    acc.set(target, outcome);
  }

  const out = new Map<string, TargetOutcome>();
  for (const [target, value] of acc.entries()) {
    out.set(target, {
      total: value.total,
      successful: value.successful,
      averageWeightKg:
        value.weightCount > 0 ? toPositiveRounded2p5(value.weightSum / value.weightCount) : null,
    });
  }
  return out;
}

export function reduceProgressionState(input: {
  program: ProgressionProgram;
  previousState: unknown;
  planParams: unknown;
  sets: LoggedSetInput[];
  logId: string;
}): ReduceProgressionResult {
  const outcomes = collectTargetOutcomes(input.sets);
  const state = deriveInitialState({
    previousState: input.previousState,
    planParams: input.planParams,
    outcomes,
    program: input.program,
  });
  const targets = targetsFor(input.program);
  const decisions: TargetDecision[] = [];

  for (const target of targets) {
    const before = state.targets[target] ?? initTargetState(0);
    const outcome = outcomes.get(target);
    if (!outcome || outcome.total < 1) continue;

    const success = outcome.successful === outcome.total;
    const next: TargetRuntimeState = { ...before };
    const rule = rulesFor(input.program, target);
    let eventType: "INCREASE" | "HOLD" | "RESET" = "HOLD";
    let reason = "hold:no-data";

    if (next.workKg <= 0 && (outcome.averageWeightKg ?? 0) > 0) {
      next.workKg = outcome.averageWeightKg ?? 0;
    }

    if (success) {
      next.successStreak += 1;
      next.failureStreak = 0;
      reason = "hold:success-streak";
      if (next.successStreak >= rule.increaseEverySuccesses) {
        next.workKg = toPositiveRounded2p5(next.workKg + rule.increaseKg);
        next.successStreak = 0;
        eventType = "INCREASE";
        reason = `increase:+${rule.increaseKg}kg`;
      }
    } else {
      next.failureStreak += 1;
      next.successStreak = 0;
      reason = "hold:failure-streak";
      if (next.failureStreak >= rule.failResetThreshold) {
        next.workKg = toPositiveRounded2p5(next.workKg * rule.resetFactor);
        next.failureStreak = 0;
        eventType = "RESET";
        reason = `reset:*${rule.resetFactor}`;
      }
    }

    state.targets[target] = next;
    decisions.push({
      target,
      outcome: success ? "SUCCESS" : "FAIL",
      eventType,
      reason,
      before,
      after: next,
    });
  }

  let didAdvanceSession = false;
  if (input.program === "operator") {
    const required = ["SQUAT", "BENCH", "DEADLIFT"];
    const available = required.filter((target) => outcomes.get(target)?.total);
    const allSuccess = available.length > 0 && available.every((target) => {
      const o = outcomes.get(target);
      return Boolean(o && o.successful === o.total);
    });
    if (allSuccess) {
      state.day += 1;
      if (state.day > 3) {
        state.day = 1;
        state.week += 1;
        if (state.week > 6) {
          state.week = 1;
          state.cycle += 1;
        }
      }
      didAdvanceSession = true;
    }
  }

  state.lastAppliedLogId = input.logId;

  const eventType = summarizeEventType(decisions, didAdvanceSession);
  const reason = didAdvanceSession ? "advance:session" : eventType.toLowerCase();
  const outcomeObject = Object.fromEntries(outcomes.entries());

  return {
    nextState: state,
    eventType,
    reason,
    didAdvanceSession,
    targetDecisions: decisions,
    outcomes: outcomeObject,
  };
}
