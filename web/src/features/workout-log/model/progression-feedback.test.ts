// v0.5.1 실패 프로토콜 피드백(F1·F2·F4·F5) — 웹 순수 파생 로직 테스트.
// UI 렌더 대신 노출 판정·문구 조립(컴포넌트가 그대로 출력하는 값)을 유닛으로 고정한다.

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalogRow,
  buildProgressReport,
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

// ── F2. 진행 판정 리포트 — 패밀리별 카탈로그 문구 스냅샷 ────────────────────

const asymKo = (decision: Parameters<typeof buildCatalogRow>[1]) =>
  buildCatalogRow("asymptote", decision, "ko");

test("F2/asymptote: +2.5 증량 — `SQ — AMRAP 9렙 → TM 90 → 92.5 (+2.5)`", () => {
  assert.equal(
    asymKo({
      progressionTarget: "SQUAT",
      eventType: "INCREASE",
      reason: "increase:amrap-9reps:+2.5kg",
      before: { workKg: 90 },
      after: { workKg: 92.5 },
    }),
    "SQ — AMRAP 9렙 → TM 90 → 92.5 (+2.5)",
  );
});

test("F2/asymptote: 유지 — 같은 무게 재도전", () => {
  assert.equal(
    asymKo({
      progressionTarget: "BENCH",
      eventType: "HOLD",
      reason: "hold:amrap-6reps",
      before: { workKg: 87.5 },
      after: { workKg: 87.5 },
    }),
    "BP — AMRAP 6렙 → TM 유지 · 같은 무게 재도전",
  );
});

test("F2/asymptote: −2.5 리셋 — 재조준", () => {
  assert.equal(
    asymKo({
      progressionTarget: "SQUAT",
      eventType: "RESET",
      reason: "reset:amrap-4reps:-2.5kg",
      before: { workKg: 90 },
      after: { workKg: 87.5 },
    }),
    "SQ — AMRAP 4렙 → TM 90 → 87.5 (−2.5) · 재조준",
  );
});

test("F2/asymptote: −5 + 라이트 — 회복 블록", () => {
  assert.equal(
    asymKo({
      progressionTarget: "SQUAT",
      eventType: "RESET",
      reason: "reset:amrap-2reps:-5kg+light",
      before: { workKg: 90 },
      after: { workKg: 85 },
    }),
    "SQ — AMRAP 2렙 → TM 90 → 85 (−5) · 다음 블록 라이트(회복)",
  );
});

test("F2/asymptote: 판정 연기(보류/미기록) — 침묵 금지", () => {
  assert.equal(
    asymKo({ progressionTarget: "PULL", eventType: "HOLD", reason: "hold:amrap-missing" }),
    "PULL — 판정 연기 — TM 유지",
  );
});

test("F2/asymptote: 파생(DL/OHP) 갱신 문구", () => {
  assert.equal(
    asymKo({
      progressionTarget: "DEADLIFT",
      eventType: "INCREASE",
      reason: "derived:dl=sq:92.5kg",
      before: { workKg: 90 },
      after: { workKg: 92.5 },
    }),
    "DL — SQ 연동 갱신 → 92.5",
  );
});

