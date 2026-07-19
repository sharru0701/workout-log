import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStatsBootstrapPath,
  STATS_BOOTSTRAP_REQUEST_OPTIONS,
} from "./stats-bootstrap-request";

test("stats bootstrap bypasses persisted SWR data", () => {
  assert.deepEqual(STATS_BOOTSTRAP_REQUEST_OPTIONS, {
    cachePolicy: "network-only",
    dedupe: true,
  });
});

test("stats bootstrap forwards only supported filters", () => {
  const params = new URLSearchParams({
    exerciseId: "exercise-1",
    planId: "plan-1",
    ignored: "stale-value",
  });

  assert.equal(
    buildStatsBootstrapPath(params),
    "/api/stats/page-bootstrap?exerciseId=exercise-1&planId=plan-1",
  );
});
