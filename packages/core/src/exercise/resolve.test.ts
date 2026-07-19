import assert from "node:assert/strict";
import test from "node:test";

import { selectResolvedExerciseId } from "./resolve";

test("a valid submitted exercise ID takes precedence", () => {
  assert.equal(
    selectResolvedExerciseId({
      submittedExerciseId: "current-id",
      exerciseName: "Pull-Up",
      resolvedById: new Map([["current-id", "current-id"]]),
      resolvedByName: new Map([["pull-up", "canonical-id"]]),
    }),
    "current-id",
  );
});

test("a stale merged exercise ID falls back to its canonical name", () => {
  assert.equal(
    selectResolvedExerciseId({
      submittedExerciseId: "removed-weighted-id",
      exerciseName: "Weighted Pull-Up",
      resolvedById: new Map([["removed-weighted-id", null]]),
      resolvedByName: new Map([["weighted pull-up", "pull-up-id"]]),
    }),
    "pull-up-id",
  );
});