test("F2/asymptote: 리포트 — 드라이버 고정 순서 + 결측 리프트는 연기로 채움", () => {
  const lastEvent: ProgressionLastEvent = {
    id: "evt-1",
    eventType: "INCREASE",
    reason: "increase:amrap-9reps:+2.5kg",
    createdAt: "2026-07-08T00:00:00.000Z",
    targetDecisions: [
      {
        progressionTarget: "BENCH",
        eventType: "HOLD",
        reason: "hold:amrap-6reps",
        before: { workKg: 87.5 },
        after: { workKg: 87.5 },
      },
      {
        progressionTarget: "SQUAT",
        eventType: "INCREASE",
        reason: "increase:amrap-9reps:+2.5kg",
        before: { workKg: 90 },
        after: { workKg: 92.5 },
      },
      {
        progressionTarget: "DEADLIFT",
        eventType: "INCREASE",
        reason: "derived:dl=sq:92.5kg",
        before: { workKg: 90 },
        after: { workKg: 92.5 },
      },
      // PULL 결측(AMRAP 보류로 판정 자체가 없던 리프트)
    ],
  };
  const report = buildProgressReport("asymptote", lastEvent, "ko");
  assert.ok(report);
  assert.equal(report!.eventId, "evt-1");
  assert.equal(report!.title, "블록 판정 — TM 변경 요약");
  assert.deepEqual(
    report!.rows.slice(0, 3).map((row) => row.target),
    ["SQUAT", "BENCH", "PULL"],
    "SQ→BP→PULL 고정 순서",
  );
  assert.equal(report!.rows[2]!.text, "PULL — 판정 연기 — TM 유지");
  assert.equal(report!.rows[3]!.target, "DEADLIFT", "파생 행은 드라이버 뒤에");
});

test("F2: 블록 판정이 아닌 이벤트(블록 중간 스트릭)는 리포트 없음", () => {
  const lastEvent: ProgressionLastEvent = {
    id: "evt-2",
    eventType: "ADVANCE_WEEK",
    reason: "advance:session",
    createdAt: "2026-07-08T00:00:00.000Z",
    targetDecisions: [
      { progressionTarget: "SQUAT", eventType: "HOLD", reason: "hold:block-success" },
    ],
  };
  assert.equal(buildProgressReport("asymptote", lastEvent, "ko"), null);
  assert.equal(buildProgressReport("operator", lastEvent, "ko"), null);
  assert.equal(buildProgressReport("asymptote", null, "ko"), null);
});

// ── 적용 ①: operator(TB Operator Custom) — 블록 완주 증량·동결 ───────────────

test("operator: 증량 문구 — `스쿼트 +2.5 (6연속 성공)`", () => {
  assert.equal(
    buildCatalogRow(
      "operator",
      {
        progressionTarget: "SQUAT",
        eventType: "INCREASE",
        reason: "increase:+2.5kg",
        before: { workKg: 100, successStreak: 6 },
        after: { workKg: 102.5 },
      },
      "ko",
    ),
    "스쿼트 +2.5 (6연속 성공)",
  );
});

test("operator: 스트릭 미상이면 `(블록 완주)` 폴백", () => {
  assert.equal(
    buildCatalogRow(
      "operator",
      {
        progressionTarget: "PULL",
        eventType: "INCREASE",
        reason: "increase:+2.5kg",
        before: { workKg: 57.5 },
        after: { workKg: 60 },
      },
      "ko",
    ),
    "풀업 +2.5 (블록 완주)",
  );
});

test("operator: 블록 동결 이벤트 → freeze 행(원인 리프트 명시)", () => {
  const lastEvent: ProgressionLastEvent = {
    id: "evt-freeze",
    eventType: "ADVANCE_WEEK",
    reason: "freeze:block:failed=SQUAT,BENCH",
    createdAt: "2026-07-08T00:00:00.000Z",
    targetDecisions: [
      { progressionTarget: "SQUAT", eventType: "HOLD", reason: "hold:block-failure" },
      { progressionTarget: "BENCH", eventType: "HOLD", reason: "hold:block-failure" },
    ],
  };
  const report = buildProgressReport("operator", lastEvent, "ko");
  assert.ok(report, "동결도 카드로 표출(침묵 금지)");
  assert.equal(report!.title, "블록 완주 — 증량 판정");
  assert.equal(report!.rows.length, 1);
  assert.equal(
    report!.rows[0]!.text,
    "블록 완주 — 증량 동결 · TM 유지 (실패 누적: 스쿼트, 벤치프레스)",
  );
});

