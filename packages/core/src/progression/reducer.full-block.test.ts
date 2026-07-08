import assert from "node:assert/strict";
import test from "node:test";
import { reduceProgressionState } from "./reducer";

type LogSet = { name: string; reps: number; weight: number };

function makeOperatorRunner(planParams: Record<string, unknown>) {
  let state: any = {};
  let logCounter = 0;
  const log = (sets: LogSet[]) => {
    logCounter += 1;
    const result = reduceProgressionState({
      program: "operator",
      previousState: state,
      planParams,
      logId: `log-${logCounter}`,
      sets: sets.map((s) => ({
        exerciseName: s.name,
        reps: s.reps,
        weightKg: s.weight,
        meta: {}, // Real save path passes only memo / bodyweight in meta.
      })),
    });
    state = result.nextState;
    return result;
  };
  return {
    log,
    getState: () => state,
  };
}

function operatorSessionSets(
  week: number,
  day: number,
  tm: { SQUAT: number; BENCH: number; DEADLIFT: number; PULL: number },
  reps: number,
  pct: number,
): LogSet[] {
  const round = (v: number) => Math.round(v * 100) / 100;
  const exercises = day === 3
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
  void week; // included for documentation; weight is independent of week
  return exercises.flatMap((ex) =>
    Array.from({ length: 3 }, () => ({ name: ex.name, reps, weight: ex.weight })),
  );
}

const WEEK_SCHEME: Record<number, { reps: number; pct: number }> = {
  1: { reps: 5, pct: 0.7 },
  2: { reps: 5, pct: 0.8 },
  3: { reps: 3, pct: 0.9 },
  4: { reps: 5, pct: 0.75 },
  5: { reps: 3, pct: 0.85 },
  6: { reps: 1, pct: 0.95 },
};

const TM = { SQUAT: 150, BENCH: 110, DEADLIFT: 190, PULL: 57.5 };

// Simulate full operator block (W1D1..W6D3) with the exact meta shape that
// `toWorkoutLogPayload` (lib/workout-record/model.ts) produces — i.e. NO
// `plannedRef` field. This exercises the real save path, not the synthetic
// shape used in reducer.test.ts.
test("operator: full 18-session block with empty meta should still increase TM", () => {
  const runner = makeOperatorRunner({ trainingMaxKg: { ...TM } });
  let lastResult: any = null;
  for (let week = 1; week <= 6; week += 1) {
    const { reps, pct } = WEEK_SCHEME[week]!;
    for (let day = 1; day <= 3; day += 1) {
      lastResult = runner.log(operatorSessionSets(week, day, TM, reps, pct));
    }
  }

  const state = runner.getState();
  // After w6d3, expect new cycle starting at w1d1 with bumped TMs.
  assert.equal(state.cycle, 2, "cycle should advance to 2");
  assert.equal(state.week, 1, "week should reset to 1");
  assert.equal(state.day, 1, "day should reset to 1");
  assert.equal(lastResult?.eventType, "INCREASE", "last event should be INCREASE");
  assert.equal(state.targets.SQUAT?.workKg, 155);
  assert.equal(state.targets.BENCH?.workKg, 112.5);
  assert.equal(state.targets.DEADLIFT?.workKg, 195);
  assert.equal(state.targets.PULL?.workKg, 60);
});

// Regression: a single mid-block fail (e.g. one PULL set logged with reps=0
// during W3D1) should not permanently disable the block-end auto-increase
// once the user recovers in subsequent sessions. The doc states the
// progression is tied to BLOCK COMPLETION, not "no-failures-anywhere".
test("operator: mid-block fail with later recovery should still trigger block-end increase", () => {
  const runner = makeOperatorRunner({ trainingMaxKg: { ...TM } });
  let lastResult: any = null;
  for (let week = 1; week <= 6; week += 1) {
    const { reps, pct } = WEEK_SCHEME[week]!;
    for (let day = 1; day <= 3; day += 1) {
      const sets = operatorSessionSets(week, day, TM, reps, pct);
      // Force a single PULL set to log reps=0 in W3D1 (a stumble).
      if (week === 3 && day === 1) {
        const idx = sets.findIndex((s) => s.name === "Pull-Up");
        if (idx >= 0) sets[idx] = { ...sets[idx]!, reps: 0 };
      }
      lastResult = runner.log(sets);
    }
  }

  const state = runner.getState();
  assert.equal(state.cycle, 2, "cycle should advance after block completion");
  assert.equal(lastResult?.eventType, "INCREASE", "block-end event should be INCREASE");
  assert.equal(state.targets.PULL?.workKg, 60, "PULL must still bump after recovery");
  assert.equal(state.targets.SQUAT?.workKg, 155);
  assert.equal(state.targets.BENCH?.workKg, 112.5);
  assert.equal(state.targets.DEADLIFT?.workKg, 195);
});

