import assert from "node:assert/strict";
import test from "node:test";
import { reduceProgressionState, resolveAutoProgressionProgram } from "./reducer";

test("resolveAutoProgressionProgram detects custom operator templates from definition", () => {
  assert.equal(
    resolveAutoProgressionProgram("tactical-barbell-operator-custom", {
      kind: "manual",
      operatorStyle: true,
      programFamily: "operator",
    }),
    "operator",
  );
  assert.equal(
    resolveAutoProgressionProgram("my-custom-greyskull", {
      kind: "greyskull-lp",
    }),
    "greyskull-lp",
  );
});

test("operator: successful base day advances day with no immediate load increase", () => {
  const result = reduceProgressionState({
    program: "operator",
    previousState: null,
    planParams: {
      trainingMaxKg: {
        SQUAT: 150,
        BENCH: 110,
        DEADLIFT: 190,
        PULL: 57.5,
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
      { exerciseName: "Pull-Up", reps: 5, weightKg: 40, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Pull-Up", reps: 5, weightKg: 40, meta: { plannedRef: { reps: 5 } } },
      { exerciseName: "Pull-Up", reps: 5, weightKg: 40, meta: { plannedRef: { reps: 5 } } },
    ],
  });

  assert.equal(result.eventType, "ADVANCE_WEEK");
  assert.equal(result.didAdvanceSession, true);
  assert.equal(result.nextState.day, 2);
  assert.equal(result.nextState.week, 1);
  assert.equal(result.nextState.targets.SQUAT?.workKg, 150);
  assert.equal(result.nextState.targets.PULL?.workKg, 57.5);
});

test("operator: increase after successful 6-week block completion", () => {
  const result = reduceProgressionState({
    program: "operator",
    previousState: {
      cycle: 1,
      week: 6,
      day: 3,
      lastAppliedLogId: "older-log",
      targets: {
        SQUAT: { progressionTarget: "SQUAT", workKg: 150, successStreak: 17, failureStreak: 0 },
        BENCH: { progressionTarget: "BENCH", workKg: 110, successStreak: 17, failureStreak: 0 },
        DEADLIFT: { progressionTarget: "DEADLIFT", workKg: 190, successStreak: 5, failureStreak: 0 },
        PULL: { progressionTarget: "PULL", workKg: 57.5, successStreak: 11, failureStreak: 0 },
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
  assert.equal(result.didAdvanceSession, true);
  assert.equal(result.nextState.cycle, 2);
  assert.equal(result.nextState.week, 1);
  assert.equal(result.nextState.day, 1);
  assert.equal(result.nextState.targets.SQUAT?.workKg, 152.5);
  assert.equal(result.nextState.targets.BENCH?.workKg, 112.5);
  assert.equal(result.nextState.targets.DEADLIFT?.workKg, 195);
  assert.equal(result.nextState.targets.PULL?.workKg, 60);
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
        SQUAT: { progressionTarget: "SQUAT", workKg: 100, successStreak: 0, failureStreak: 2 },
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

test("operator: distinct exercise progression keys stay independent within same target family", () => {
  const result = reduceProgressionState({
    program: "operator",
    previousState: null,
    planParams: {
      trainingMaxKg: {
        EX_PULL_UP: 60,
        EX_BARBELL_ROW: 80,
      },
    },
    logId: "log-4",
    sets: [
      {
        exerciseName: "Pull-Up",
        reps: 5,
        weightKg: 15,
        meta: { plannedRef: { reps: 5, progressionTarget: "PULL", progressionKey: "EX_PULL_UP", progressionLabel: "Pull-Up" } },
      },
      {
        exerciseName: "Barbell Row",
        reps: 5,
        weightKg: 60,
        meta: { plannedRef: { reps: 5, progressionTarget: "PULL", progressionKey: "EX_BARBELL_ROW", progressionLabel: "Barbell Row" } },
      },
    ],
  });

  assert.equal(result.nextState.targets.EX_PULL_UP?.progressionTarget, "PULL");
  assert.equal(result.nextState.targets.EX_BARBELL_ROW?.progressionTarget, "PULL");
  assert.equal(result.nextState.targets.EX_PULL_UP?.workKg, 60);
  assert.equal(result.nextState.targets.EX_BARBELL_ROW?.workKg, 80);
  assert.notEqual(result.nextState.targets.EX_PULL_UP?.workKg, result.nextState.targets.EX_BARBELL_ROW?.workKg);
});
