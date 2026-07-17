import { apiGet } from "@/shared/api";
import { mapExerciseNameToTarget as mapExerciseNameToProgressionTarget } from "@workout/core/strength-engine/target-mapping";
import type {
  WorkoutExerciseViewModel,
  WorkoutProgramExerciseEntryStateMap,
} from "@/entities/workout-record";
import type {
  FailureProtocolDecision,
  FailureProtocolResult,
  FailureProtocolTarget,
} from "@/components/ui/failure-protocol-sheet";

export type ProgressionTargetStateSnapshot = {
  progressionTarget?: string;
  workKg: number;
  failureStreak: number;
  successStreak: number;
};

export type ProgressionRuntimeStateSnapshot = {
  cycle: number;
  week: number;
  day: number;
  targets: Record<string, ProgressionTargetStateSnapshot>;
};

export type FailedProgressionExercise = {
  exerciseName: string;
  target: string;
};

export type ProgressionProtocolMode = "block-completion" | "greyskull-reset";

type ProgressionProgram =
  | "operator"
  | "greyskull-lp"
  | "starting-strength-lp"
  | "stronglifts-5x5"
  | "texas-method"
  | "gzclp"
  | "wendler-531"
  | "asymptote"
  | null;

export type ProgressionEffectiveRule = {
  progressionTarget: string;
  increaseKg: number;
  decreaseKg: number | null;
  resetFactor: number;
  defaultIncreaseKg: number;
  defaultResetFactor: number;
};

type ProgressionStateResponse = {
  program: ProgressionProgram;
  state: ProgressionRuntimeStateSnapshot | null;
  effectiveRules?: Record<string, ProgressionEffectiveRule>;
};

function snapTo2p5(value: number) {
  return Math.max(0, Math.round(value / 2.5) * 2.5);
}

function computeResetKgFromRule(workKg: number, rule: ProgressionEffectiveRule | undefined, fallbackFactor: number): number {
  if (rule?.decreaseKg !== null && rule?.decreaseKg !== undefined) {
    return snapTo2p5(workKg - rule.decreaseKg);
  }
  const factor = rule?.resetFactor ?? fallbackFactor;
  return snapTo2p5(workKg * factor);
}

function resolveIncreaseKgFromRule(key: string, rule: ProgressionEffectiveRule | undefined, lowerDefault: number, upperDefault: number): number {
  if (rule?.increaseKg !== undefined) return rule.increaseKg;
  return key === "DEADLIFT" || key === "SQUAT" ? lowerDefault : upperDefault;
}

export function detectFailedProgressionExercises(
  visibleExercises: WorkoutExerciseViewModel[],
  programEntryState: WorkoutProgramExerciseEntryStateMap,
): FailedProgressionExercise[] {
  const seen = new Set<string>();
  const failed: FailedProgressionExercise[] = [];
  for (const exercise of visibleExercises) {
    if (exercise.source !== "PROGRAM" || exercise.skipProgression) continue;
    const entryState = programEntryState[exercise.id];
    if (!entryState) continue;
    const hasFail = exercise.set.repsPerSet.some((_, i) => {
      const rawActual = entryState.repsInputs[i]?.trim() ?? "";
      if (rawActual === "") return false;
      const actual = Number(rawActual);
      const planned = entryState.plannedRepsPerSet[i];
      return Number.isFinite(actual) && actual >= 0 && typeof planned === "number" && planned > 0 && actual < planned;
    });
    if (!hasFail) continue;
    const target =
      typeof exercise.progressionTarget === "string" && exercise.progressionTarget.trim()
        ? exercise.progressionTarget.trim().toUpperCase()
        : mapExerciseNameToProgressionTarget(exercise.exerciseName);
    if (!target || seen.has(target)) continue;
    seen.add(target);
    failed.push({ exerciseName: exercise.exerciseName, target });
  }
  return failed;
}

function progressionTargetLabel(target: string, locale: "ko" | "en"): string {
  const labels =
    locale === "ko"
      ? { SQUAT: "스쿼트", BENCH: "벤치프레스", DEADLIFT: "데드리프트", OHP: "오버헤드프레스", PULL: "풀" }
      : { SQUAT: "Squat", BENCH: "Bench Press", DEADLIFT: "Deadlift", OHP: "Overhead Press", PULL: "Pull" };
  return labels[target as keyof typeof labels] ?? target;
}

