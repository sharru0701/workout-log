// v0.5.1 실패 프로토콜 피드백(F3·F5) — 엔진 쪽 파생 테스트.
// `web/docs/asymptote-hybrid-v0.5.1-feedback-patch.md` 기준. 판정 로직(보류 매트릭스·가드)은
// 기존 그대로이고, 여기서는 "기록/파생"(세트 meta.amrapDeferred, snapshot 승격 판정원,
// 다음 세션 위치·판정 세션 여부)만 고정한다.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  asymptoteIsJudgmentSession,
  asymptoteNextPosition,
} from "./asymptote";
import {
  plannedExercisesFromAsymptoteManualSession,
  plannedExercisesHaveDeferredAmrap,
  previewSessionExercises,
  type PlannedExercise,
} from "./generateSession";

const TM = { trainingMaxKg: { SQUAT: 100, BENCH: 80, PULL: 100, DEADLIFT: 100, OHP: 40 } };

function logicSession(week: number, day: number, extraParams: Record<string, unknown> = {}) {
  return previewSessionExercises({
    planType: "SINGLE",
    planParams: { ...TM, ...extraParams },
    runtimeState: null,
    rootVersion: { definition: { kind: "asymptote" }, defaults: {} },
    week,
    day,
  });
}

function deferredSets(exercises: PlannedExercise[]) {
  return exercises.flatMap((exercise) =>
    exercise.sets.filter((set) => set.meta?.amrapDeferred === true),
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// F3 — 보류된 AMRAP 세트 마킹 + 스냅샷 승격 판정원
// ──────────────────────────────────────────────────────────────────────────────

test("F3: week3 + restDayGap<2 → 보류 세트에 meta.amrapDeferred (LOGIC 경로)", () => {
  const exercises = logicSession(3, 1, { restDayGap: 1 });
  const deferred = deferredSets(exercises);
  assert.equal(deferred.length, 2, "세션A의 AMRAP 슬롯 2개(SQ·PULL)가 보류됨");
  for (const set of deferred) {
    assert.equal(set.amrap, false, "보류된 세트는 AMRAP 아님(기존 강등 동작 유지)");
    assert.equal(set.stopOnGrind, true, "그라인딩-정지 작업 세트로 강등(기존 동작 유지)");
  }
  assert.equal(plannedExercisesHaveDeferredAmrap(exercises), true);
});

test("F3: week3 + 충분한 휴식(gap≥2) → 마킹 없음", () => {
  const exercises = logicSession(3, 1, { restDayGap: 2 });
  assert.equal(deferredSets(exercises).length, 0);
  assert.equal(plannedExercisesHaveDeferredAmrap(exercises), false);
});

test("F3: 비판정 사이클(week2)은 gap<2여도 마킹 없음(보류 대상 자체가 없음)", () => {
  const exercises = logicSession(2, 1, { restDayGap: 0 });
  assert.equal(plannedExercisesHaveDeferredAmrap(exercises), false);
});

test("F3: slot 커스터마이즈 경로도 동일 규칙", () => {
  const manualSession = {
    items: [
      {
        exerciseName: "Back Squat",
        rowType: "AUTO",
        progressionTarget: "SQUAT",
        slot: { coef: 0.875, amrap: true, sessionKey: "A" },
        sets: [{ reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 3 }],
      },
    ],
  };
  const deferredOut = plannedExercisesFromAsymptoteManualSession(
    manualSession,
    3,
    { ...TM, restDayGap: 1 },
    {},
  );
  assert.equal(plannedExercisesHaveDeferredAmrap(deferredOut), true);
  const okOut = plannedExercisesFromAsymptoteManualSession(
    manualSession,
    3,
    { ...TM, restDayGap: 2 },
    {},
  );
  assert.equal(plannedExercisesHaveDeferredAmrap(okOut), false);
});

test("F3: plannedExercisesHaveDeferredAmrap — 비정형 입력은 false", () => {
  assert.equal(plannedExercisesHaveDeferredAmrap(null), false);
  assert.equal(plannedExercisesHaveDeferredAmrap([]), false);
  assert.equal(plannedExercisesHaveDeferredAmrap([{ sets: [{}] }]), false);
});

// ──────────────────────────────────────────────────────────────────────────────
// F5 — 다음 세션 위치·판정(AMRAP) 세션 여부 파생
// ──────────────────────────────────────────────────────────────────────────────

test("F5: asymptoteNextPosition — 리듀서 전진 규칙과 동일", () => {
  assert.deepEqual(asymptoteNextPosition(1, 1), { week: 1, day: 2 });
  assert.deepEqual(asymptoteNextPosition(1, 3), { week: 2, day: 1 });
  assert.deepEqual(asymptoteNextPosition(2, 3), { week: 3, day: 1 });
  assert.deepEqual(asymptoteNextPosition(4, 3), { week: 1, day: 1 }, "블록 종료 → 다음 블록 선두");
});

test("F5: asymptoteIsJudgmentSession — 사이클3의 AMRAP 세션(A·C)만 true", () => {
  assert.equal(asymptoteIsJudgmentSession(3, 1), true, "세션A(SQ·PULL AMRAP)");
  assert.equal(asymptoteIsJudgmentSession(3, 2), false, "세션B는 AMRAP 슬롯 없음");
  assert.equal(asymptoteIsJudgmentSession(3, 3), true, "세션C(BP AMRAP)");
  assert.equal(asymptoteIsJudgmentSession(2, 1), false, "사이클3 아님");
  assert.equal(asymptoteIsJudgmentSession(4, 1), false, "디로드 사이클");
});
