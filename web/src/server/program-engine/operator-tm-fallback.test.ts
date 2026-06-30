import { test } from "node:test";
import assert from "node:assert/strict";
import { plannedExercisesFromOperatorManualSession } from "./generateSession";

// Operator는 무게를 TM × 주차% 로 처방한다. 사용자가 메인 3리프트(스쿼트/벤치/풀)의
// TM만 입력하고 데드리프트/오버헤드프레스 TM을 비워둔 커스텀 operator에서, 예전에는
// 그 두 운동의 targetWeightKg가 비어(undefined) 소비자에서 0으로 표시됐다(버그).
// 이제 asymptote와 동일하게 인접 메인 리프트로 폴백한다: 데드←스쿼트 TM,
// 오프←벤치 TM×0.5. 직접 TM이 있으면 항상 그쪽이 우선한다.

type Item = Record<string, unknown>;
const operatorSession = (): { key: string; items: Item[] } => ({
  key: "D3",
  items: [
    { exerciseName: "Back Squat", rowType: "AUTO", progressionTarget: "SQUAT", order: 0 },
    { exerciseName: "Bench Press", rowType: "AUTO", progressionTarget: "BENCH", order: 1 },
    { exerciseName: "Deadlift", rowType: "AUTO", progressionTarget: "DEADLIFT", order: 2 },
    { exerciseName: "Overhead Press", rowType: "AUTO", progressionTarget: "OHP", order: 3 },
  ],
});

const tmOf = (out: ReturnType<typeof plannedExercisesFromOperatorManualSession>, name: string) =>
  out.find((e) => e.exerciseName === name)?.sets?.[0]?.targetWeightKg;

test("operator manual: 데드/오프 TM 미입력 → 인접 리프트 폴백 (데드←스쿼트, 오프←벤치×0.5)", () => {
  // 데드리프트/오버헤드프레스 TM이 trainingMaxKg에 없다 — 버그 재현 조건.
  const params = { trainingMaxKg: { SQUAT: 100, BENCH: 100 } };
  const out = plannedExercisesFromOperatorManualSession(operatorSession(), 1, params, params, {});

  // W1 = 70%
  assert.equal(tmOf(out, "Back Squat"), 70); //  100 × 0.7
  assert.equal(tmOf(out, "Bench Press"), 70); // 100 × 0.7
  assert.equal(tmOf(out, "Deadlift"), 70); //    SQUAT TM 100 × 0.7 (폴백)
  assert.equal(tmOf(out, "Overhead Press"), 35); // (BENCH 100 × 0.5 = 50) × 0.7 (폴백)
});

test("operator manual: 데드/오프 직접 TM이 있으면 폴백보다 우선", () => {
  const params = { trainingMaxKg: { SQUAT: 100, BENCH: 80, DEADLIFT: 150, OHP: 50 } };
  const out = plannedExercisesFromOperatorManualSession(operatorSession(), 1, params, params, {});

  assert.equal(tmOf(out, "Deadlift"), 105); //      150 × 0.7 (직접; 폴백이면 70)
  assert.equal(tmOf(out, "Overhead Press"), 35); // 50 × 0.7  (직접; 폴백이면 BENCH 80×0.5×0.7 = 28)
});

test("operator manual: 폴백 소스(스쿼트/벤치)조차 없으면 무게 미처방(reps-only) 유지", () => {
  // 벤치 TM이 없으면 오프는 폴백 불가 → 예전처럼 reps-only(무게 비움). 데드는 스쿼트로 폴백.
  const params = { trainingMaxKg: { SQUAT: 100 } };
  const out = plannedExercisesFromOperatorManualSession(operatorSession(), 1, params, params, {});

  assert.equal(tmOf(out, "Deadlift"), 70); //          SQUAT 100 × 0.7 (폴백)
  assert.equal(tmOf(out, "Overhead Press"), undefined); // 폴백 불가 → targetWeightKg 없음
});
