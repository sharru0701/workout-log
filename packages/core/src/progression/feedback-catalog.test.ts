// 프로그램 공통 피드백 카탈로그 테스트 — 패밀리별 reason→문구 스냅샷 + 조립 진입점.
// web에서 core로 이동한 카탈로그(서버 조립 공용화)의 문구를 그대로 고정한다 —
// web·TUI가 이 문구를 재가공 없이 출력하므로 여기가 곧 표출 스냅샷이다.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCatalogRow,
  buildEarlyDeloadBanner,
  buildProgressReport,
  buildProgressionFeedbackFromEvent,
  parseBlockFreezeReason,
  parseEarlyDeloadReason,
  type ProgressFeedbackEvent,
} from "./feedback-catalog";

// ── asymptote — v0.5.1 §F2 문구 보존 ─────────────────────────────────────────

const asymKo = (decision: Parameters<typeof buildCatalogRow>[1]) =>
  buildCatalogRow("asymptote", decision, "ko");

test("asymptote: +2.5 증량 — `SQ — AMRAP 9렙 → TM 90 → 92.5 (+2.5)`", () => {
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

test("asymptote: 유지 — 같은 무게 재도전", () => {
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

test("asymptote: −2.5 리셋 — 재조준 / −5 — 라이트", () => {
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

test("asymptote: 판정 연기·파생 갱신", () => {
  assert.equal(
    asymKo({ progressionTarget: "PULL", eventType: "HOLD", reason: "hold:amrap-missing" }),
    "PULL — 판정 연기 — TM 유지",
  );
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

test("asymptote 리포트: 드라이버 고정 순서 + 결측 연기 채움 + 파생은 뒤", () => {
  const lastEvent: ProgressFeedbackEvent = {
    id: "evt-1",
    eventType: "INCREASE",
    reason: "increase:amrap-9reps:+2.5kg",
    createdAt: "2026-07-08T00:00:00.000Z",
    targetDecisions: [
      { progressionTarget: "BENCH", eventType: "HOLD", reason: "hold:amrap-6reps", before: { workKg: 87.5 }, after: { workKg: 87.5 } },
      { progressionTarget: "SQUAT", eventType: "INCREASE", reason: "increase:amrap-9reps:+2.5kg", before: { workKg: 90 }, after: { workKg: 92.5 } },
      { progressionTarget: "DEADLIFT", eventType: "INCREASE", reason: "derived:dl=sq:92.5kg", before: { workKg: 90 }, after: { workKg: 92.5 } },
    ],
  };
  const report = buildProgressReport("asymptote", lastEvent, "ko");
  assert.ok(report);
  assert.equal(report!.title, "블록 판정 — TM 변경 요약");
  assert.deepEqual(report!.rows.slice(0, 3).map((row) => row.target), ["SQUAT", "BENCH", "PULL"]);
  assert.equal(report!.rows[2]!.text, "PULL — 판정 연기 — TM 유지");
  assert.equal(report!.rows[3]!.target, "DEADLIFT");
});

test("블록 중간 스트릭 이벤트는 리포트 없음(노이즈 차단)", () => {
  const lastEvent: ProgressFeedbackEvent = {
    id: "evt-2",
    eventType: "ADVANCE_WEEK",
    reason: "advance:session",
    createdAt: "2026-07-08T00:00:00.000Z",
    targetDecisions: [{ progressionTarget: "SQUAT", eventType: "HOLD", reason: "hold:block-success" }],
  };
  assert.equal(buildProgressReport("asymptote", lastEvent, "ko"), null);
  assert.equal(buildProgressReport("operator", lastEvent, "ko"), null);
  assert.equal(buildProgressReport(null, null, "ko"), null);
});

// ── operator·wendler-531 ─────────────────────────────────────────────────────

test("operator: 증량 `스쿼트 +2.5 (6연속 성공)` / 스트릭 미상 `(블록 완주)`", () => {
  assert.equal(
    buildCatalogRow(
      "operator",
      { progressionTarget: "SQUAT", eventType: "INCREASE", reason: "increase:+2.5kg", before: { workKg: 100, successStreak: 6 }, after: { workKg: 102.5 } },
      "ko",
    ),
    "스쿼트 +2.5 (6연속 성공)",
  );
  assert.equal(
    buildCatalogRow(
      "operator",
      { progressionTarget: "PULL", eventType: "INCREASE", reason: "increase:+2.5kg", before: { workKg: 57.5 }, after: { workKg: 60 } },
      "ko",
    ),
    "풀업 +2.5 (블록 완주)",
  );
});

test("operator: 블록 동결 → freeze 행(원인 리프트 명시)", () => {
  const lastEvent: ProgressFeedbackEvent = {
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
  assert.ok(report);
  assert.equal(report!.title, "블록 완주 — 증량 판정");
  assert.equal(report!.rows.length, 1);
  assert.equal(report!.rows[0]!.text, "블록 완주 — 증량 동결 · TM 유지 (실패 누적: 스쿼트, 벤치프레스)");
  assert.deepEqual(parseBlockFreezeReason("freeze:block:failed=SQUAT,BENCH"), ["SQUAT", "BENCH"]);
});

test("wendler-531: operator와 같은 카탈로그", () => {
  assert.equal(
    buildCatalogRow(
      "wendler-531",
      { progressionTarget: "OHP", eventType: "INCREASE", reason: "increase:+2.5kg", before: { workKg: 40, successStreak: 16 }, after: { workKg: 42.5 } },
      "ko",
    ),
    "오버헤드프레스 +2.5 (16연속 성공)",
  );
});

// ── gzclp ────────────────────────────────────────────────────────────────────

test("gzclp: AMRAP≥25 증량·미달 유지·강등·소진 문구", () => {
  assert.equal(
    buildCatalogRow("gzclp", { progressionTarget: "PULL", eventType: "INCREASE", reason: "increase:amrap>=25:+2.5kg" }, "ko"),
    "풀업 — AMRAP ≥25렙 달성 → 증량 (+2.5)",
  );
  assert.equal(
    buildCatalogRow("gzclp", { target: "랫풀다운", eventType: "HOLD", reason: "hold:amrap<25" }, "ko"),
    "랫풀다운 — AMRAP 25렙 미달 → 같은 무게 재도전",
  );
  assert.equal(
    buildCatalogRow("gzclp", { progressionTarget: "SQUAT", eventType: "HOLD", reason: "stage-down:0->1" }, "ko"),
    "스쿼트 — 실패 → 렙 스킴 강등(무게 유지, 단계 0→1)",
  );
  assert.equal(
    buildCatalogRow(
      "gzclp",
      { progressionTarget: "SQUAT", eventType: "RESET", reason: "reset:stage-exhausted:*0.85", before: { workKg: 100 }, after: { workKg: 85 } },
      "ko",
    ),
    "스쿼트 — 스킴 소진 → 무게 리셋 100 → 85 (−15)",
  );
});

// ── 폴백(미등록 reason·패밀리) ──────────────────────────────────────────────

test("폴백: 미등록 패밀리·reason은 기본 문구, 판정성 아닌 HOLD는 미표출", () => {
  assert.equal(
    buildCatalogRow(
      "texas-method",
      { progressionTarget: "SQUAT", eventType: "INCREASE", reason: "increase:weekly:+2.5kg", before: { workKg: 90 }, after: { workKg: 92.5 } },
      "ko",
    ),
    "스쿼트 — 증량 90 → 92.5 (+2.5)",
  );
  assert.equal(
    buildCatalogRow("greyskull-lp", { progressionTarget: "BENCH", eventType: "INCREASE", reason: "increase:+2.5kg" }, "ko"),
    "벤치프레스 — 증량 (+2.5)",
  );
  assert.equal(
    buildCatalogRow(
      "asymptote",
      { progressionTarget: "SQUAT", eventType: "RESET", reason: "reset:brand-new-reason", before: { workKg: 90 }, after: { workKg: 85 } },
      "ko",
    ),
    "스쿼트 — 하향 90 → 85 (−5)",
  );
  assert.equal(
    buildCatalogRow("stronglifts-5x5", { progressionTarget: "SQUAT", eventType: "HOLD", reason: "hold:success-streak" }, "ko"),
    null,
  );
});

// ── F1 조기 디로드 배너(문구+노출 판정) ─────────────────────────────────────

test("F1: reason 파싱 + 배너 문구(드라이버 축약)", () => {
  assert.deepEqual(parseEarlyDeloadReason("deload:trigger:regressed=SQUAT,PULL"), ["SQUAT", "PULL"]);
  assert.equal(parseEarlyDeloadReason("advance:session"), null);
  const banner = buildEarlyDeloadBanner(
    { program: "asymptote", reason: "deload:trigger:regressed=SQUAT,PULL", state: { week: 4 } },
    "ko",
  );
  assert.ok(banner);
  assert.equal(banner!.title, "⚠️ 조기 디로드 발동");
  assert.match(banner!.body, /SQ·PULL/);
  assert.match(banner!.body, /TM은 유지/);
});

test("F1: 노출 판정 — state 있으면 week4 진행 중일 때만, 없으면(저장 직후) reason만으로", () => {
  const input = { program: "asymptote", reason: "deload:trigger:regressed=SQUAT,BENCH" };
  assert.ok(buildEarlyDeloadBanner({ ...input, state: { week: 4 } }, "ko"));
  assert.equal(buildEarlyDeloadBanner({ ...input, state: { week: 1 } }, "ko"), null, "디로드 종료 후 미노출");
  assert.ok(buildEarlyDeloadBanner({ ...input, state: null }, "ko"), "저장 직후(state 미제공)엔 즉시 노출");
  assert.equal(buildEarlyDeloadBanner({ ...input, program: "operator", state: null }, "ko"), null);
  assert.equal(
    buildEarlyDeloadBanner({ program: "asymptote", reason: "advance:session", state: { week: 4 } }, "ko"),
    null,
    "일반 진행 이벤트(고정 디로드 도달)와 구분",
  );
});

// ── 서버 조립 진입점 ────────────────────────────────────────────────────────

test("buildProgressionFeedbackFromEvent: 이벤트 행 → programSlug 매핑 + 조립", () => {
  const feedback = buildProgressionFeedbackFromEvent(
    {
      eventRow: {
        id: "evt-3",
        eventType: "INCREASE",
        reason: "increase:+2.5kg",
        createdAt: new Date("2026-07-08T00:00:00.000Z"),
        programSlug: "operator",
        meta: {
          targetDecisions: [
            { progressionTarget: "SQUAT", eventType: "INCREASE", reason: "increase:+2.5kg", before: { workKg: 100, successStreak: 6 }, after: { workKg: 102.5 } },
          ],
        },
      },
    },
    "ko",
  );
  assert.ok(feedback.report);
  assert.equal(feedback.report!.rows[0]!.text, "스쿼트 +2.5 (6연속 성공)");
  assert.equal(feedback.earlyDeloadBanner, null);
});

test("buildProgressionFeedbackFromEvent: asymptote-protocol slug → 조기 디로드 배너(저장 직후)", () => {
  const feedback = buildProgressionFeedbackFromEvent(
    {
      eventRow: {
        id: "evt-4",
        eventType: "ADVANCE_WEEK",
        reason: "deload:trigger:regressed=SQUAT,BENCH",
        createdAt: "2026-07-08T00:00:00.000Z",
        programSlug: "asymptote-protocol",
        meta: { targetDecisions: [] },
      },
    },
    "ko",
  );
  assert.equal(feedback.report, null);
  assert.ok(feedback.earlyDeloadBanner);
  assert.match(feedback.earlyDeloadBanner!.body, /SQ·BP/);
});

test("buildProgressionFeedbackFromEvent: 이벤트 없음 → 전부 null", () => {
  assert.deepEqual(buildProgressionFeedbackFromEvent({ eventRow: null }, "ko"), {
    report: null,
    earlyDeloadBanner: null,
  });
});
