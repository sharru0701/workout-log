import assert from "node:assert/strict";
import test from "node:test";
import { reduceProgressionState } from "./reducer";
import {
  applyTargetDecisionsToReduced,
  buildProgressionEventMeta,
  readStoredDecisionsFromMeta,
  type ProgressionTargetDecision,
} from "./autoProgression";

// PR3: "현재 TM 직접 조정"의 보존 메커니즘 회귀 테스트.
//
// applyManualRuntimeAdjustment는 사용자의 보정을 "가장 최근 로그의
// progress_event.meta.targetDecisionsOverride"에 머지한다(접근 3-A). 이렇게 해야
// 과거 로그 수정으로 rebuild/replay가 돌 때 그 logId를 재생하며
// readStoredDecisionsFromMeta로 보정을 복원해 보존한다(PR #360 메커니즘과 정합).
//
// 보정을 null-logId 이벤트로 심으면 rebuild가 그 이벤트를 삭제해 소실되므로,
// 본 테스트는 "실 로그 override에 머지 → rebuild 복원" 불변을 in-memory로 재현한다.

type LogSet = { name: string; reps: number; weight: number };

const WEEK_SCHEME: Record<number, { reps: number; pct: number }> = {
  1: { reps: 5, pct: 0.7 },
  2: { reps: 5, pct: 0.8 },
  3: { reps: 3, pct: 0.9 },
  4: { reps: 5, pct: 0.75 },
  5: { reps: 3, pct: 0.85 },
  6: { reps: 1, pct: 0.95 },
};

type TmMap = { SQUAT: number; BENCH: number; DEADLIFT: number; PULL: number };

function operatorSessionSets(day: number, tm: TmMap, reps: number, pct: number): LogSet[] {
  const round = (v: number) => Math.round(v * 100) / 100;
  const exercises =
    day === 3
      ? [
          { name: "Back Squat", weight: round(tm.SQUAT * pct) },
          { name: "Bench Press", weight: round(tm.BENCH * pct) },
          { name: "Deadlift", weight: round(tm.DEADLIFT * pct) },
        ]
      : [
          { name: "Back Squat", weight: round(tm.SQUAT * pct) },
          { name: "Bench Press", weight: round(tm.BENCH * pct) },
          { name: "Pull-Up", weight: round(tm.PULL * pct) },
        ];
  return exercises.flatMap((ex) =>
    Array.from({ length: 3 }, () => ({ name: ex.name, reps, weight: ex.weight })),
  );
}

type BlockEvent = { logId: string; meta: unknown };

// 한 Operator 블록(6주×3일=18세션)을 reduce + (있으면)사용자 결정 머지로 재생해
// 실제 저장 경로(applyTargetDecisionsToReduced → buildProgressionEventMeta)와 동일하게
// 다음 state / meta를 누적한다. rebuild 재현 시 decisionFor로 저장본을 복원한다.
function runBlock(opts: {
  startState: unknown;
  tm: TmMap;
  planParams: Record<string, unknown>;
  logIdPrefix: string;
  decisionFor?: (logId: string) => Record<string, ProgressionTargetDecision> | null;
}) {
  let state: unknown = opts.startState;
  const events: BlockEvent[] = [];
  let logCounter = 0;
  for (let week = 1; week <= 6; week += 1) {
    const { reps, pct } = WEEK_SCHEME[week]!;
    for (let day = 1; day <= 3; day += 1) {
      logCounter += 1;
      const logId = `${opts.logIdPrefix}-${logCounter}`;
      const sets = operatorSessionSets(day, opts.tm, reps, pct).map((s) => ({
        exerciseName: s.name,
        reps: s.reps,
        weightKg: s.weight,
        meta: {},
      }));
      const reduced = reduceProgressionState({
        program: "operator",
        previousState: state,
        planParams: opts.planParams,
        sets,
        logId,
      });
      const decision = opts.decisionFor ? opts.decisionFor(logId) : null;
      const applied = applyTargetDecisionsToReduced(reduced, decision);
      events.push({ logId, meta: buildProgressionEventMeta(reduced, applied.appliedDecisions) });
      state = applied.nextState;
    }
  }
  return { state: state as any, events };
}

const PLAN_PARAMS = { trainingMaxKg: { SQUAT: 95, BENCH: 95, PULL: 100, DEADLIFT: 70 } };
const TM: TmMap = { SQUAT: 95, BENCH: 95, DEADLIFT: 70, PULL: 100 };

