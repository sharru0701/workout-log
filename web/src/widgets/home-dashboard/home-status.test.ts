import assert from "node:assert/strict";
import test from "node:test";
import { isHomeWorkoutComplete } from "./home-status";

test("saved REF5 workout is complete when no preview set count exists", () => {
  assert.equal(
    isHomeWorkoutComplete({
      hasCompletedWorkout: true,
      completedSets: 9,
      loggedExercises: [],
      totalPlannedSets: 0,
    }),
    true,
  );
});

test("older cached payload falls back to logged exercises", () => {
  assert.equal(
    isHomeWorkoutComplete({
      completedSets: 9,
      loggedExercises: [{ name: "High-Bar Back Squat", bestSet: "82.5 kg × 3" }],
      totalPlannedSets: 0,
    }),
    true,
  );
});

test("empty REF5 start state is not complete", () => {
  assert.equal(
    isHomeWorkoutComplete({
      hasCompletedWorkout: false,
      completedSets: 0,
      loggedExercises: [],
      totalPlannedSets: 0,
    }),
    false,
  );
});
