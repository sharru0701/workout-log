import assert from "node:assert/strict";
import test from "node:test";

import {
  EXERCISE_CATALOG,
  EXERCISE_NAMES,
  LEGACY_EXERCISE_NAME_FALLBACKS,
  canonicalExerciseNameForInput,
} from "./catalog";

test("squat variants are separate canonical exercises", () => {
  const canonicalNames = new Set<string>(EXERCISE_CATALOG.map((item) => item.name));

  assert.ok(canonicalNames.has(EXERCISE_NAMES.highBarBackSquat));
  assert.ok(canonicalNames.has(EXERCISE_NAMES.lowBarBackSquat));
  assert.ok(canonicalNames.has(EXERCISE_NAMES.frontSquat));
  assert.equal(canonicalNames.has("Back Squat"), false);
});

test("legacy Back Squat resolves only as a high-bar alias", () => {
  const owners = EXERCISE_CATALOG.filter((item) =>
    item.aliases.some((alias) => alias === "Back Squat"),
  );

  assert.deepEqual(owners.map((item) => item.name), [EXERCISE_NAMES.highBarBackSquat]);
});

test("weighted and unweighted pull-ups share one canonical exercise", () => {
  const canonicalNames = new Set<string>(EXERCISE_CATALOG.map((item) => item.name));

  assert.ok(canonicalNames.has(EXERCISE_NAMES.pullUp));
  assert.equal(canonicalNames.has(EXERCISE_NAMES.weightedPullUp), false);
  for (const input of [
    "Pull-Up",
    "Pull Up",
    "Weighted Pull-Up",
    "Weighted Pull Up",
    "중량 풀업",
    "중량풀업",
  ]) {
    assert.equal(canonicalExerciseNameForInput(input), EXERCISE_NAMES.pullUp);
  }
});

test("catalog aliases have one canonical owner", () => {
  const aliases = EXERCISE_CATALOG.flatMap((item) => [...item.aliases]);
  const normalized = aliases.map((alias) => alias.trim().toLowerCase());

  assert.equal(new Set(normalized).size, normalized.length);
});

test("rollout fallbacks cover the two canonical names absent before migration", () => {
  assert.deepEqual(LEGACY_EXERCISE_NAME_FALLBACKS, {
    [EXERCISE_NAMES.highBarBackSquat]: "Back Squat",
    [EXERCISE_NAMES.weightedPullUp]: EXERCISE_NAMES.pullUp,
  });
});
