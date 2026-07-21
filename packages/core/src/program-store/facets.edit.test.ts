import assert from "node:assert/strict";
import test from "node:test";

import {
  applyEditableFacetSelection,
  readEditableFacetSelection,
} from "./facets";

test("editable facet selection round-trips through tags", () => {
  const tags = ["manual", "strength", "novice", "linear"];
  const selection = readEditableFacetSelection(tags);
  assert.deepEqual(selection, {
    goal: ["strength"],
    level: ["beginner"],
    style: ["linear"],
  });
  // 저장은 대표 철자로 고정된다(beginner → "novice").
  assert.deepEqual(applyEditableFacetSelection(tags, selection).sort(), tags.sort());
});

test("unknown tags survive an edit", () => {
  // barbell·operator는 편집 UI가 다루지 않는 자유 태그다. 조용히 지워지면
  // 프로그램이 들고 있던 정보가 사라진다.
  const next = applyEditableFacetSelection(
    ["manual", "barbell", "operator", "linear", "amrap"],
    { style: ["block"] },
  );
  assert.deepEqual(next, ["manual", "barbell", "operator", "amrap", "block-periodization"]);
});

test("clearing an axis removes every spelling of it", () => {
  const next = applyEditableFacetSelection(["strength", "근력", "intermediate", "중급"], {});
  assert.deepEqual(next, []);
});

test("an empty selection on an untagged program stays empty", () => {
  assert.deepEqual(readEditableFacetSelection([]), {});
  assert.deepEqual(applyEditableFacetSelection([], {}), []);
});
