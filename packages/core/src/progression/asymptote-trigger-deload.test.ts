// Asymptote × Async Hybrid — 트리거 조기 디로드 테스트 (`asymptote-async-hybrid.md` §3.3).
// 드라이버(SQ/BP/PULL) 중 2개 이상이 failureStreak ≥ 2면 빌드 사이클 중 즉시 week4(디로드)로 점프.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reduceProgressionState,
  type ProgressionRuntimeState,
  type ProgressionTarget,
} from "./reducer";

const TM = { trainingMaxKg: { SQUAT: 100, BENCH: 80, PULL: 100, DEADLIFT: 100, OHP: 40 } };

function target(progressionTarget: ProgressionTarget, failureStreak: number) {
  return { progressionTarget, workKg: 100, successStreak: 0, failureStreak };
}

function baseState(week: number, day: number, streaks: Record<string, number>): ProgressionRuntimeState {
  return {
    cycle: 1,
    week,
    day,
    lastAppliedLogId: null,
    targets: {
      SQUAT: target("SQUAT", streaks.SQUAT ?? 0),
      BENCH: target("BENCH", streaks.BENCH ?? 0),
      PULL: target("PULL", streaks.PULL ?? 0),
      DEADLIFT: target("DEADLIFT", 0),
      OHP: target("OHP", 0),
    },
  };
}

// 완료된(성공) PULL 한 세트 — 세션이 "로그됨"으로 카운트되게 한다.
const pullSuccessSet = {
  exerciseName: "Weighted Pull-Up",
  reps: 3,
  weightKg: 80,
  meta: { plannedRef: { progressionTarget: "PULL", progressionKey: "PULL", reps: 3 } },
};

function run(prev: ProgressionRuntimeState) {
  return reduceProgressionState({
    program: "asymptote",
    previousState: prev,
    planParams: TM,
    logId: "log-trigger",
    sets: [pullSuccessSet],
  }).nextState;
}

test("드라이버 2개(SQ+BP) failureStreak≥2 → week4로 점프", () => {
  const next = run(baseState(1, 1, { SQUAT: 2, BENCH: 2 }));
  assert.equal(next.week, 4, "디로드 사이클로 점프");
  assert.equal(next.day, 1, "디로드 사이클 선두");
});

test("드라이버 1개만 regress → 점프 안 함(정상 진행)", () => {
  const next = run(baseState(1, 1, { SQUAT: 2, BENCH: 0 }));
  assert.equal(next.week, 1, "빌드 사이클 유지");
  assert.equal(next.day, 2, "정상 세션 advance");
});

test("정상 진행(streak 0) → 트리거 미발동", () => {
  const next = run(baseState(2, 2, { SQUAT: 0, BENCH: 0, PULL: 0 }));
  assert.equal(next.week, 2);
  assert.equal(next.day, 3);
});

test("이미 디로드(week4)면 트리거 미발동(재점프 없음)", () => {
  const next = run(baseState(4, 1, { SQUAT: 3, BENCH: 3, PULL: 3 }));
  // week4/day1 → 정상 advance day2. 재점프/래핑 없음.
  assert.equal(next.week, 4);
  assert.equal(next.day, 2);
});

test("드라이버 3개 모두 regress → 점프 (보조 DL/OHP는 트리거 대상 아님)", () => {
  const next = run(baseState(3, 2, { SQUAT: 2, BENCH: 2, PULL: 2 }));
  assert.equal(next.week, 4);
  assert.equal(next.day, 1);
});

// ──────────────────────────────────────────────────────────────────────────────
// v0.5.1 F1 — 조기 디로드 점프 이벤트화. 판정은 위 테스트 그대로, 기록만 추가됐는지 고정.
// 점프 시 결과 이벤트가 ADVANCE_WEEK(기존 타입 재사용) + reason에 드라이버 목록을 실어야 하고,
// 점프가 없으면 기존 reason("advance:session")이 유지되어야 한다.
// ──────────────────────────────────────────────────────────────────────────────

function runFull(prev: ProgressionRuntimeState) {
  return reduceProgressionState({
    program: "asymptote",
    previousState: prev,
    planParams: TM,
    logId: "log-trigger-f1",
    sets: [pullSuccessSet],
  });
}

test("F1: 점프 시 이벤트 = ADVANCE_WEEK + deload:trigger:regressed=<드라이버들>", () => {
  const result = runFull(baseState(1, 1, { SQUAT: 2, BENCH: 2 }));
  assert.equal(result.nextState.week, 4, "판정 로직 불변(점프)");
  assert.equal(result.eventType, "ADVANCE_WEEK", "기존 이벤트 타입 재사용");
  assert.equal(result.reason, "deload:trigger:regressed=SQUAT,BENCH");
});

test("F1: 드라이버 3개 regress → 이번 세션 성공한 PULL은 리셋 후 판정(기존 로직 그대로)", () => {
  // pullSuccessSet이 성공으로 집계돼 PULL failureStreak이 0으로 리셋된 뒤 트리거가 평가된다
  // — 판정 로직 무변경 원칙의 검증이기도 하다. 기록엔 남은 regressed 드라이버만 실린다.
  const result = runFull(baseState(3, 2, { SQUAT: 2, BENCH: 2, PULL: 2 }));
  assert.equal(result.nextState.week, 4, "판정 로직 불변(점프)");
  assert.equal(result.reason, "deload:trigger:regressed=SQUAT,BENCH");
});

test("F1: 점프 없으면 기존 reason 유지(advance:session)", () => {
  const result = runFull(baseState(1, 1, { SQUAT: 2, BENCH: 0 }));
  assert.equal(result.nextState.week, 1, "판정 로직 불변(미점프)");
  assert.equal(result.eventType, "ADVANCE_WEEK");
  assert.equal(result.reason, "advance:session");
});

test("F1: 이미 디로드(week4) 진행 중엔 미기록", () => {
  const result = runFull(baseState(4, 1, { SQUAT: 3, BENCH: 3, PULL: 3 }));
  assert.equal(result.reason, "advance:session");
});