function buildReasonLabel(
  failureStreak: number,
  successStreak: number,
  locale: "ko" | "en",
): string {
  if (failureStreak >= 2) {
    return locale === "ko"
      ? `${failureStreak}회 연속 실패`
      : `${failureStreak} consecutive failures`;
  }
  if (failureStreak >= 1) {
    return locale === "ko" ? "직전 사이클 실패" : "Previous cycle failed";
  }
  if (successStreak >= 1) {
    return locale === "ko"
      ? `${successStreak}회 연속 성공`
      : `${successStreak} consecutive successes`;
  }
  return locale === "ko" ? "이전 사이클 성공" : "Previous cycle succeeded";
}

function buildBlockCompletionDescription(
  variant: "operator" | "wendler-531",
  locale: "ko" | "en",
  freezeAll: boolean,
): string {
  if (variant === "operator") {
    if (freezeAll) {
      return locale === "ko"
        ? "6주 블록을 완료했지만 처방 미달이 남아 모든 무게 유지가 권장됩니다.\n운동별 선택을 확인하세요."
        : "You completed the 6-week block, but an unresolved miss means holding every weight is recommended.\nReview each exercise choice.";
    }
    return locale === "ko"
      ? "6주 블록을 완료했습니다.\n다음 사이클에 적용할 무게를 선택하세요."
      : "You completed the 6-week block.\nChoose the working weights to apply to the next cycle.";
  }
  if (freezeAll) {
    return locale === "ko"
      ? "4주 사이클을 완료했지만 처방 미달이 남아 모든 트레이닝 맥스 유지가 권장됩니다.\n운동별 선택을 확인하세요."
      : "You completed the 4-week cycle, but an unresolved miss means holding every training max is recommended.\nReview each lift choice.";
  }
  return locale === "ko"
    ? "4주 사이클을 완료했습니다.\n다음 사이클에 적용할 트레이닝 맥스를 선택하세요."
    : "You completed the 4-week cycle.\nChoose the training max to apply to the next cycle.";
}

function buildResetProtocolDescription(locale: "ko" | "en"): string {
  return locale === "ko"
    ? "연속 실패 기준에 도달했습니다.\n운동별로 다음 사이클 무게를 조정하세요."
    : "Consecutive failure threshold reached.\nAdjust the next-cycle weight per exercise.";
}

function resolveSnapshotProgressionTarget(
  key: string,
  target: ProgressionTargetStateSnapshot,
  rule: ProgressionEffectiveRule | undefined,
) {
  return String(target.progressionTarget ?? rule?.progressionTarget ?? key).toUpperCase();
}

function buildBlockHoldReasonLabel(input: {
  failureCount: number;
  failedThisSession: boolean;
  locale: "ko" | "en";
}) {
  if (input.failureCount > 0) {
    if (input.locale === "ko") {
      return `${input.failureCount}회 연속 처방 미달 · 전체 증량 보류`;
    }
    return `${input.failureCount} consecutive misses · all increases on hold`;
  }
  return input.locale === "ko"
    ? "블록 내 다른 운동 처방 미달 · 전체 증량 보류"
    : "Another lift missed its prescription · all increases on hold";
}

export function buildBlockCompletionTargets(
  state: ProgressionRuntimeStateSnapshot | null,
  effectiveRules: Record<string, ProgressionEffectiveRule> | undefined,
  fallbackResetFactor: number,
  locale: "ko" | "en",
  currentSession?: {
    observedTargets: ReadonlySet<string>;
    failedTargets: ReadonlySet<string>;
  },
): FailureProtocolTarget[] {
  if (!state) return [];
  const unresolvedByKey = new Map<string, { canonical: string; failureCount: number; failedThisSession: boolean }>();
  for (const [key, target] of Object.entries(state.targets)) {
    const canonical = resolveSnapshotProgressionTarget(key, target, effectiveRules?.[key]);
    const observed = currentSession?.observedTargets.has(canonical) ?? false;
    const failedThisSession = currentSession?.failedTargets.has(canonical) ?? false;
    const failureCount = observed
      ? failedThisSession
        ? target.failureStreak + 1
        : 0
      : target.failureStreak;
    unresolvedByKey.set(key, { canonical, failureCount, failedThisSession });
  }
  const freezeAll = Array.from(unresolvedByKey.values()).some((entry) => entry.failureCount > 0);
  const targets: FailureProtocolTarget[] = [];
  for (const [key, t] of Object.entries(state.targets)) {
    if (t.workKg <= 0) continue;
    const rule = effectiveRules?.[key];
    const unresolved = unresolvedByKey.get(key)!;
    const recommendedIncreaseKg = resolveIncreaseKgFromRule(key, rule, 5, 2.5);
    const recommendedResetKg = computeResetKgFromRule(t.workKg, rule, fallbackResetFactor);
    targets.push({
      key,
      label: progressionTargetLabel(unresolved.canonical, locale),
      currentWorkKg: snapTo2p5(t.workKg),
      recommendedIncreaseKg,
      recommendedResetKg,
      recommendedMode: freezeAll ? "hold" : "increase",
      reasonLabel: freezeAll
        ? buildBlockHoldReasonLabel({
            failureCount: unresolved.failureCount,
            failedThisSession: unresolved.failedThisSession,
            locale,
          })
        : buildReasonLabel(t.failureStreak, t.successStreak, locale),
    });
  }
  return targets;
}

