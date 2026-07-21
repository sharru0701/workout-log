import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_PLAN_SETTING_KEY,
  readActivePlanIdSetting,
  resolveActivePlan,
} from "./active-plan";

const oldPlan = {
  id: "old",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastPerformedAt: "2026-07-01T00:00:00.000Z",
};
const newPlan = {
  id: "new",
  createdAt: "2026-07-20T00:00:00.000Z",
  lastPerformedAt: null,
};

test("the pinned active plan wins over the last-performed heuristic", () => {
  // 새 플랜은 기록이 0건이라 lastPerformedAt 규칙에서는 항상 진다 — 바로 이 지점에서
  // 홈이 옛 플랜을 계속 가리켰다.
  assert.equal(resolveActivePlan([oldPlan, newPlan], "new")?.id, "new");
  assert.equal(resolveActivePlan([oldPlan, newPlan], null)?.id, "old");
});

test("a stale or archived pin falls back to the heuristic", () => {
  assert.equal(resolveActivePlan([oldPlan, newPlan], "deleted-plan")?.id, "old");
  assert.equal(
    resolveActivePlan([oldPlan, { ...newPlan, isArchived: true }], "new")?.id,
    "old",
    "보관된 플랜은 활성으로 뽑히지 않는다",
  );
});

test("with no performed plans the newest plan wins", () => {
  const a = { id: "a", createdAt: "2026-05-01T00:00:00.000Z" };
  const b = { id: "b", createdAt: "2026-06-01T00:00:00.000Z" };
  assert.equal(resolveActivePlan([a, b], null)?.id, "b");
  assert.equal(resolveActivePlan([], null), null);
});

test("the active plan setting is read as a trimmed non-empty string", () => {
  assert.equal(readActivePlanIdSetting({ [ACTIVE_PLAN_SETTING_KEY]: " plan-1 " }), "plan-1");
  assert.equal(readActivePlanIdSetting({ [ACTIVE_PLAN_SETTING_KEY]: "" }), null);
  assert.equal(readActivePlanIdSetting({ [ACTIVE_PLAN_SETTING_KEY]: 42 }), null);
  assert.equal(readActivePlanIdSetting(null), null);
});
