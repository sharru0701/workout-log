import assert from "node:assert/strict";
import test from "node:test";

import { resolveRef5PlanStartConfig } from "./ref5-plan-creation";

const defaults = {
  ref5: {
    startingValuesKg: {
      sqH3Kg: 82.5,
      bpFocusKg: 82.5,
      pullFocusTotalKg: 87.5,
      deadliftKg: 72.5,
      ohpKg: 32.5,
    },
  },
};

test("REF5 plan creation accepts submitted starts and derives trusted REFs", () => {
  const starts = {
    sqH3Kg: 90,
    bpFocusKg: 90,
    pullFocusTotalKg: 100,
    deadliftKg: 80,
    ohpKg: 35,
  };
  const resolved = resolveRef5PlanStartConfig(
    { ref5: { startingValuesKg: starts, controlRefsKg: { sqKg: 999 } } },
    defaults,
  );
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.deepEqual(resolved.value.startingValuesKg, starts);
  assert.notEqual(resolved.value.controlRefsKg.sqKg, 999);
});

test("REF5 plan creation falls back only when starts are absent and rejects partial input", () => {
  const fallback = resolveRef5PlanStartConfig({}, defaults);
  assert.equal(fallback.ok, true);
  if (fallback.ok) {
    assert.deepEqual(fallback.value.startingValuesKg, defaults.ref5.startingValuesKg);
  }

  const partial = resolveRef5PlanStartConfig(
    { ref5: { startingValuesKg: { sqH3Kg: 90 } } },
    defaults,
  );
  assert.equal(partial.ok, false, "explicit partial input must not be filled silently");
});

test("REF5 plan creation threads ohpMicroloading and accepts a 1.25 kg OHP start (§5.1)", () => {
  const starts = {
    sqH3Kg: 82.5,
    bpFocusKg: 82.5,
    pullFocusTotalKg: 87.5,
    deadliftKg: 72.5,
    ohpKg: 31.25,
  };
  const on = resolveRef5PlanStartConfig(
    { ref5: { startingValuesKg: starts, ohpMicroloading: true } },
    defaults,
  );
  assert.equal(on.ok, true);
  if (on.ok) {
    assert.equal(on.value.ohpMicroloading, true);
    assert.equal(on.value.startingValuesKg.ohpKg, 31.25);
  }

  // The same 1.25 kg OHP start is off-grid without the toggle.
  const off = resolveRef5PlanStartConfig(
    { ref5: { startingValuesKg: starts } },
    defaults,
  );
  assert.equal(off.ok, false, "1.25 kg OHP start requires ohpMicroloading");

  // Falling back to defaults leaves ohpMicroloading off.
  const fallback = resolveRef5PlanStartConfig({}, defaults);
  assert.equal(fallback.ok, true);
  if (fallback.ok) assert.equal(fallback.value.ohpMicroloading, false);
});
