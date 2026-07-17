import assert from "node:assert/strict";
import test from "node:test";
import { getTableColumns } from "drizzle-orm";
import { workoutSet } from "./schema";

test("workout_set.rpe stores the half-step values accepted by workout clients", () => {
  assert.equal(getTableColumns(workoutSet).rpe.getSQLType(), "numeric(3, 1)");
});
