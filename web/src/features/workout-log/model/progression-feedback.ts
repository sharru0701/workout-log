// v0.5.1 실패 프로토콜 피드백(F1~F5) — 웹 쪽 파생 로직.
// reason→문구 카탈로그(판정 카드·조기 디로드 배너)는 **서버 조립 공용화**로
// @workout/core/progression/feedback-catalog(단일 진실원)로 이동했고, apps/api가
// progression-state·저장 응답의 `feedback`에 로케일 문구까지 실어 내려준다 —
// 웹은 그대로 출력만 한다(TUI와 문구 동일 보장, 클라이언트 카탈로그 복제 금지).
// 여기 남는 것은 세션 스코프의 정적 카피(F3·F4·F5)와 그 노출 판정뿐.

import {
  asymptoteIsJudgmentSession,
  asymptoteNextPosition,
} from "@workout/core/program-engine/asymptote";
import type {
  FeedbackBanner,
  ProgressReport,
  ProgressReportRow,
  ProgressionFeedbackPayload,
} from "@workout/core/progression/feedback-catalog";

export type { FeedbackBanner, ProgressReport, ProgressReportRow, ProgressionFeedbackPayload };

export type ProgressionStateResponse = {
  program: string | null;
  state: { week?: number; day?: number; lightBlockMode?: boolean } | null;
  // 서버 조립 피드백 — apps/api progression-state가 로케일 문구까지 만들어 내려준다.
  feedback?: ProgressionFeedbackPayload | null;
};

type Locale = "ko" | "en";

// ── F3. AMRAP 보류 세션 배너 ─────────────────────────────────────────────────

export function amrapDeferredBannerCopy(locale: Locale) {
  return {
    title:
      locale === "ko"
        ? "⏸️ 오늘 AMRAP 보류(연속일 휴식 부족)"
        : "⏸️ AMRAP deferred today (not enough rest)",
    body:
      locale === "ko"
        ? "판정은 다음 블록으로 — TM 유지. 평소 세트만 치면 됩니다."
        : "Judgment moves to the next block — TM unchanged. Just do the regular sets.",
  };
}

// ── F4. 라이트 블록 배지 ─────────────────────────────────────────────────────

export function isLightBlockActive(state: { lightBlockMode?: boolean } | null | undefined): boolean {
  return state?.lightBlockMode === true;
}

export function lightBlockBadgeCopy(locale: Locale) {
  return {
    title: locale === "ko" ? "🌙 라이트 블록 (회복)" : "🌙 Light block (recovery)",
    body:
      locale === "ko"
        ? "직전 AMRAP 0~2렙 → TM −5 + 이번 블록은 감량 계수로 진행, 탑세트 미발동."
        : "Last AMRAP was 0–2 reps → TM −5. This block runs on reduced coefficients; no top sets.",
  };
}

// ── F5. AMRAP 전날 예고 ──────────────────────────────────────────────────────

// 방금 저장한(또는 보고 있는 오늘의) 세션 위치 기준: 다음 세션이 판정(AMRAP) 세션이면
// 정보성 예고를 띄운다. 오늘 저장했으므로 내일 치면 restDayGap=1 < 2 → 보류가 된다는 안내.
export function shouldShowAmrapEveNotice(input: {
  program: string | null | undefined;
  week: number | null | undefined;
  day: number | null | undefined;
}): boolean {
  if (input.program !== "asymptote") return false;
  const week = Number(input.week);
  const day = Number(input.day);
  if (!Number.isFinite(week) || !Number.isFinite(day)) return false;
  const next = asymptoteNextPosition(week, day);
  return asymptoteIsJudgmentSession(next.week, next.day);
}

export function amrapEveNoticeCopy(locale: Locale) {
  return {
    title:
      locale === "ko" ? "🎯 다음 세션은 AMRAP(판정)입니다" : "🎯 Next session is an AMRAP (judgment) session",
    body:
      locale === "ko"
        ? "내일 치면 보류됩니다. 하루 쉬고 치면 판정 가능."
        : "Training tomorrow defers the judgment. Rest a day to make it count.",
  };
}
