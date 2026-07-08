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

// ── F2. 블록 판정 리포트 ─────────────────────────────────────────────────────

type DecisionLike = {
  progressionTarget?: unknown;
  target?: unknown;
  reason?: unknown;
  before?: { workKg?: unknown };
  after?: { workKg?: unknown };
};

const AMRAP_REASON_RE = /^(increase|hold|reset):amrap-(\d+)reps/;

function formatKg(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function toKg(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type BlockJudgmentRow = { target: string; text: string };

// 판정 조합별 문구(스펙 §F2 — 치트시트 상황판단표 톤):
//   +2.5 → `SQ — AMRAP 9렙 → TM 90 → 92.5 (+2.5)`
//   유지  → `BP — AMRAP 6렙 → TM 유지 · 같은 무게 재도전`
//   −2.5 → `SQ — AMRAP 4렙 → TM 90 → 87.5 (−2.5) · 재조준`
//   −5   → `SQ — AMRAP 2렙 → TM 90 → 85 (−5) · 다음 블록 라이트(회복)`
//   연기  → `PULL — 판정 연기 — TM 유지`  (침묵 금지)
export function buildBlockJudgmentRow(decision: DecisionLike, locale: Locale): BlockJudgmentRow | null {
  const target = String(decision.progressionTarget ?? decision.target ?? "").toUpperCase();
  if (!target) return null;
  const abbrev = TARGET_ABBREV[target] ?? target;
  const reason = String(decision.reason ?? "");

  if (reason === "hold:amrap-missing") {
    return {
      target,
      text:
        locale === "ko"
          ? `${abbrev} — 판정 연기 — TM 유지`
          : `${abbrev} — judgment deferred — TM unchanged`,
    };
  }

  const match = AMRAP_REASON_RE.exec(reason);
  if (!match) return null;
  const kind = match[1]!;
  const reps = Number(match[2]);
  const before = toKg(decision.before?.workKg);
  const after = toKg(decision.after?.workKg);
  const repsLabel = locale === "ko" ? `AMRAP ${reps}렙` : `AMRAP ${reps} reps`;

  if (kind === "hold") {
    return {
      target,
      text:
        locale === "ko"
          ? `${abbrev} — ${repsLabel} → TM 유지 · 같은 무게 재도전`
          : `${abbrev} — ${repsLabel} → TM held · retry at the same weight`,
    };
  }

  const deltaText =
    before !== null && after !== null ? ` (${after >= before ? "+" : "−"}${formatKg(Math.abs(after - before))})` : "";
  const range =
    before !== null && after !== null
      ? ` → TM ${formatKg(before)} → ${formatKg(after)}${deltaText}`
      : "";

  if (kind === "increase") {
    return { target, text: `${abbrev} — ${repsLabel}${range}` };
  }

  // reset: −2.5(재조준) / −5+light(회복 블록)
  const isLight = reason.includes("+light");
  const suffix =
    locale === "ko"
      ? isLight
        ? " · 다음 블록 라이트(회복)"
        : " · 재조준"
      : isLight
        ? " · next block light (recovery)"
        : " · re-aim";
  return { target, text: `${abbrev} — ${repsLabel}${range}${suffix}` };
}

export type BlockJudgmentReport = { eventId: string; rows: BlockJudgmentRow[] };

// 최신 이벤트가 블록 판정(사이클3 AMRAP → TM 변동)일 때만 리포트를 만든다.
// 드라이버(SQ/BP/PULL) 고정 순서, 판정 없는 리프트도 연기로 명시(침묵 금지).
export function buildBlockJudgmentReport(
  lastEvent: ProgressionLastEvent | null | undefined,
  locale: Locale,
): BlockJudgmentReport | null {
  if (!lastEvent || !Array.isArray(lastEvent.targetDecisions)) return null;
  const decisions = lastEvent.targetDecisions.filter(
    (d): d is DecisionLike => Boolean(d) && typeof d === "object",
  );
  const isBlockJudgment = decisions.some((d) => {
    const reason = String(d.reason ?? "");
    return AMRAP_REASON_RE.test(reason) || reason === "hold:amrap-missing";
  });
  if (!isBlockJudgment) return null;

  const rows: BlockJudgmentRow[] = [];
  for (const driver of DRIVER_ORDER) {
    const decision = decisions.find(
      (d) => String(d.progressionTarget ?? d.target ?? "").toUpperCase() === driver,
    );
    const row = decision ? buildBlockJudgmentRow(decision, locale) : null;
    rows.push(
      row ??
        buildBlockJudgmentRow({ progressionTarget: driver, reason: "hold:amrap-missing" }, locale)!,
    );
  }
  return { eventId: lastEvent.id, rows };
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
    title: locale === "ko" ? "🎯 다음 세션은 AMRAP(판정)입니다" : "🎯 Next session is an AMRAP (judgment) session",
    body:
      locale === "ko"
        ? "내일 치면 보류됩니다. 하루 쉬고 치면 판정 가능."
        : "Training tomorrow defers the judgment. Rest a day to make it count.",
  };
}
