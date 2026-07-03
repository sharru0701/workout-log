import assert from "node:assert/strict";
import test from "node:test";
import { validateExportShape } from "./validateExportShape";

const baseValidShape = {
  version: 1,
  exportedAt: "2026-05-07T00:00:00.000Z",
  userId: "user-1",
  templates: [],
  templateVersions: [],
  plans: [],
  planModules: [],
  planOverrides: [],
  generatedSessions: [],
  workoutLogs: [],
  workoutSets: [],
  exercises: [],
  exerciseAliases: [],
};

test("validateExportShape: minimal valid v1 export passes", () => {
  const result = validateExportShape(baseValidShape);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("validateExportShape: rejects non-object input", () => {
  const result = validateExportShape("not an object");
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test("validateExportShape: rejects null input", () => {
  const result = validateExportShape(null);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test("validateExportShape: rejects unsupported version", () => {
  const result = validateExportShape({ ...baseValidShape, version: 99 });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes("unsupported export version")),
    `expected unsupported version error, got: ${result.errors.join(", ")}`,
  );
});

test("validateExportShape: rejects missing userId", () => {
  const { userId: _omit, ...rest } = baseValidShape;
  void _omit;
  const result = validateExportShape(rest);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("userId")));
});

test("validateExportShape: rejects non-array required fields", () => {
  const result = validateExportShape({
    ...baseValidShape,
    workoutLogs: "not an array",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("workoutLogs")));
});

test("validateExportShape: rejects when required arrays missing", () => {
  const partial: Record<string, unknown> = { ...baseValidShape };
  delete partial.workoutSets;
  const result = validateExportShape(partial);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("workoutSets")));
});

test("validateExportShape: collects multiple errors", () => {
  const broken = {
    ...baseValidShape,
    version: "abc", // not a number
    userId: 123, // not a string
  };
  const result = validateExportShape(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 2);
});