// Asymptote Protocol: 4 사이클 × 3 세션 = 12 세션 풀 블록 시뮬레이션.
// 사이클 3 AMRAP 마지막 세트의 actual reps가 TM 변동을 결정한다.
function makeAsymptoteRunner(planParams: Record<string, unknown>) {
  let state: any = {};
  let logCounter = 0;
  const log = (sets: Array<{ name: string; reps: number; weight: number }>) => {
    logCounter += 1;
    const result = reduceProgressionState({
      program: "asymptote",
      previousState: state,
      planParams,
      logId: `log-${logCounter}`,
      sets: sets.map((s) => ({
        exerciseName: s.name,
        reps: s.reps,
        weightKg: s.weight,
        meta: {},
      })),
    });
    state = result.nextState;
    return result;
  };
  return { log, getState: () => state };
}

// Helper: produce sets for a single asymptote session.
// `cycleAmrapReps` overrides the last-set reps of AMRAP-tagged lifts on cycle 3.
function asymptoteSessionSets(
  cycleInBlock: number, // 1..4
  sessionInCycle: number, // 1..3 (A/B/C)
  cycleAmrapReps?: Partial<Record<"SQUAT" | "BENCH" | "PULL", number>>,
): Array<{ name: string; reps: number; weight: number }> {
  const ROWS: Record<
    number,
    Array<{ name: string; target: "SQUAT" | "BENCH" | "PULL" | "DEADLIFT" | "OHP"; sets: number; reps: number; amrap: boolean }>
  > = {
    1: [
      { name: "Back Squat", target: "SQUAT", sets: 4, reps: 3, amrap: true },
      { name: "Bench Press", target: "BENCH", sets: 4, reps: 5, amrap: false },
      { name: "Weighted Pull-Up", target: "PULL", sets: 4, reps: 3, amrap: true },
    ],
    2: [
      { name: "Back Squat", target: "SQUAT", sets: 5, reps: 5, amrap: false },
      { name: "Deadlift", target: "DEADLIFT", sets: 3, reps: 3, amrap: false },
      { name: "Weighted Pull-Up", target: "PULL", sets: 3, reps: 8, amrap: false },
    ],
    3: [
      { name: "Back Squat", target: "SQUAT", sets: 6, reps: 3, amrap: false },
      { name: "Bench Press", target: "BENCH", sets: 4, reps: 3, amrap: true },
      { name: "Overhead Press", target: "OHP", sets: 4, reps: 5, amrap: false },
    ],
  };
  const rows = ROWS[sessionInCycle]!;
  const out: Array<{ name: string; reps: number; weight: number }> = [];
  for (const row of rows) {
    for (let i = 0; i < row.sets; i += 1) {
      const isLastSet = i === row.sets - 1;
      const isAmrapSet = cycleInBlock === 3 && row.amrap && isLastSet;
      const reps =
        isAmrapSet && cycleAmrapReps && cycleAmrapReps[row.target as "SQUAT" | "BENCH" | "PULL"] !== undefined
          ? cycleAmrapReps[row.target as "SQUAT" | "BENCH" | "PULL"]!
          : row.reps;
      out.push({ name: row.name, reps, weight: 50 });
    }
  }
  return out;
}

