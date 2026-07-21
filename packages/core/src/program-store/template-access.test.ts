import assert from "node:assert/strict";
import test from "node:test";

import { isProgramTemplateAccessible } from "./template-access";

const me = "6f47ec53-user";

test("public templates are visible to everyone", () => {
  assert.equal(isProgramTemplateAccessible({ visibility: "PUBLIC" }, me), true);
  assert.equal(isProgramTemplateAccessible({ visibility: "PUBLIC" }, null), true);
});

test("private templates are visible only to their owner", () => {
  assert.equal(
    isProgramTemplateAccessible({ visibility: "PRIVATE", ownerUserId: me }, me),
    true,
  );
  // 인증 도입 전 fallback userId("dev")로 만들어진 템플릿은 실제 계정과 매칭되지 않아
  // 스토어에서 사라진다 — 이 케이스를 플랜 관리에서 알려주는 게 목적이다.
  assert.equal(
    isProgramTemplateAccessible({ visibility: "PRIVATE", ownerUserId: "dev" }, me),
    false,
  );
  assert.equal(
    isProgramTemplateAccessible({ visibility: "PRIVATE", ownerUserId: null }, me),
    false,
  );
  assert.equal(
    isProgramTemplateAccessible({ visibility: "PRIVATE", ownerUserId: me }, null),
    false,
  );
});

test("a missing template is not accessible", () => {
  assert.equal(isProgramTemplateAccessible(null, me), false);
  assert.equal(isProgramTemplateAccessible(undefined, me), false);
  assert.equal(isProgramTemplateAccessible({ visibility: null }, me), false);
});
