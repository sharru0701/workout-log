import assert from "node:assert/strict";
import test from "node:test";

import {
  addDaysToDateKey,
  deriveSessionLabel,
  deriveSessionTypeLabel,
} from "./session-labels";

test("deriveSessionLabel builds a badge from cycle/wave keys", () => {
  assert.equal(deriveSessionLabel("C2W3D1"), "C2W3D1");
  assert.equal(deriveSessionLabel("2026-07-22@C4W1D2"), "C4W1D2");
  assert.equal(deriveSessionLabel("W3D1"), "W3D1");
});

test("deriveSessionLabel returns null when the key carries no coordinates", () => {
  assert.equal(deriveSessionLabel("2026-07-22"), null);
  assert.equal(deriveSessionLabel(""), null);
  assert.equal(deriveSessionLabel(null), null);
  assert.equal(deriveSessionLabel("nonsense"), null);
});

test("deriveSessionTypeLabel drops types that repeat the badge", () => {
  assert.equal(
    deriveSessionTypeLabel({ sessionType: "W3D1", day: 1, sessionLabel: "W3D1" }),
    null,
  );
  // 배지가 이미 일차를 보여주므로 "…D1"로 끝나는 타입은 중복.
  assert.equal(
    deriveSessionTypeLabel({ sessionType: "Upper D1", day: 1, sessionLabel: "W3D1" }),
    null,
  );
});

test("deriveSessionTypeLabel keeps a distinct type and trims it", () => {
  assert.equal(
    deriveSessionTypeLabel({ sessionType: "  Squat Focus  ", day: 1, sessionLabel: "W3D1" }),
    "Squat Focus",
  );
  // 배지가 없으면 중복 판정 자체가 없다.
  assert.equal(
    deriveSessionTypeLabel({ sessionType: "Upper D1", day: 1, sessionLabel: null }),
    "Upper D1",
  );
  assert.equal(
    deriveSessionTypeLabel({ sessionType: "   ", day: 1, sessionLabel: null }),
    null,
  );
});

test("addDaysToDateKey crosses month and year boundaries", () => {
  assert.equal(addDaysToDateKey("2026-07-22", 1), "2026-07-23");
  assert.equal(addDaysToDateKey("2026-07-01", -1), "2026-06-30");
  assert.equal(addDaysToDateKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysToDateKey("2024-02-28", 1), "2024-02-29");
});

test("addDaysToDateKey rejects unusable input", () => {
  assert.equal(addDaysToDateKey("", 1), null);
  assert.equal(addDaysToDateKey("not-a-date", 1), null);
});
