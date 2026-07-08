// v0.5.1 실패 프로토콜 피드백 — 웹 잔존 파생 로직 테스트(F3·F4·F5).
// F1 배너·F2 판정 카드의 문구/노출 판정은 서버 조립 공용화로
// packages/core/src/progression/feedback-catalog.test.ts 로 이관됐다(단일 진실원).

import assert from "node:assert/strict";
import test from "node:test";
import {
  amrapDeferredBannerCopy,
  amrapEveNoticeCopy,
  isLightBlockActive,
  lightBlockBadgeCopy,
  shouldShowAmrapEveNotice,
} from "./progression-feedback";

// ── F3. AMRAP 보류 세션 배너(정적 카피) ─────────────────────────────────────

test("F3: 배너 카피 — 보류 사유와 행동 지침 포함", () => {
  const copy = amrapDeferredBannerCopy("ko");
  assert.match(copy.title, /AMRAP 보류/);
  assert.match(copy.body, /TM 유지/);
  assert.ok(amrapDeferredBannerCopy("en").title.includes("AMRAP"));
});

// ── F4. 라이트 블록 배지 ─────────────────────────────────────────────────────

test("F4: lightBlockMode 플래그에만 종속", () => {
  assert.equal(isLightBlockActive({ lightBlockMode: true }), true);
  assert.equal(isLightBlockActive({ lightBlockMode: false }), false);
  assert.equal(isLightBlockActive({}), false);
  assert.equal(isLightBlockActive(null), false);
});

test("F4: 배지 카피 — 라이트 블록 의미 설명", () => {
  const copy = lightBlockBadgeCopy("ko");
  assert.match(copy.title, /라이트 블록/);
  assert.match(copy.body, /탑세트 미발동/);
});

// ── F5. AMRAP 전날 예고 ──────────────────────────────────────────────────────

test("F5: 다음 세션이 판정(AMRAP) 세션일 때만 노출", () => {
  // week2 day3 저장 → 다음 = week3 day1(세션A, 판정) → 노출
  assert.equal(shouldShowAmrapEveNotice({ program: "asymptote", week: 2, day: 3 }), true);
  // week3 day2 저장 → 다음 = week3 day3(세션C, 판정) → 노출
  assert.equal(shouldShowAmrapEveNotice({ program: "asymptote", week: 3, day: 2 }), true);
  // week3 day1 저장 → 다음 = week3 day2(세션B, 비판정) → 미노출
  assert.equal(shouldShowAmrapEveNotice({ program: "asymptote", week: 3, day: 1 }), false);
  // week1 day1 저장 → 다음 = week1 day2 → 미노출
  assert.equal(shouldShowAmrapEveNotice({ program: "asymptote", week: 1, day: 1 }), false);
  // asymptote 외 프로그램/결측 위치 → 미노출
  assert.equal(shouldShowAmrapEveNotice({ program: "operator", week: 2, day: 3 }), false);
  assert.equal(shouldShowAmrapEveNotice({ program: "asymptote", week: null, day: 3 }), false);
});

test("F5: 예고 카피 — 보류 경고와 대안 제시", () => {
  const copy = amrapEveNoticeCopy("ko");
  assert.match(copy.title, /AMRAP/);
  assert.match(copy.body, /하루 쉬고/);
});
