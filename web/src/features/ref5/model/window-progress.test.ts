import assert from "node:assert/strict";
import test from "node:test";

import { createInitialRef5State } from "@workout/core/program-engine/ref5";
import { buildRef5Status } from "@workout/core/program-engine/ref5-status";
import {
  buildRef5WindowProgressRows,
  getRef5WindowProgressDescription,
} from "./window-progress";

test("REF5 window rows name hard and focus streams explicitly", () => {
  const state = createInitialRef5State();
  state.mainWindows.SQ.exposures.push({
    eventId: "event-1",
    sessionId: "session-1",
    stream: "SQ_H3",
    outcome: "PASS",
  });

  const rows = buildRef5WindowProgressRows(buildRef5Status(state), "ko");

  assert.deepEqual(
    rows.map(({ label, current, threshold }) => ({ label, current, threshold })),
    [
      { label: "SQ 하드", current: 1, threshold: 6 },
      { label: "BP 집중", current: 0, threshold: 4 },
      { label: "PULL 집중", current: 0, threshold: 4 },
      { label: "DL", current: 0, threshold: 4 },
      { label: "OHP", current: 0, threshold: 4 },
    ],
  );
});

test("REF5 window guidance defines hard and focus plus the volume-fail exception", () => {
  const description = getRef5WindowProgressDescription("ko");

  assert.match(description, /하드 = .*H3\(3×3\).*H2\(3×2\)/);
  assert.match(description, /집중 = .*BP·PULL 3×3/);
  assert.match(description, /볼륨 세트는 횟수에서 제외/);
  assert.match(description, /볼륨 FAIL은 최종 판정에 반영/);
});