function buildFailureThresholdReasonLabel(
  failureCount: number,
  threshold: number,
  locale: "ko" | "en",
) {
  return locale === "ko"
    ? `${failureCount}회 연속 처방 미달 · ${threshold}회 리셋 기준 도달`
    : `${failureCount} consecutive misses · ${threshold}-miss reset threshold reached`;
}

export function buildResetProtocolTargets(
  failures: FailedProgressionExercise[],
  state: ProgressionRuntimeStateSnapshot | null,
  effectiveRules: Record<string, ProgressionEffectiveRule> | undefined,
  fallbackResetFactor: number,
  failureThreshold: number,
  locale: "ko" | "en",
): FailureProtocolTarget[] {
  const targets: FailureProtocolTarget[] = [];
  const seen = new Set<string>();
  for (const f of failures) {
    const matched = Object.entries(state?.targets ?? {}).find(([key, targetState]) => {
      const canonical = resolveSnapshotProgressionTarget(key, targetState, effectiveRules?.[key]);
      return canonical === f.target.toUpperCase();
    });
    if (!matched) continue;
    const [key, targetState] = matched;
    if (seen.has(key) || targetState.workKg <= 0) continue;
    const pendingFailureCount = targetState.failureStreak + 1;
    if (pendingFailureCount < failureThreshold) continue;
    seen.add(key);
    const rule = effectiveRules?.[key];
    const recommendedIncreaseKg = resolveIncreaseKgFromRule(key, rule, 5, 2.5);
    const recommendedResetKg = computeResetKgFromRule(targetState.workKg, rule, fallbackResetFactor);
    targets.push({
      key,
      label: f.exerciseName || progressionTargetLabel(f.target, locale),
      currentWorkKg: snapTo2p5(targetState.workKg),
      recommendedIncreaseKg,
      recommendedResetKg,
      recommendedMode: "reset",
      reasonLabel: buildFailureThresholdReasonLabel(
        pendingFailureCount,
        failureThreshold,
        locale,
      ),
    });
  }
  return targets;
}

export type ResolvedProgressionOverride = {
  cancelled: boolean;
  decisions: Record<string, FailureProtocolDecision> | null;
};

export function resolveFailureResetChoiceConfig(program: ProgressionProgram) {
  if (program === "greyskull-lp") return { threshold: 2, resetFactor: 0.9 };
  if (
    program === "starting-strength-lp" ||
    program === "stronglifts-5x5" ||
    program === "texas-method"
  ) {
    return { threshold: 3, resetFactor: 0.9 };
  }
  return null;
}

