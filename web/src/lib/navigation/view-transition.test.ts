import assert from "node:assert/strict";
import test from "node:test";
import { shouldUseViewTransition } from "./view-transition";

test("skips view transitions for settings root to child sheet navigation", () => {
  assert.equal(shouldUseViewTransition("/settings", "/settings/theme"), false);
});

test("skips view transitions when closing back to settings root", () => {
  assert.equal(shouldUseViewTransition("/settings/theme", "/settings"), false);
});

test("skips view transitions between settings child routes", () => {
  assert.equal(shouldUseViewTransition("/settings/theme", "/settings/about"), false);
});

test("keeps view transitions for non-settings navigation", () => {
  assert.equal(shouldUseViewTransition("/stats", "/calendar"), true);
});

test("keeps view transitions when entering settings from another tab", () => {
  assert.equal(shouldUseViewTransition("/stats", "/settings"), true);
});
