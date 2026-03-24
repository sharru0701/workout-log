import { resolveLoggedTotalLoadKg } from "@/lib/bodyweight-load";

export type ProgressionProgram =
  | "operator"
  | "greyskull-lp"
  | "starting-strength-lp"
  | "stronglifts-5x5"
  | "texas-method"
  | "gzclp"
  | "wendler-531";

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
  progressionTarget: ProgressionTarget;
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
  progressionKey: string;
  progressionTarget: ProgressionTarget;
  displayTarget: string;
  total: number;
  successful: number;
  averageWeightKg: number | null;
};

export type TargetDecision = {
  key?: string;
  target: string;
  progressionTarget?: ProgressionTarget;
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

function parseProgressionTarget(value: unknown): ProgressionTarget | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "SQUAT" || normalized === "BENCH" || normalized === "DEADLIFT" || normalized === "OHP" || normalized === "PULL") {
    return normalized;
  }
  return null;
}

function readPlannedRef(meta: Record<string, unknown> | undefined) {
  const plannedRef = meta?.plannedRef;
  if (!plannedRef || typeof plannedRef !== "object" || Array.isArray(plannedRef)) return {};
  return plannedRef as Record<string, unknown>;
}

function progressionIdentityForSet(set: LoggedSetInput): {
  key: string;
  progressionTarget: ProgressionTarget;
  displayTarget: string;
} | null {
  const plannedRef = readPlannedRef(set.meta);
  const progressionTarget =
    parseProgressionTarget(plannedRef.progressionTarget) ??
    mapExerciseToTarget(set.exerciseName);
  if (!progressionTarget) return null;

  const keyRaw = String(plannedRef.progressionKey ?? "").trim();
  const displayRaw = String(plannedRef.progressionLabel ?? plannedRef.exerciseName ?? set.exerciseName ?? "").trim();

  return {
    key: keyRaw || progressionTarget,
    progressionTarget,
    displayTarget: displayRaw || progressionTarget,
  };
}

export function rulesFor(program: ProgressionProgram, target: string) {
  if (program === "operator") {
    return {
      increaseEverySuccesses: 3,
      failResetThreshold: 2,
      increaseKg: target === "DEADLIFT" ? 5 : 2.5,
      resetFactor: 0.95,
    };
  }

  if (program === "wendler-531") {
    // 짐 웬들러 5/3/1: 4주 사이클, 상체+2.5kg / 하체+5kg, 10% 감소 딜로드
    const increaseKg = target === "DEADLIFT" || target === "SQUAT" ? 5 : 2.5;
    return {
      increaseEverySuccesses: 1,
      failResetThreshold: 3,
      increaseKg,
      resetFactor: 0.9,
    };
  }

  if (program === "gzclp") {
    // T1 기준: 3회 연속 실패 시 15% 감소
    return {
      increaseEverySuccesses: 1,
      failResetThreshold: 3,
      increaseKg: target === "DEADLIFT" ? 5 : 2.5,
      resetFactor: 0.85,
    };
  }

  if (program === "texas-method") {
    // 주간 3세션(볼륨/회복/강도) 중 3회 연속 강도일 실패 시 10% 감소
    // increaseEverySuccesses: 3 = 3세션(1주) 연속 성공 시 증량
    return {
      increaseEverySuccesses: 3,
      failResetThreshold: 3,
      increaseKg: target === "DEADLIFT" ? 5 : 2.5,
      resetFactor: 0.9,
    };
  }

  // greyskull-lp, starting-strength-lp, stronglifts-5x5:
  // 매 세션 증량, 3회 연속 실패 시 10% 감소
  return {
    increaseEverySuccesses: 1,
    failResetThreshold: 3,
    increaseKg: target === "DEADLIFT" ? 5 : 2.5,
    resetFactor: 0.9,
  };
}

function targetsFor(program: ProgressionProgram): ProgressionTarget[] {
  if (program === "operator") return ["SQUAT", "BENCH", "DEADLIFT", "PULL"];
  if (program === "wendler-531") return ["SQUAT", "BENCH", "OHP", "DEADLIFT"];
  return ["SQUAT", "BENCH", "OHP", "DEADLIFT", "PULL"];
}