export async function resolveWorkoutLogProgressionOverride({
  selectedPlanId,
  autoProgressionEnabled,
  sessionWeek,
  sessionDay,
  visibleExercises,
  programEntryState,
  locale,
  requestChoice,
}: {
  selectedPlanId: string | null | undefined;
  autoProgressionEnabled: boolean;
  sessionWeek: number | null;
  sessionDay: number | null;
  visibleExercises: WorkoutExerciseViewModel[];
  programEntryState: WorkoutProgramExerciseEntryStateMap;
  locale: "ko" | "en";
  requestChoice: (input: {
    title: string;
    description: string;
    mode: ProgressionProtocolMode;
    targets: FailureProtocolTarget[];
  }) => Promise<FailureProtocolResult>;
}): Promise<ResolvedProgressionOverride> {
  // REF5 owns PASS/HOLD/FAIL/INVALID and its exact ±2.5 kg decisions. The generic
  // failure-protocol sheet would double-apply an unrelated LP/block policy.
  if (visibleExercises.some((exercise) => Boolean(exercise.ref5))) {
    return { cancelled: false, decisions: null };
  }
  if (!selectedPlanId || !autoProgressionEnabled) {
    return { cancelled: false, decisions: null };
  }

  const isOperatorBlockEnd = sessionWeek === 6 && sessionDay === 3;
  const is531BlockEnd = sessionWeek === 4 && sessionDay === 4;
  const failures = detectFailedProgressionExercises(visibleExercises, programEntryState);
  const observedTargets = new Set(
    visibleExercises
      .filter((exercise) => exercise.source === "PROGRAM" && !exercise.skipProgression)
      .flatMap((exercise) => {
        const target =
          typeof exercise.progressionTarget === "string" && exercise.progressionTarget.trim()
            ? exercise.progressionTarget.trim().toUpperCase()
            : mapExerciseNameToProgressionTarget(exercise.exerciseName);
        return target ? [target.toUpperCase()] : [];
      }),
  );
  const failedTargets = new Set(failures.map((failure) => failure.target.toUpperCase()));
  const shouldCheck = isOperatorBlockEnd || is531BlockEnd || failures.length > 0;
  if (!shouldCheck) {
    return { cancelled: false, decisions: null };
  }

  try {
    const progressionData = await apiGet<ProgressionStateResponse>(
      `/api/plans/${encodeURIComponent(selectedPlanId)}/progression-state`,
    );

    if (progressionData.program === "operator" && isOperatorBlockEnd) {
      // TB 공식 reset = 현재 TM의 90%(10% 감량). effectiveRules.resetFactor 부재 시 폴백.
      const targets = buildBlockCompletionTargets(
        progressionData.state,
        progressionData.effectiveRules,
        0.9,
        locale,
        { observedTargets, failedTargets },
      );
      if (targets.length === 0) {
        return { cancelled: false, decisions: null };
      }
      const freezeAll = targets.every((target) => target.recommendedMode === "hold");
      const result = await requestChoice({
        title: locale === "ko" ? "블록 완료 - 무게 설정" : "Block Complete - Set Weights",
        description: buildBlockCompletionDescription("operator", locale, freezeAll),
        mode: "block-completion",
        targets,
      });
      if (result.choice === "cancel") {
        return { cancelled: true, decisions: null };
      }
      return { cancelled: false, decisions: result.decisions };
    }

    if (progressionData.program === "wendler-531" && is531BlockEnd) {
      const targets = buildBlockCompletionTargets(
        progressionData.state,
        progressionData.effectiveRules,
        0.9,
        locale,
        { observedTargets, failedTargets },
      );
      if (targets.length === 0) {
        return { cancelled: false, decisions: null };
      }
      const freezeAll = targets.every((target) => target.recommendedMode === "hold");
      const result = await requestChoice({
        title: locale === "ko" ? "4주 사이클 완료 - TM 설정" : "4-Week Cycle Complete - Set TMs",
        description: buildBlockCompletionDescription("wendler-531", locale, freezeAll),
        mode: "block-completion",
        targets,
      });
      if (result.choice === "cancel") {
        return { cancelled: true, decisions: null };
      }
      return { cancelled: false, decisions: result.decisions };
    }

    const resetChoiceConfig = resolveFailureResetChoiceConfig(progressionData.program);
    if (resetChoiceConfig && failures.length > 0) {
        const targets = buildResetProtocolTargets(
          failures,
          progressionData.state,
          progressionData.effectiveRules,
          resetChoiceConfig.resetFactor,
          resetChoiceConfig.threshold,
          locale,
        );
        if (targets.length === 0) return { cancelled: false, decisions: null };
        const result = await requestChoice({
          title: locale === "ko" ? "연속 실패 기준 도달" : "Consecutive Failure Threshold Reached",
          description: buildResetProtocolDescription(locale),
          mode: "greyskull-reset",
          targets,
        });
        if (result.choice === "cancel") {
          return { cancelled: true, decisions: null };
        }
        return { cancelled: false, decisions: result.decisions };
    }
  } catch {
    return { cancelled: false, decisions: null };
  }

  return { cancelled: false, decisions: null };
}