// applyManualRuntimeAdjustment의 머지(가장 최근 로그의 기존 override + 신규 보정).
function mergeManual(
  stored: Record<string, ProgressionTargetDecision> | null,
  manual: Record<string, ProgressionTargetDecision>,
): Record<string, ProgressionTargetDecision> {
  return { ...(stored ?? {}), ...manual };
}

function collectSaved(events: BlockEvent[]) {
  const saved = new Map<string, Record<string, ProgressionTargetDecision>>();
  for (const ev of events) {
    const d = readStoredDecisionsFromMeta(ev.meta);
    if (d) saved.set(ev.logId, d);
  }
  return saved;
}

test("manual: 보정값이 마지막 로그 override에 머지되어 rebuild 후에도 보존된다 (핵심)", () => {
  // 1) 블록1 진행 — 완료 시 자동 +5 → SQUAT 100
  const orig = runBlock({ startState: {}, tm: TM, planParams: PLAN_PARAMS, logIdPrefix: "b1" });
  assert.equal(orig.state.targets.SQUAT.workKg, 100, "자동 +5 → 100");

  // 2) 사용자가 현재 TM을 97.5로 보정 → 가장 최근 로그(b1-18)에 머지
  const lastEvent = orig.events[orig.events.length - 1]!;
  assert.equal(lastEvent.logId, "b1-18");
  const manual: Record<string, ProgressionTargetDecision> = {
    SQUAT: { mode: "reset", workKg: 97.5 },
  };
  const mergedForLast = mergeManual(readStoredDecisionsFromMeta(lastEvent.meta), manual);

  // 3) rebuild 재현 — 저장 override 복원 + 마지막 로그엔 머지본 사용
  const savedByLogId = collectSaved(orig.events);
  savedByLogId.set("b1-18", mergedForLast);

  const rebuilt = runBlock({
    startState: {},
    tm: TM,
    planParams: PLAN_PARAMS,
    logIdPrefix: "b1",
    decisionFor: (logId) => savedByLogId.get(logId) ?? null,
  });
  assert.equal(rebuilt.state.targets.SQUAT.workKg, 97.5, "보정(97.5)이 rebuild 후에도 보존");
  assert.equal(rebuilt.state.targets.SQUAT.successStreak, 0, "보정 운동 streak 리셋");
  assert.equal(rebuilt.state.targets.SQUAT.failureStreak, 0);
  // 보정하지 않은 운동은 자동 결과 유지(BENCH/PULL +2.5)
  assert.equal(rebuilt.state.targets.BENCH.workKg, 97.5, "BENCH 자동 +2.5 유지");
});

test("manual: 같은 로그의 기존 override와 신규 보정이 모두 보존된다 (머지)", () => {
  const stored: Record<string, ProgressionTargetDecision> = {
    SQUAT: { mode: "increase", workKg: 102.5 },
  };
  const manual: Record<string, ProgressionTargetDecision> = {
    BENCH: { mode: "reset", workKg: 95 },
  };
  assert.deepEqual(mergeManual(stored, manual), {
    SQUAT: { mode: "increase", workKg: 102.5 },
    BENCH: { mode: "reset", workKg: 95 },
  });
  // 같은 키면 신규 보정이 덮어쓴다
  const merged2 = mergeManual(stored, { SQUAT: { mode: "reset", workKg: 97.5 } });
  assert.equal(merged2.SQUAT.workKg, 97.5);
});

test("manual: 보정 후 다음 블록 진행 시 정상 증감한다", () => {
  // 블록1 후 SQUAT를 97.5로 보정한 상태를 rebuild로 만든다
  const savedByLogId = new Map<string, Record<string, ProgressionTargetDecision>>();
  savedByLogId.set("b1-18", { SQUAT: { mode: "reset", workKg: 97.5 } });
  const afterAdjust = runBlock({
    startState: {},
    tm: TM,
    planParams: PLAN_PARAMS,
    logIdPrefix: "b1",
    decisionFor: (logId) => savedByLogId.get(logId) ?? null,
  });
  assert.equal(afterAdjust.state.targets.SQUAT.workKg, 97.5);

  // 블록2 진행(자동) → 완료 시 +5 → 102.5 (보정값 기준으로 정상 누적)
  const block2 = runBlock({
    startState: afterAdjust.state,
    tm: TM,
    planParams: PLAN_PARAMS,
    logIdPrefix: "b2",
  });
  assert.equal(block2.state.targets.SQUAT.workKg, 102.5, "보정 97.5 → 블록2 완료 +5 → 102.5");
});
