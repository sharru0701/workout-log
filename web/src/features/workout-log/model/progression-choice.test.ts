import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBlockCompletionTargets,
  buildResetProtocolTargets,
  detectFailedProgressionExercises,
  resolveFailureResetChoiceConfig,
  type ProgressionEffectiveRule,
  type ProgressionRuntimeStateSnapshot,
} from "./progression";
import type { WorkoutExerciseViewModel } from "@/entities/workout-record";

function state(
  targets: ProgressionRuntimeStateSnapshot["targets"],
): ProgressionRuntimeStateSnapshot {
  return { cycle: 1, week: 1, day: 1, targets };
}

function rule(
  progressionTarget: string,
  increaseKg: number,
): ProgressionEffectiveRule {
  return {
    progressionTarget,
    increaseKg,
    decreaseKg: null,
    resetFactor: 0.9,
    defaultIncreaseKg: increaseKg,
    defaultResetFactor: 0.9,
  };
}

test("Operator 블록 종료 현재 실패: 동적 키를 리프트명으로 표시하고 전체 HOLD 추천", () => {
  const rules = {
    EX_BACK_SQUAT: rule("SQUAT", 5),
    EX_BENCH_PRESS: rule("BENCH", 2.5),
    EX_DEADLIFT: rule("DEADLIFT", 5),
    EX_PULL_UP: rule("PULL", 2.5),
  };
  const targets = buildBlockCompletionTargets(
    state({
      EX_BACK_SQUAT: { progressionTarget: "SQUAT", workKg: 100, successStreak: 4, failureStreak: 0 },
      EX_BENCH_PRESS: { progressionTarget: "BENCH", workKg: 80, successStreak: 4, failureStreak: 0 },
      EX_DEADLIFT: { progressionTarget: "DEADLIFT", workKg: 120, successStreak: 4, failureStreak: 0 },
      EX_PULL_UP: { progressionTarget: "PULL", workKg: 20, successStreak: 4, failureStreak: 0 },
    }),
    rules,
    0.9,
    "ko",
    {
      observedTargets: new Set(["SQUAT", "BENCH", "DEADLIFT"]),
      failedTargets: new Set(["SQUAT"]),
    },
  );

  assert.deepEqual(targets.map((target) => target.label), [
    "스쿼트",
    "벤치프레스",
    "데드리프트",
    "풀",
  ]);
  assert.ok(targets.every((target) => target.recommendedMode === "hold"));
  assert.match(targets[0]!.reasonLabel, /1회 연속 처방 미달/);
  assert.match(targets[1]!.reasonLabel, /다른 운동 처방 미달/);
});

test("블록 종료 현재 성공은 같은 리프트의 이전 실패를 해소해 증량 추천", () => {
  const targets = buildBlockCompletionTargets(
    state({
      SQUAT: { progressionTarget: "SQUAT", workKg: 100, successStreak: 0, failureStreak: 1 },
    }),
    { SQUAT: rule("SQUAT", 5) },
    0.9,
    "ko",
    {
      observedTargets: new Set(["SQUAT"]),
      failedTargets: new Set(),
    },
  );
  assert.equal(targets[0]!.recommendedMode, "increase");
});

test("블록 종료 세션에 없는 리프트의 미해소 실패는 전체 증량을 보류", () => {
  const targets = buildBlockCompletionTargets(
    state({
      SQUAT: { progressionTarget: "SQUAT", workKg: 100, successStreak: 4, failureStreak: 0 },
      PULL: { progressionTarget: "PULL", workKg: 20, successStreak: 0, failureStreak: 1 },
    }),
    { SQUAT: rule("SQUAT", 5), PULL: rule("PULL", 2.5) },
    0.9,
    "ko",
    {
      observedTargets: new Set(["SQUAT"]),
      failedTargets: new Set(),
    },
  );
  assert.ok(targets.every((target) => target.recommendedMode === "hold"));
  assert.match(targets[1]!.reasonLabel, /1회 연속 처방 미달/);
});

