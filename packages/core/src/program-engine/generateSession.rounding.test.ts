import assert from "node:assert/strict";
import test from "node:test";
import { roundToNearest2p5 } from "./round";

test("roundToNearest2p5: Operator W1 stays closest to prescribed percentage", () => {
  // Cycle 1 with TM 95 kg — bar at 67.5 kg.
  assert.equal(roundToNearest2p5(95 * 0.7), 67.5);
  // Cycle 2 with TM 97.5 kg — 68.25 kg remains closer to 67.5 than 70.
  assert.equal(roundToNearest2p5(97.5 * 0.7), 67.5);
});

test("roundToNearest2p5: Operator W6 stays closest to prescribed percentage", () => {
  // 95 × 0.95 = 90.25
  assert.equal(roundToNearest2p5(95 * 0.95), 90);
  // 97.5 × 0.95 = 92.625
  assert.equal(roundToNearest2p5(97.5 * 0.95), 92.5);
});

test("roundToNearest2p5: clean multiples are preserved", () => {
  assert.equal(roundToNearest2p5(70), 70);
  assert.equal(roundToNearest2p5(150 * 0.7), 105);
  assert.equal(roundToNearest2p5(0), 0);
});

test("roundToNearest2p5: non-finite / negative input returns 0", () => {
  assert.equal(roundToNearest2p5(Number.NaN), 0);
  assert.equal(roundToNearest2p5(-1), 0);
  assert.equal(roundToNearest2p5(Number.POSITIVE_INFINITY), 0);
});
