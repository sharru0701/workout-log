// v0.5.1 실패 프로토콜 피드백(F1~F5) — 순수 파생 로직.
// `web/docs/asymptote-hybrid-v0.5.1-feedback-patch.md` 기준. 엔진 판정 로직은 읽기만 하고
// 절대 바꾸지 않는다. React 무의존(테스트는 tsx --test 유닛으로 고정), 훅/컴포넌트가 소비한다.

import {
  asymptoteIsJudgmentSession,
  asymptoteNextPosition,
} from "@workout/core/program-engine/asymptote";

export type ProgressionLastEvent = {
  id: string;
  eventType: string;
  reason: string | null;
  createdAt: string;
  targetDecisions: unknown[];
};

export type ProgressionStateResponse = {
  program: string | null;
  state: { week?: number; day?: number; lightBlockMode?: boolean } | null;
  lastEvent?: ProgressionLastEvent | null;
};

type Locale = "ko" | "en";

const TARGET_ABBREV: Record<string, string> = {
  SQUAT: "SQ",
  BENCH: "BP",
  PULL: "PULL",
  DEADLIFT: "DL",
  OHP: "OHP",
};

const DRIVER_ORDER = ["SQUAT", "BENCH", "PULL"] as const;

// ── F1. 조기 디로드 배너 ─────────────────────────────────────────────────────

// reducer가 기록한 `deload:trigger:regressed=SQUAT,PULL`에서 드라이버 목록을 복원.
export function parseEarlyDeloadReason(reason: string | null | undefined): string[] | null {
  const raw = String(reason ?? "");
  if (!raw.startsWith("deload:trigger:regressed=")) return null;
  const list = raw
    .slice("deload:trigger:regressed=".length)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

// 노출: 최신 이벤트가 조기 디로드 사유이고, 아직 그 디로드 사이클(week 4) 진행 중일 때.
export function shouldShowEarlyDeloadBanner(input: {
  program: string | null | undefined;
  state: { week?: number } | null | undefined;
  lastEvent: { reason?: string | null } | null | undefined;
}): boolean {
  if (input.program !== "asymptote") return false;
  if (Math.floor(Number(input.state?.week)) !== 4) return false;
  return parseEarlyDeloadReason(input.lastEvent?.reason) !== null;
}

export function earlyDeloadBannerCopy(reason: string | null | undefined, locale: Locale) {
  const drivers = parseEarlyDeloadReason(reason) ?? [];
  const abbrev = drivers.map((d) => TARGET_ABBREV[d] ?? d).join("·");
  return {
    title: locale === "ko" ? "⚠️ 조기 디로드 발동" : "⚠️ Early deload triggered",
    body:
      locale === "ko"
        ? `메인 리프트 2개에서 렙 급감이 누적돼 회복 사이클로 점프했어요${abbrev ? ` (${abbrev})` : ""}. TM은 유지됩니다.`
        : `Rep regression stacked up on two main lifts${abbrev ? ` (${abbrev})` : ""} — jumped to the recovery cycle. TM is unchanged.`,
  };
}

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

// ── F2. 진행 판정 리포트(프로그램 공통) ─────────────────────────────────────
// v0.5.1의 asymptote 전용 블록 판정 카드를 패밀리별 카탈로그로 일반화했다 —
// reason→문구 매핑·폴백·리포트 조립은 progression-feedback-catalog.ts(단일 진실원).
// 기존 소비자 호환을 위해 여기서 re-export 한다.

export {
  buildProgressReport,
  buildCatalogRow,
  fallbackRow,
  parseBlockFreezeReason,
  type FeedbackDecision,
  type ProgressReport,
  type ProgressReportRow,
} from "./progression-feedback-catalog";

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
    title: locale === "ko" ? "🎯 다음 세션은 AMRAP(판정)입니다" : "🎯 Next session is an AMRAP (judgment) session",
    body:
      locale === "ko"
        ? "내일 치면 보류됩니다. 하루 쉬고 치면 판정 가능."
        : "Training tomorrow defers the judgment. Rest a day to make it count.",
  };
}