test("Texas 동적 슬롯 키: 세 번째 강도일 실패에서 실제 I 슬롯을 선택 대상으로 매핑", () => {
  const targets = buildResetProtocolTargets(
    [{ exerciseName: "Back Squat", target: "SQUAT" }],
    state({
      I_s0: { progressionTarget: "SQUAT", workKg: 100, successStreak: 0, failureStreak: 2 },
    }),
    { I_s0: rule("SQUAT", 5) },
    0.9,
    3,
    "ko",
  );
  assert.equal(targets.length, 1);
  assert.equal(targets[0]!.key, "I_s0");
  assert.equal(targets[0]!.recommendedResetKg, 90);
  assert.equal(targets[0]!.reasonLabel, "3회 연속 처방 미달 · 3회 리셋 기준 도달");
});

test("Greyskull은 두 번째 실패에서 선택창 대상, 첫 실패에서는 아직 대상 아님", () => {
  const first = buildResetProtocolTargets(
    [{ exerciseName: "Back Squat", target: "SQUAT" }],
    state({
      SQUAT: { progressionTarget: "SQUAT", workKg: 100, successStreak: 0, failureStreak: 0 },
    }),
    undefined,
    0.9,
    2,
    "ko",
  );
  const second = buildResetProtocolTargets(
    [{ exerciseName: "Back Squat", target: "SQUAT" }],
    state({
      SQUAT: { progressionTarget: "SQUAT", workKg: 100, successStreak: 0, failureStreak: 1 },
    }),
    undefined,
    0.9,
    2,
    "ko",
  );
  assert.equal(first.length, 0);
  assert.equal(second.length, 1);
  assert.equal(second[0]!.reasonLabel, "2회 연속 처방 미달 · 2회 리셋 기준 도달");
});

test("공통 리셋 선택창은 LP 4종에만 개입하고 531·Asymptote·GZCLP에는 개입하지 않음", () => {
  assert.deepEqual(resolveFailureResetChoiceConfig("greyskull-lp"), {
    threshold: 2,
    resetFactor: 0.9,
  });
  assert.deepEqual(resolveFailureResetChoiceConfig("starting-strength-lp"), {
    threshold: 3,
    resetFactor: 0.9,
  });
  assert.deepEqual(resolveFailureResetChoiceConfig("stronglifts-5x5"), {
    threshold: 3,
    resetFactor: 0.9,
  });
  assert.deepEqual(resolveFailureResetChoiceConfig("texas-method"), {
    threshold: 3,
    resetFactor: 0.9,
  });
  assert.equal(resolveFailureResetChoiceConfig("wendler-531"), null);
  assert.equal(resolveFailureResetChoiceConfig("asymptote"), null);
  assert.equal(resolveFailureResetChoiceConfig("gzclp"), null);
  assert.equal(resolveFailureResetChoiceConfig("operator"), null);
});

test("실패 탐지는 미입력과 명시적 0회를 구분한다", () => {
  const exercise = {
    id: "squat",
    exerciseName: "Back Squat",
    source: "PROGRAM",
    set: { repsPerSet: [1] },
  } as WorkoutExerciseViewModel;
  const base = {
    plannedRepsPerSet: [1],
    memoInput: "",
    memoPlaceholder: "",
  };

  assert.deepEqual(
    detectFailedProgressionExercises([exercise], {
      squat: { ...base, repsInputs: [""] },
    }),
    [],
  );
  assert.deepEqual(
    detectFailedProgressionExercises([exercise], {
      squat: { ...base, repsInputs: ["0"] },
    }),
    [{ exerciseName: "Back Squat", target: "SQUAT" }],
  );
});

test("실패 탐지는 제외 세트를 건너뛰고 이름보다 명시 target을 우선한다", () => {
  const baseExercise = {
    id: "custom-squat",
    exerciseName: "내 스쿼트",
    progressionTarget: "SQUAT",
    source: "PROGRAM",
    set: { repsPerSet: [5] },
  } as WorkoutExerciseViewModel;
  const entry = {
    repsInputs: ["4"],
    plannedRepsPerSet: [5],
    memoInput: "",
    memoPlaceholder: "",
  };

  assert.deepEqual(
    detectFailedProgressionExercises([baseExercise], { "custom-squat": entry }),
    [{ exerciseName: "내 스쿼트", target: "SQUAT" }],
  );
  assert.deepEqual(
    detectFailedProgressionExercises(
      [{ ...baseExercise, skipProgression: true }],
      { "custom-squat": entry },
    ),
    [],
  );
});
