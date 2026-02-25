import assert from "node:assert/strict";
import test from "node:test";
import { settingsSearchIndex } from "./settings-search-index";
import { searchSettingsIndex, splitSearchTokens } from "./settings-search";

test("splitSearchTokens trims and splits whitespace", () => {
  assert.deepEqual(splitSearchTokens("  플랜   생성  "), ["플랜", "생성"]);
});

test("searchSettingsIndex finds timezone-related deep links", () => {
  const results = searchSettingsIndex(settingsSearchIndex, "시간대");
  const keys = results.map((result) => result.entry.key);

  assert.ok(keys.includes("plans.context.timezone"));
  assert.ok(keys.includes("calendar.options.timezone"));
});

test("searchSettingsIndex prioritizes direct title match", () => {
  const results = searchSettingsIndex(settingsSearchIndex, "오프라인");

  assert.ok(results.length > 0);
  assert.equal(results[0]?.entry.key, "offline.help");
});

test("searchSettingsIndex returns empty list when no match exists", () => {
  const results = searchSettingsIndex(settingsSearchIndex, "unmatchable-query-123");
  assert.equal(results.length, 0);
});