test("wendler-531: operator와 같은 카탈로그(블록 완주 증량)", () => {
  assert.equal(
    buildCatalogRow(
      "wendler-531",
      {
        progressionTarget: "OHP",
        eventType: "INCREASE",
        reason: "increase:+2.5kg",
        before: { workKg: 40, successStreak: 16 },
        after: { workKg: 42.5 },
      },
      "ko",
    ),
    "오버헤드프레스 +2.5 (16연속 성공)",
  );
});

// ── 적용 ②: gzclp(v2 stage 머신) ────────────────────────────────────────────

test("gzclp: T3 AMRAP≥25 증량 문구", () => {
  assert.equal(
    buildCatalogRow(
      "gzclp",
      {
        progressionTarget: "PULL",
        target: "랫풀다운",
        eventType: "INCREASE",
        reason: "increase:amrap>=25:+2.5kg",
      },
      "ko",
    ),
    "풀업 — AMRAP ≥25렙 달성 → 증량 (+2.5)",
  );
});

test("gzclp: 슬롯 키(비 canonical)는 display 라벨 사용", () => {
  assert.equal(
    buildCatalogRow(
      "gzclp",
      { target: "랫풀다운", eventType: "HOLD", reason: "hold:amrap<25" },
      "ko",
    ),
    "랫풀다운 — AMRAP 25렙 미달 → 같은 무게 재도전",
  );
});

test("gzclp: 스테이지 강등·소진 문구", () => {
  assert.equal(
    buildCatalogRow(
      "gzclp",
      { progressionTarget: "SQUAT", eventType: "HOLD", reason: "stage-down:0->1" },
      "ko",
    ),
    "스쿼트 — 실패 → 렙 스킴 강등(무게 유지, 단계 0→1)",
  );
  assert.equal(
    buildCatalogRow(
      "gzclp",
      {
        progressionTarget: "SQUAT",
        eventType: "RESET",
        reason: "reset:stage-exhausted:*0.85",
        before: { workKg: 100 },
        after: { workKg: 85 },
      },
      "ko",
    ),
    "스쿼트 — 스킴 소진 → 무게 리셋 100 → 85 (−15)",
  );
});

// ── 적용 ③: 미등록 패밀리/reason — 기본 폴백(새 reason에 UI가 안 깨짐) ──────

test("폴백: 미등록 패밀리(texas-method) 증량은 기본 문구", () => {
  assert.equal(
    buildCatalogRow(
      "texas-method",
      {
        progressionTarget: "SQUAT",
        eventType: "INCREASE",
        reason: "increase:weekly:+2.5kg",
        before: { workKg: 90 },
        after: { workKg: 92.5 },
      },
      "ko",
    ),
    "스쿼트 — 증량 90 → 92.5 (+2.5)",
  );
});

test("폴백: before/after 없으면 reason의 kg 표기로", () => {
  assert.equal(
    buildCatalogRow(
      "greyskull-lp",
      { progressionTarget: "BENCH", eventType: "INCREASE", reason: "increase:+2.5kg" },
      "ko",
    ),
    "벤치프레스 — 증량 (+2.5)",
  );
});

test("폴백: 등록 패밀리의 미등록 reason도 기본 문구(크래시 금지)", () => {
  assert.equal(
    buildCatalogRow(
      "asymptote",
      {
        progressionTarget: "SQUAT",
        eventType: "RESET",
        reason: "reset:brand-new-reason",
        before: { workKg: 90 },
        after: { workKg: 85 },
      },
      "ko",
    ),
    "스쿼트 — 하향 90 → 85 (−5)",
  );
});

test("폴백: 판정성 아닌 HOLD(스트릭 노이즈)는 미표출", () => {
  assert.equal(
    buildCatalogRow(
      "stronglifts-5x5",
      { progressionTarget: "SQUAT", eventType: "HOLD", reason: "hold:success-streak" },
      "ko",
    ),
    null,
  );
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
