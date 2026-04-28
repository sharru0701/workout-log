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
});
