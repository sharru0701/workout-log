import assert from "node:assert/strict";
import test from "node:test";
import { reduceProgressionState } from "./reducer";

test("operator: successful session advances day with no immediate load increase", () => {
  const result = reduceProgressionState({
    program: "operator",
    previousState: null,
    planParams: {
      trainingMaxKg: {
        SQUAT: 150,
        BENCH: 110,
        DEADLIFT: 190,
      },
    },
    logId: "log-1",
    sets: [
      { exerciseName: "Back Squat", reps: 5, weightKg: 105, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Back Squat", reps: 5, weightKg: 105, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Back Squat", reps: 5, weightKg: 105, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Bench Press", reps: 5, weightKg: 77.5, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Bench Press", reps: 5, weightKg: 77.5, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Bench Press", reps: 5, weightKg: 77.5, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Deadlift", reps: 5, weightKg: 132.5, meta: { plannedRef: { reps: 5 } } },
    ],
  });

  assert.equal(result.eventType, "ADVANCE_WEEK");
  assert.equal(result.didAdvanceSession, true);
  assert.equal(result.nextState.day, 2);
  assert.equal(result.nextState.week, 1);
  assert.equal(result.nextState.targets.SQUAT?.workKg, 150);
});

test("operator: increase after configured success streak threshold", () => {
  const result = reduceProgressionState({
    program: "operator",
    previousState: {
      cycle: 1,
      week: 2,
      day: 3,
      lastAppliedLogId: "older-log",
      targets: {
        SQUAT: { workKg: 150, successStreak: 2, failureStreak: 0 },
        BENCH: { workKg: 110, successStreak: 2, failureStreak: 0 },
        DEADLIFT: { workKg: 190, successStreak: 2, failureStreak: 0 },
      },
    },
    planParams: {},
    logId: "log-2",
    sets: [
      { exerciseName: "Back Squat", reps: 5, weightKg: 112.5, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Bench Press", reps: 5, weightKg: 82.5, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Deadlift", reps: 5, weightKg: 142.5, meta: { plannedRef: { reps: 5 } } },
    ],
  });

  assert.equal(result.eventType, "INCREASE");
  assert.equal(result.nextState.targets.SQUAT?.workKg, 152.5);
  assert.equal(result.nextState.targets.BENCH?.workKg, 112.5);
  assert.equal(result.nextState.targets.DEADLIFT?.workKg, 195);
  assert.equal(result.nextState.targets.SQUAT?.successStreak, 0);
});

test("greyskull: reset after failure streak threshold", () => {
  const result = reduceProgressionState({
    program: "greyskull-lp",
    previousState: {
      cycle: 1,
      week: 1,
      day: 1,
      lastAppliedLogId: "older-log",
      targets: {
        SQUAT: { workKg: 100, successStreak: 0, failureStreak: 2 },
      },
    },
    planParams: {},
    logId: "log-3",
    sets: [
      { exerciseName: "Back Squat", reps: 3, weightKg: 100, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Back Squat", reps: 4, weightKg: 100, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Back Squat", reps: 2, weightKg: 100, meta: { plannedRef: { reps: 5 } } },
    ],
  });

  assert.equal(result.eventType, "RESET");
  assert.equal(result.nextState.targets.SQUAT?.workKg, 90);
  assert.equal(result.nextState.targets.SQUAT?.failureStreak, 0);
});