function initTargetState(progressionTarget: ProgressionTarget, initialWorkKg: number): TargetRuntimeState {
  return {
    progressionTarget,
    workKg: toPositiveRounded2p5(Math.max(0, initialWorkKg)),
    successStreak: 0,
    failureStreak: 0,
  };
}

function readTrainingMaxForKey(planParams: unknown, key: string, progressionTarget: ProgressionTarget) {
  const params = (planParams ?? {}) as { trainingMaxKg?: Record<string, unknown> };
  const tm = params.trainingMaxKg ?? {};
  return toFiniteNumber(tm[key]) ?? toFiniteNumber(tm[progressionTarget]) ?? 0;
}

function deriveInitialState(input: {
  previousState: unknown;
  planParams: unknown;
  outcomes: Map<string, TargetOutcome>;
  program: ProgressionProgram;
}): ProgressionRuntimeState {
  const prev = (input.previousState ?? {}) as Partial<ProgressionRuntimeState>;
  const previousTargets = prev.targets ?? {};
  const keys =
    input.program === "operator"
      ? Array.from(new Set([...Object.keys(previousTargets), ...Array.from(input.outcomes.keys())]))
      : targetsFor(input.program);

  const baseTargets: Record<string, TargetRuntimeState> = {};
  for (const key of keys) {
    const prevTarget = previousTargets[key];
    if (prevTarget && typeof prevTarget === "object") {
      const workKg = toFiniteNumber((prevTarget as TargetRuntimeState).workKg) ?? 0;
      const successStreak = Math.max(0, Math.floor(toFiniteNumber((prevTarget as TargetRuntimeState).successStreak) ?? 0));
      const failureStreak = Math.max(0, Math.floor(toFiniteNumber((prevTarget as TargetRuntimeState).failureStreak) ?? 0));
      const progressionTarget =
        parseProgressionTarget((prevTarget as Partial<TargetRuntimeState>).progressionTarget) ??
        input.outcomes.get(key)?.progressionTarget ??
        parseProgressionTarget(key) ??
        "SQUAT";
      baseTargets[key] = { progressionTarget, workKg: toPositiveRounded2p5(workKg), successStreak, failureStreak };
      continue;
    }

    const progressionTarget =
      input.outcomes.get(key)?.progressionTarget ??
      parseProgressionTarget(key) ??
      "SQUAT";
    const fromPlan = readTrainingMaxForKey(input.planParams, key, progressionTarget);
    const fromOutcome = input.outcomes.get(key)?.averageWeightKg ?? 0;
    baseTargets[key] = initTargetState(progressionTarget, fromPlan > 0 ? fromPlan : fromOutcome);
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

function asDefinitionRecord(definition: unknown): Record<string, unknown> {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) return {};
  return definition as Record<string, unknown>;
}

export function resolveAutoProgressionProgram(programSlug: string, definition?: unknown): ProgressionProgram | null {
  const slug = String(programSlug).trim().toLowerCase();
  const def = asDefinitionRecord(definition);
  const kind = String(def.kind ?? "").trim().toLowerCase();
  const family = String(def.programFamily ?? "").trim().toLowerCase();

  if (slug === "operator") return "operator";
  if (slug === "greyskull-lp") return "greyskull-lp";
  if (slug === "starting-strength-lp") return "starting-strength-lp";
  if (slug === "stronglifts-5x5") return "stronglifts-5x5";
  if (slug === "texas-method") return "texas-method";
  if (slug === "gzclp") return "gzclp";
  if (slug === "wendler-531" || slug === "wendler-531-fsl" || slug === "wendler-531-bbb") return "wendler-531";
  if (kind === "operator" || family === "operator" || def.operatorStyle === true) return "operator";
  if (kind === "greyskull-lp" || family === "greyskull-lp") return "greyskull-lp";
  if (kind === "starting-strength-lp" || family === "starting-strength-lp") return "starting-strength-lp";
  if (kind === "stronglifts-5x5" || family === "stronglifts-5x5") return "stronglifts-5x5";
  if (kind === "texas-method" || family === "texas-method") return "texas-method";
  if (kind === "gzclp" || family === "gzclp") return "gzclp";
  return null;
}

export function extractTrainingMaxOverridesFromState(state: unknown): Record<string, number> {
  const runtime = (state ?? {}) as Partial<ProgressionRuntimeState>;
  const targets = runtime.targets ?? {};
  const out: Record<string, number> = {};

  for (const [key, targetState] of Object.entries(targets)) {
    const workKg = toFiniteNumber((targetState as TargetRuntimeState)?.workKg);
    if (workKg === null || workKg <= 0) continue;
    out[key] = toPositiveRounded2p5(workKg);
  }

  return out;
}

export function collectTargetOutcomes(sets: LoggedSetInput[]): Map<string, TargetOutcome> {
  const acc = new Map<
    string,
    {
      progressionKey: string;
      progressionTarget: ProgressionTarget;
      displayTarget: string;
      total: number;
      successful: number;
      weightSum: number;
      weightCount: number;
    }
  >();

  for (const set of sets) {
    if (set.isExtra) continue;
    const identity = progressionIdentityForSet(set);
    if (!identity) continue;
    const outcome = acc.get(identity.key) ?? {
      progressionKey: identity.key,
      progressionTarget: identity.progressionTarget,
      displayTarget: identity.displayTarget,
      total: 0,
      successful: 0,
      weightSum: 0,
      weightCount: 0,
    };
    outcome.total += 1;
    if (setWasCompleted(set)) {
      outcome.successful += 1;
    }

    const weight = resolveLoggedTotalLoadKg({
      exerciseName: set.exerciseName,
      weightKg: set.weightKg,
      meta: set.meta,
    });
    if (weight !== null && weight > 0) {
      outcome.weightSum += weight;
      outcome.weightCount += 1;
    }

    acc.set(identity.key, outcome);
  }

  const out = new Map<string, TargetOutcome>();
  for (const [key, value] of acc.entries()) {
    out.set(key, {
      progressionKey: value.progressionKey,
      progressionTarget: value.progressionTarget,
      displayTarget: value.displayTarget,
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
  const keysToProcess =
    input.program === "operator"
      ? Array.from(new Set([...Object.keys(state.targets), ...Array.from(outcomes.keys())]))
      : targetsFor(input.program);
  const decisions: TargetDecision[] = [];

  for (const key of keysToProcess) {
    const outcome = outcomes.get(key);
    const progressionTarget =
      outcome?.progressionTarget ??
      parseProgressionTarget(state.targets[key]?.progressionTarget) ??
      parseProgressionTarget(key);
    if (!progressionTarget) continue;

    const before = state.targets[key] ?? initTargetState(progressionTarget, 0);
    if (!outcome || outcome.total < 1) continue;

    const success = outcome.successful === outcome.total;
    const next: TargetRuntimeState = { ...before, progressionTarget };
    let eventType: "INCREASE" | "HOLD" | "RESET" = "HOLD";
    let reason = "hold:no-data";

    if (next.workKg <= 0 && (outcome.averageWeightKg ?? 0) > 0) {
      next.workKg = outcome.averageWeightKg ?? 0;
    }

    if (input.program === "operator" || input.program === "wendler-531") {
      // 블록 기반 프로그램: LP 진행 로직 없이 스트릭만 누적
      if (success) {
        next.successStreak += 1;
        reason = "hold:block-success";
      } else {
        next.failureStreak += 1;
        reason = "hold:block-failure";
      }

      state.targets[key] = next;
      decisions.push({
        key,
        target: outcome.displayTarget,
        progressionTarget,
        outcome: success ? "SUCCESS" : "FAIL",
        eventType,
        reason,
        before,
        after: next,
      });
      continue;
    }

    const rule = rulesFor(input.program, progressionTarget);
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

    state.targets[key] = next;
    decisions.push({
      key,
      target: outcome.displayTarget,
      progressionTarget,
      outcome: success ? "SUCCESS" : "FAIL",
      eventType,
      reason,
      before,
      after: next,
    });
  }

  let didAdvanceSession = false;
  if (input.program === "operator") {
    const loggedTargets = Array.from(outcomes.keys()).filter((key) => outcomes.get(key)?.total);
    const completedBlock = state.week === 6 && state.day === 3;

    if (loggedTargets.length > 0) {
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

    if (completedBlock && loggedTargets.length > 0) {
      const targetEntries = Object.entries(state.targets);
      const hadBlockFailure = targetEntries.some(([, targetState]) => (targetState?.failureStreak ?? 0) > 0);
      if (!hadBlockFailure) {
        for (const [key, currentTargetState] of targetEntries) {
          const progressionTarget = parseProgressionTarget(currentTargetState?.progressionTarget) ?? parseProgressionTarget(key);
          if (!progressionTarget) continue;
          const before = state.targets[key] ?? initTargetState(progressionTarget, 0);
          if (before.workKg <= 0) {
            state.targets[key] = {
              ...before,
              successStreak: 0,
              failureStreak: 0,
            };
            continue;
          }
          const increaseKg = rulesFor(input.program, progressionTarget).increaseKg;
          const after: TargetRuntimeState = {
            progressionTarget,
            workKg: toPositiveRounded2p5(before.workKg + increaseKg),
            successStreak: 0,
            failureStreak: 0,
          };
          state.targets[key] = after;

          const decisionLabel = outcomes.get(key)?.displayTarget ?? key;
          const index = decisions.findIndex((decision) => decision.key === key);
          const updatedDecision: TargetDecision = {
            key,
            target: decisionLabel,
            progressionTarget,
            outcome: index >= 0 ? decisions[index]!.outcome : "SUCCESS",
            eventType: "INCREASE",
            reason: `increase:+${increaseKg}kg`,
            before,
            after,
          };
          if (index >= 0) {
            decisions[index] = updatedDecision;
          } else {
            decisions.push(updatedDecision);
          }
        }
      } else {
        for (const [key, current] of Object.entries(state.targets)) {
          state.targets[key] = {
            ...current,
            successStreak: 0,
            failureStreak: 0,
          };
        }
      }
    }
  }

  // Wendler 5/3/1: 4주×4일 블록 사이클
  if (input.program === "wendler-531") {
    const loggedTargets = Array.from(outcomes.keys()).filter((key) => outcomes.get(key)?.total);
    const completedBlock = state.week === 4 && state.day === 4;

    if (loggedTargets.length > 0) {
      state.day += 1;
      if (state.day > 4) {
        state.day = 1;
        state.week += 1;
        if (state.week > 4) {
          state.week = 1;
          state.cycle += 1;
        }
      }
      didAdvanceSession = true;
    }

    if (completedBlock && loggedTargets.length > 0) {
      const targetEntries = Object.entries(state.targets);
      const hadBlockFailure = targetEntries.some(([, targetState]) => (targetState?.failureStreak ?? 0) > 0);
      if (!hadBlockFailure) {
        for (const [key, currentTargetState] of targetEntries) {
          const progressionTarget = parseProgressionTarget(currentTargetState?.progressionTarget) ?? parseProgressionTarget(key);
          if (!progressionTarget) continue;
          const before = state.targets[key] ?? initTargetState(progressionTarget, 0);
          if (before.workKg <= 0) {
            state.targets[key] = { ...before, successStreak: 0, failureStreak: 0 };
            continue;
          }
          const increaseKg = rulesFor("wendler-531", progressionTarget).increaseKg;
          const after: TargetRuntimeState = {
            progressionTarget,
            workKg: toPositiveRounded2p5(before.workKg + increaseKg),
            successStreak: 0,
            failureStreak: 0,
          };
          state.targets[key] = after;

          const decisionLabel = outcomes.get(key)?.displayTarget ?? key;
          const index = decisions.findIndex((d) => d.key === key);
          const updatedDecision: TargetDecision = {
            key,
            target: decisionLabel,
            progressionTarget,
            outcome: index >= 0 ? decisions[index]!.outcome : "SUCCESS",
            eventType: "INCREASE",
            reason: `increase:+${increaseKg}kg`,
            before,
            after,
          };
          if (index >= 0) {
            decisions[index] = updatedDecision;
          } else {
            decisions.push(updatedDecision);
          }
        }
      } else {
        for (const [key, current] of Object.entries(state.targets)) {
          state.targets[key] = { ...current, successStreak: 0, failureStreak: 0 };
        }
      }
    }
  }

  state.lastAppliedLogId = input.logId;

  const eventType = summarizeEventType(decisions, didAdvanceSession);
  const reason =
    eventType === "INCREASE" || eventType === "RESET"
      ? decisions.find((decision) => decision.eventType === eventType)?.reason ?? eventType.toLowerCase()
      : didAdvanceSession
        ? "advance:session"
        : eventType.toLowerCase();
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
