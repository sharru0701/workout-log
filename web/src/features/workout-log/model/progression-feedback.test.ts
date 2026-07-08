// v0.5.1 실패 프로토콜 피드백(F1·F2·F4·F5) — 웹 순수 파생 로직 테스트.
// UI 렌더 대신 노출 판정·문구 조립(컴포넌트가 그대로 출력하는 값)을 유닛으로 고정한다.

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBlockJudgmentReport,
  buildBlockJudgmentRow,
  earlyDeloadBannerCopy,
  isLightBlockActive,
  parseEarlyDeloadReason,
  shouldShowAmrapEveNotice,
  shouldShowEarlyDeloadBanner,
  type ProgressionLastEvent,
} from "./progression-feedback";

// ── F1. 조기 디로드 배너 ─────────────────────────────────────────────────────

test("F1: reason 파싱 — deload:trigger:regressed=SQUAT,PULL → 드라이버 목록", () => {
  assert.deepEqual(parseEarlyDeloadReason("deload:trigger:regressed=SQUAT,PULL"), ["SQUAT", "PULL"]);
  assert.equal(parseEarlyDeloadReason("advance:session"), null);
  assert.equal(parseEarlyDeloadReason("deload:trigger:regressed="), null, "빈 목록은 무효");
  assert.equal(parseEarlyDeloadReason(null), null);
});

test("F1: 노출 — 최신 이벤트가 트리거 사유 + week4 진행 중 + asymptote일 때만", () => {
  const lastEvent = { reason: "deload:trigger:regressed=SQUAT,BENCH" };
  assert.equal(
    shouldShowEarlyDeloadBanner({ program: "asymptote", state: { week: 4 }, lastEvent }),
    true,
  );
  assert.equal(
    shouldShowEarlyDeloadBanner({ program: "asymptote", state: { week: 1 }, lastEvent }),
    false,
    "디로드 사이클 종료(다음 블록) 후엔 미노출",
  );
  assert.equal(
    shouldShowEarlyDeloadBanner({
      program: "asymptote",
      state: { week: 4 },
      lastEvent: { reason: "advance:session" },
    }),
    false,
    "일반 진행 이벤트면 미노출(고정 디로드 도달과 구분)",
  );
  assert.equal(
    shouldShowEarlyDeloadBanner({ program: "operator", state: { week: 4 }, lastEvent }),
    false,
    "asymptote 외 프로그램 미노출",
  );
});

test("F1: 배너 문구에 드라이버 축약 표기", () => {
  const copy = earlyDeloadBannerCopy("deload:trigger:regressed=SQUAT,PULL", "ko");
  assert.equal(copy.title, "⚠️ 조기 디로드 발동");
  assert.match(copy.body, /SQ·PULL/);
  assert.match(copy.body, /TM은 유지/);
});

// ── F2. 블록 판정 리포트 문구(판정 조합 5종) ────────────────────────────────

const rowKo = (decision: Parameters<typeof buildBlockJudgmentRow>[0]) =>
  buildBlockJudgmentRow(decision, "ko")?.text;

test("F2: +2.5 증량 — `SQ — AMRAP 9렙 → TM 90 → 92.5 (+2.5)`", () => {
  assert.equal(
    rowKo({
      progressionTarget: "SQUAT",
      reason: "increase:amrap-9reps:+2.5kg",
      before: { workKg: 90 },
      after: { workKg: 92.5 },
    }),
    "SQ — AMRAP 9렙 → TM 90 → 92.5 (+2.5)",
  );
});

test("F2: 유지 — 같은 무게 재도전", () => {
  assert.equal(
    rowKo({
      progressionTarget: "BENCH",
      reason: "hold:amrap-6reps",
      before: { workKg: 87.5 },
      after: { workKg: 87.5 },
    }),
    "BP — AMRAP 6렙 → TM 유지 · 같은 무게 재도전",
  );
});

test("F2: −2.5 리셋 — 재조준", () => {
  assert.equal(
    rowKo({
      progressionTarget: "SQUAT",
      reason: "reset:amrap-4reps:-2.5kg",
      before: { workKg: 90 },
      after: { workKg: 87.5 },
    }),
    "SQ — AMRAP 4렙 → TM 90 → 87.5 (−2.5) · 재조준",
  );
});

test("F2: −5 + 라이트 — 회복 블록", () => {
  assert.equal(
    rowKo({
      progressionTarget: "SQUAT",
      reason: "reset:amrap-2reps:-5kg+light",
      before: { workKg: 90 },
      after: { workKg: 85 },
    }),
    "SQ — AMRAP 2렙 → TM 90 → 85 (−5) · 다음 블록 라이트(회복)",
  );
});

test("F2: 판정 연기(보류/미기록) — 침묵 금지", () => {
  assert.equal(
    rowKo({ progressionTarget: "PULL", reason: "hold:amrap-missing" }),
    "PULL — 판정 연기 — TM 유지",
  );
});

test("F2: 리포트 — 드라이버 고정 순서 + 결측 리프트는 연기로 채움", () => {
  const lastEvent: ProgressionLastEvent = {
    id: "evt-1",
    eventType: "INCREASE",
    reason: "increase:amrap-9reps:+2.5kg",
    createdAt: "2026-07-08T00:00:00.000Z",
    targetDecisions: [
      {
        progressionTarget: "BENCH",
        reason: "hold:amrap-6reps",
        before: { workKg: 87.5 },
        after: { workKg: 87.5 },
      },
      {
        progressionTarget: "SQUAT",
        reason: "increase:amrap-9reps:+2.5kg",
        before: { workKg: 90 },
        after: { workKg: 92.5 },
      },
      // PULL 결측(AMRAP 보류로 판정 자체가 없던 리프트)
    ],
  };
  const report = buildBlockJudgmentReport(lastEvent, "ko");
  assert.ok(report);
  assert.equal(report!.eventId, "evt-1");
  assert.deepEqual(
    report!.rows.map((row) => row.target),
    ["SQUAT", "BENCH", "PULL"],
    "SQ→BP→PULL 고정 순서",
  );
  assert.equal(report!.rows[2]!.text, "PULL — 판정 연기 — TM 유지");
});

test("F2: 블록 판정이 아닌 이벤트(일반 진행)는 리포트 없음", () => {
  const lastEvent: ProgressionLastEvent = {
    id: "evt-2",
    eventType: "ADVANCE_WEEK",
    reason: "advance:session",
    createdAt: "2026-07-08T00:00:00.000Z",
    targetDecisions: [
      { progressionTarget: "SQUAT", reason: "hold:block-success" },
    ],
  };
  assert.equal(buildBlockJudgmentReport(lastEvent, "ko"), null);
  assert.equal(buildBlockJudgmentReport(null, "ko"), null);
});

// ── F4. 라이트 블록 배지 ─────────────────────────────────────────────────────

test("F4: lightBlockMode 플래그에만 종속", () => {
  assert.equal(isLightBlockActive({ lightBlockMode: true }), true);
  assert.equal(isLightBlockActive({ lightBlockMode: false }), false);
  assert.equal(isLightBlockActive({}), false);
  assert.equal(isLightBlockActive(null), false);
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
