import assert from "node:assert/strict";
import test from "node:test";
import {
  createMemorySettingStore,
  createSettingUpdateGate,
  resolveSettingInitialValue,
  updateSetting,
} from "./update-setting";

test("resolveSettingInitialValue prefers local cache over server and fallback", () => {
  const store = createMemorySettingStore({
    "prefs.timezone": "Asia/Seoul",
  });
  const resolved = resolveSettingInitialValue({
    key: "prefs.timezone",
    store,
    serverValue: "UTC",
    fallbackValue: "Europe/London",
  });
  assert.equal(resolved, "Asia/Seoul");
});

test("updateSetting applies optimistic value and keeps committed value on success", async () => {
  const store = createMemorySettingStore({
    "prefs.autoSync": false,
  });
  let current = false;
  const applied: boolean[] = [];

  const result = await updateSetting<boolean>({
    key: "prefs.autoSync",
    nextValue: true,
    getCurrentValue: () => current,
    applyValue: (next) => {
      current = next;
      applied.push(next);
    },
    store,
    persistServer: async () => ({ canonicalValue: true }),
  });

  assert.equal(result.ok, true);
  assert.equal(current, true);
  assert.equal(store.read("prefs.autoSync"), true);
  assert.deepEqual(applied, [true]);
});

test("updateSetting rolls back optimistic value when server save fails", async () => {
  const store = createMemorySettingStore({
    "prefs.metricPresetDays": 90,
  });
  let current = 90;
  const applied: number[] = [];

  const result = await updateSetting<number>({
    key: "prefs.metricPresetDays",
    nextValue: 120,
    getCurrentValue: () => current,
    applyValue: (next) => {
      current = next;
      applied.push(next);
    },
    store,
    persistServer: async () => {
      throw new Error("network unavailable");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true);
  assert.equal(result.message, "network unavailable");
  assert.equal(current, 90);
  assert.equal(store.read("prefs.metricPresetDays"), 90);
  assert.deepEqual(applied, [120, 90]);
});

test("createSettingUpdateGate blocks duplicate in-flight update for the same key", async () => {
  const gate = createSettingUpdateGate();
  let executedCount = 0;

  const firstRun = gate.run("prefs.autoSync", async () => {
    executedCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return "first";
  });

  const secondRun = await gate.run("prefs.autoSync", async () => {
    executedCount += 1;
    return "second";
  });

  assert.equal(secondRun.ignored, true);

  const firstResult = await firstRun;
  assert.equal(firstResult.ignored, false);
  if (!firstResult.ignored) {
    assert.equal(firstResult.value, "first");
  }
  assert.equal(executedCount, 1);
});