test("asymptote: full 12-session block applies AMRAP-driven TM deltas", () => {
  const initialTm = { SQUAT: 95, BENCH: 75, PULL: 97.5, DEADLIFT: 95, OHP: 35 };
  const runner = makeAsymptoteRunner({ trainingMaxKg: { ...initialTm } });
  let lastResult: any = null;

  // Cycles 1, 2: normal sessions (no AMRAP)
  for (let cycle = 1; cycle <= 2; cycle += 1) {
    for (let session = 1; session <= 3; session += 1) {
      lastResult = runner.log(asymptoteSessionSets(cycle, session));
    }
  }
  // Cycle 3: hit AMRAP on the relevant sessions
  //   Session A → SQ 8 reps (→ +2.5), PULL 6 reps (→ hold)
  //   Session C → BP 3 reps (→ -2.5)
  lastResult = runner.log(asymptoteSessionSets(3, 1, { SQUAT: 8, PULL: 6 }));
  lastResult = runner.log(asymptoteSessionSets(3, 2));
  lastResult = runner.log(asymptoteSessionSets(3, 3, { BENCH: 3 }));
  // Cycle 4: deload sessions
  for (let session = 1; session <= 3; session += 1) {
    lastResult = runner.log(asymptoteSessionSets(4, session));
  }

  const state = runner.getState();
  assert.equal(state.cycle, 2, "block number should advance to 2 after 12-session block");
  assert.equal(state.week, 1, "cycle-within-block should reset to 1");
  assert.equal(state.day, 1, "session-within-cycle should reset to 1");
  assert.equal(state.targets.SQUAT?.workKg, 97.5, "SQUAT TM +2.5 (AMRAP 8)");
  assert.equal(state.targets.BENCH?.workKg, 72.5, "BENCH TM -2.5 (AMRAP 3)");
  assert.equal(state.targets.PULL?.workKg, 97.5, "PULL TM hold (AMRAP 6)");
  // Auxiliary derivation: DL = new SQ, OHP = floor(new BP × 0.5 / 2.5) × 2.5
  assert.equal(state.targets.DEADLIFT?.workKg, 97.5, "DL TM tracks new SQ TM");
  assert.equal(state.targets.OHP?.workKg, 35, "OHP TM = floor(72.5 × 0.5 / 2.5) × 2.5 = 35");
  assert.equal(state.lightBlockMode, false, "no AMRAP ≤2, so no light block");
  void lastResult;
});

test("asymptote: AMRAP ≤2 on any main lift triggers light block flag", () => {
  const runner = makeAsymptoteRunner({
    trainingMaxKg: { SQUAT: 95, BENCH: 75, PULL: 97.5, DEADLIFT: 95, OHP: 35 },
  });

  for (let cycle = 1; cycle <= 2; cycle += 1) {
    for (let session = 1; session <= 3; session += 1) {
      runner.log(asymptoteSessionSets(cycle, session));
    }
  }
  // Cycle 3 Session A — disastrous AMRAP on SQUAT (2 reps)
  runner.log(asymptoteSessionSets(3, 1, { SQUAT: 2, PULL: 6 }));
  runner.log(asymptoteSessionSets(3, 2));
  runner.log(asymptoteSessionSets(3, 3, { BENCH: 6 }));
  for (let session = 1; session <= 3; session += 1) {
    runner.log(asymptoteSessionSets(4, session));
  }

  const state = runner.getState();
  assert.equal(state.targets.SQUAT?.workKg, 90, "SQUAT TM -5 on AMRAP ≤2");
  assert.equal(state.lightBlockMode, true, "light block flag should be set");
  // DL tracks new SQ
  assert.equal(state.targets.DEADLIFT?.workKg, 90, "DL TM tracks new SQ");
});

// Sanity: a real, non-recovered failure on the FINAL session of the block
// should still hold (no auto-increase) — the prompt remains the user's
// channel to override.
test("operator: unresolved failure in the final session should not auto-increase", () => {
  const runner = makeOperatorRunner({ trainingMaxKg: { ...TM } });
  let lastResult: any = null;
  for (let week = 1; week <= 6; week += 1) {
    const { reps, pct } = WEEK_SCHEME[week]!;
    for (let day = 1; day <= 3; day += 1) {
      const sets = operatorSessionSets(week, day, TM, reps, pct);
      // Fail one SQUAT set in W6D3 (the block-end session).
      if (week === 6 && day === 3) {
        const idx = sets.findIndex((s) => s.name === "Back Squat");
        if (idx >= 0) sets[idx] = { ...sets[idx]!, reps: 0 };
      }
      lastResult = runner.log(sets);
    }
  }

  const state = runner.getState();
  assert.equal(state.cycle, 2, "cycle should still advance");
  assert.notEqual(lastResult?.eventType, "INCREASE", "should not auto-increase on a failed final session");
  assert.equal(state.targets.SQUAT?.workKg, 150, "SQUAT TM must hold on final-session failure");
  assert.equal(state.targets.PULL?.workKg, 57.5, "PULL TM must hold");
  // 공통 피드백 레이어: 블록 완주 동결은 기존 완전 무기록이었다 — 이제 원인 리프트가
  // reason에 남는다(판정 불변: 위의 TM 유지·cycle 전진 단언이 그대로 통과해야 한다).
  assert.equal(lastResult?.reason, "freeze:block:failed=SQUAT", "동결 사유 기록");
});
