// 프로그램 공통 피드백 카탈로그 — reason→사용자 문구의 단일 진실원(서버 조립).
// `web/docs/program-feedback-coverage.md`의 표출 아키텍처. 원래 web에 있던 것을 core로 이동해
// apps/api가 로케일 문구까지 조립해 내려주고, web·TUI가 같은 문구를 그대로 소비한다
// (클라이언트별 문구 복제 금지 — 이중 유지보수 원천 차단). 원칙:
//   1) 판정 로직은 읽기만 한다(plan_progress_event의 reason·meta.targetDecisions가 유일한 입력).
//   2) 미등록 reason은 eventType 기반 기본 문구로 폴백 — 새 reason이 추가돼도 표출이 깨지지 않는다.
//   3) 블록 중간 스트릭 HOLD(hold:block-*·hold:*-streak)는 노이즈로 표출하지 않는다.
// summary.ts(저장 직후 한 줄 요약)와 역할 분리: 여기는 판정 카드·세션 배너용 구조화 문구.

import { resolveAutoProgressionProgram } from "./reducer";

export type FeedbackLocale = "ko" | "en";

export type FeedbackDecision = {
  progressionTarget?: unknown;
  target?: unknown;
  eventType?: unknown;
  reason?: unknown;
  before?: { workKg?: unknown; successStreak?: unknown };
  after?: { workKg?: unknown };
};

export type ProgressFeedbackEvent = {
  id: string;
  eventType: string;
  reason: string | null;
  createdAt: string;
  targetDecisions: unknown[];
};

export type ProgressReportRow = { target: string; text: string };
export type ProgressReport = { eventId: string; title: string; rows: ProgressReportRow[] };
export type FeedbackBanner = { title: string; body: string };

// 서버가 응답에 싣는 조립 완료 피드백 — web 배너/카드·TUI 상태 라인이 그대로 출력한다.
export type ProgressionFeedbackPayload = {
  report: ProgressReport | null;
  earlyDeloadBanner: FeedbackBanner | null;
};

// ── 공통 유틸 ────────────────────────────────────────────────────────────────

const LIFT_LABEL: Record<FeedbackLocale, Record<string, string>> = {
  ko: { SQUAT: "스쿼트", BENCH: "벤치프레스", DEADLIFT: "데드리프트", OHP: "오버헤드프레스", PULL: "풀업" },
  en: { SQUAT: "Squat", BENCH: "Bench", DEADLIFT: "Deadlift", OHP: "OHP", PULL: "Pull-up" },
};

// asymptote 카드(v0.5.1 §F2)의 축약 표기 — 스펙 형식 보존.
const TARGET_ABBREV: Record<string, string> = {
  SQUAT: "SQ",
  BENCH: "BP",
  PULL: "PULL",
  DEADLIFT: "DL",
  OHP: "OHP",
};

function canonicalTarget(decision: FeedbackDecision): string {
  return String(decision.progressionTarget ?? decision.target ?? "").toUpperCase();
}

// 표시명: canonical 리프트면 로케일 라벨, 아니면(슬롯 키 등) 이벤트의 display target 그대로.
function displayLabel(decision: FeedbackDecision, locale: FeedbackLocale): string {
  const canonical = canonicalTarget(decision);
  const byLift = LIFT_LABEL[locale][canonical];
  if (byLift) return byLift;
  const display = String(decision.target ?? decision.progressionTarget ?? "").trim();
  return display || canonical || "?";
}

function toKg(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatKg(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function deltaSuffix(decision: FeedbackDecision): string {
  const before = toKg(decision.before?.workKg);
  const after = toKg(decision.after?.workKg);
  if (before === null || after === null || before === after) return "";
  const sign = after > before ? "+" : "−";
  return ` ${formatKg(before)} → ${formatKg(after)} (${sign}${formatKg(Math.abs(after - before))})`;
}

// reason 꼬리의 증분 표기(+2.5kg 등) — before/after가 없을 때의 폴백 소스.
function parseIncrementFromReason(reason: string): string | null {
  const match = /([+-]\d+(?:\.\d+)?)kg/.exec(reason);
  return match ? match[1]!.replace("-", "−") : null;
}

// ── 기본 폴백(미등록 reason·패밀리) ─────────────────────────────────────────

// HOLD는 기본 미표출(스트릭 노이즈). INCREASE/RESET만 기본 문구 생성.
export function fallbackRow(decision: FeedbackDecision, locale: FeedbackLocale): string | null {
  const eventType = String(decision.eventType ?? "").toUpperCase();
  if (eventType !== "INCREASE" && eventType !== "RESET") return null;
  const label = displayLabel(decision, locale);
  const range = deltaSuffix(decision);
  const inc = range
    ? ""
    : (() => {
        const parsed = parseIncrementFromReason(String(decision.reason ?? ""));
        return parsed ? ` (${parsed})` : "";
      })();
  if (eventType === "INCREASE") {
    return locale === "ko" ? `${label} — 증량${range}${inc}` : `${label} — increased${range}${inc}`;
  }
  return locale === "ko" ? `${label} — 하향${range}${inc}` : `${label} — reduced${range}${inc}`;
}

// ── 패밀리 카탈로그 ──────────────────────────────────────────────────────────

type FamilyCatalog = {
  // 카드 노출 트리거에 포함할 "판정성 HOLD" 판별(기본: HOLD는 노이즈로 제외).
  isNotableHold?: (reason: string) => boolean;
  // reason별 문구. null 반환 시 기본 폴백 사용.
  buildRow?: (decision: FeedbackDecision, locale: FeedbackLocale) => string | null;
  // 리포트 후처리(정렬·결측 채움 등). 기본은 그대로.
  finalizeRows?: (
    rows: ProgressReportRow[],
    decisions: FeedbackDecision[],
    locale: FeedbackLocale,
  ) => ProgressReportRow[];
  title?: (locale: FeedbackLocale) => string;
  // freeze:block:failed=<...> 집계 이벤트의 문구.
  freezeRow?: (failed: string[], locale: FeedbackLocale) => string;
};

const AMRAP_REASON_RE = /^(increase|hold|reset):amrap-(\d+)reps/;
const ASYMPTOTE_DRIVERS = ["SQUAT", "BENCH", "PULL"] as const;

// asymptote(하이브리드) — v0.5.1 §F2 문구 그대로 보존(스냅샷 테스트로 고정).
const asymptoteCatalog: FamilyCatalog = {
  isNotableHold: (reason) => AMRAP_REASON_RE.test(reason) || reason === "hold:amrap-missing",
  title: (locale) => (locale === "ko" ? "블록 판정 — TM 변경 요약" : "Block judgment — TM changes"),
  buildRow: (decision, locale) => {
    const target = canonicalTarget(decision);
    const abbrev = TARGET_ABBREV[target] ?? target;
    const reason = String(decision.reason ?? "");

    if (reason === "hold:amrap-missing") {
      return locale === "ko"
        ? `${abbrev} — 판정 연기 — TM 유지`
        : `${abbrev} — judgment deferred — TM unchanged`;
    }

    if (reason.startsWith("derived:")) {
      const after = toKg(decision.after?.workKg);
      const source = target === "DEADLIFT" ? "SQ" : "BP";
      return locale === "ko"
        ? `${abbrev} — ${source} 연동 갱신${after !== null ? ` → ${formatKg(after)}` : ""}`
        : `${abbrev} — derived from ${source}${after !== null ? ` → ${formatKg(after)}` : ""}`;
    }

    const match = AMRAP_REASON_RE.exec(reason);
    if (!match) return null;
    const kind = match[1]!;
    const reps = Number(match[2]);
    const repsLabel = locale === "ko" ? `AMRAP ${reps}렙` : `AMRAP ${reps} reps`;

    if (kind === "hold") {
      return locale === "ko"
        ? `${abbrev} — ${repsLabel} → TM 유지 · 같은 무게 재도전`
        : `${abbrev} — ${repsLabel} → TM held · retry at the same weight`;
    }

    const before = toKg(decision.before?.workKg);
    const after = toKg(decision.after?.workKg);
    const range =
      before !== null && after !== null
        ? ` → TM ${formatKg(before)} → ${formatKg(after)} (${after >= before ? "+" : "−"}${formatKg(Math.abs(after - before))})`
        : "";
    if (kind === "increase") return `${abbrev} — ${repsLabel}${range}`;
    const isLight = reason.includes("+light");
    const suffix =
      locale === "ko"
        ? isLight
          ? " · 다음 블록 라이트(회복)"
          : " · 재조준"
        : isLight
          ? " · next block light (recovery)"
          : " · re-aim";
    return `${abbrev} — ${repsLabel}${range}${suffix}`;
  },
  // 드라이버 고정 순서(SQ→BP→PULL) + 결측 리프트 연기 명시(침묵 금지) + 파생(DL/OHP)은 뒤에.
  finalizeRows: (rows, _decisions, locale) => {
    const byTarget = new Map(rows.map((row) => [row.target, row]));
    const out: ProgressReportRow[] = [];
    for (const driver of ASYMPTOTE_DRIVERS) {
      const existing = byTarget.get(driver);
      if (existing) {
        out.push(existing);
        byTarget.delete(driver);
        continue;
      }
      const text = asymptoteCatalog.buildRow!(
        { progressionTarget: driver, reason: "hold:amrap-missing" },
        locale,
      )!;
      out.push({ target: driver, text });
    }
    for (const row of rows) {
      if (byTarget.has(row.target)) out.push(row);
    }
    return out;
  },
};

// operator(TB Operator Custom)·wendler-531 — 블록 완주 증량 + 동결(freeze) 표출.
const blockLpCatalog: FamilyCatalog = {
  title: (locale) => (locale === "ko" ? "블록 완주 — 증량 판정" : "Block complete — progression"),
  buildRow: (decision, locale) => {
    const reason = String(decision.reason ?? "");
    const match = /^increase:\+(\d+(?:\.\d+)?)kg$/.exec(reason);
    if (!match) return null;
    const label = displayLabel(decision, locale);
    const inc = formatKg(Number(match[1]));
    const streak = Math.floor(Number(decision.before?.successStreak ?? 0));
    const streakLabel =
      locale === "ko"
        ? streak > 0
          ? ` (${streak}연속 성공)`
          : " (블록 완주)"
        : streak > 0
          ? ` (${streak} in a row)`
          : " (block complete)";
    return `${label} +${inc}${streakLabel}`;
  },
  freezeRow: (failed, locale) => {
    const labels = failed.map((target) => LIFT_LABEL[locale][target] ?? target);
    return locale === "ko"
      ? `블록 완주 — 증량 동결 · TM 유지 (실패 누적: ${labels.join(", ")})`
      : `Block complete — increase frozen · TM unchanged (failed: ${labels.join(", ")})`;
  },
};

// gzclp(v2 stage 머신) — T3 AMRAP≥25 증량·스테이지 전이 표출.
const gzclpCatalog: FamilyCatalog = {
  isNotableHold: (reason) => reason === "hold:amrap<25" || reason.startsWith("stage-down:"),
  title: (locale) => (locale === "ko" ? "GZCLP 판정" : "GZCLP judgment"),
  buildRow: (decision, locale) => {
    const reason = String(decision.reason ?? "");
    const label = displayLabel(decision, locale);

    if (reason.startsWith("increase:amrap>=25:")) {
      const inc = parseIncrementFromReason(reason);
      return locale === "ko"
        ? `${label} — AMRAP ≥25렙 달성 → 증량${inc ? ` (${inc})` : ""}`
        : `${label} — AMRAP hit ≥25 reps → increase${inc ? ` (${inc})` : ""}`;
    }
    if (reason === "hold:amrap<25") {
      return locale === "ko"
        ? `${label} — AMRAP 25렙 미달 → 같은 무게 재도전`
        : `${label} — AMRAP under 25 reps → retry at the same weight`;
    }
    if (reason.startsWith("increase:stage-clear:")) {
      const inc = parseIncrementFromReason(reason);
      return locale === "ko"
        ? `${label} — 스테이지 클리어 → 증량${inc ? ` (${inc})` : ""} · 기본 스킴 복귀`
        : `${label} — stage cleared → increase${inc ? ` (${inc})` : ""} · back to base scheme`;
    }
    const stageMatch = /^stage-down:(\d+)->(\d+)$/.exec(reason);
    if (stageMatch) {
      return locale === "ko"
        ? `${label} — 실패 → 렙 스킴 강등(무게 유지, 단계 ${stageMatch[1]}→${stageMatch[2]})`
        : `${label} — failed → rep-scheme drop (weight held, stage ${stageMatch[1]}→${stageMatch[2]})`;
    }
    if (reason.startsWith("reset:stage-exhausted:")) {
      return (
        (locale === "ko"
          ? `${label} — 스킴 소진 → 무게 리셋`
          : `${label} — schemes exhausted → weight reset`) + deltaSuffix(decision)
      );
    }
    return null;
  },
};

const CATALOGS: Record<string, FamilyCatalog> = {
  asymptote: asymptoteCatalog,
  operator: blockLpCatalog,
  "wendler-531": blockLpCatalog,
  gzclp: gzclpCatalog,
  // texas-method·greyskull-lp·starting-strength-lp·stronglifts-5x5 등은 기본 폴백으로 커버.
};

// 단일 decision의 문구 — 카탈로그 우선, 미등록이면 기본 폴백(테스트·개별 표출용).
export function buildCatalogRow(
  program: string | null | undefined,
  decision: FeedbackDecision,
  locale: FeedbackLocale,
): string | null {
  const catalog = CATALOGS[String(program ?? "")] ?? null;
  return catalog?.buildRow?.(decision, locale) ?? fallbackRow(decision, locale);
}

// ── 집계 reason 파싱 ────────────────────────────────────────────────────────

export function parseBlockFreezeReason(reason: string | null | undefined): string[] | null {
  const raw = String(reason ?? "");
  if (!raw.startsWith("freeze:block:failed=")) return null;
  const list = raw
    .slice("freeze:block:failed=".length)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

// reducer가 기록한 `deload:trigger:regressed=SQUAT,PULL`에서 드라이버 목록을 복원(F1).
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

// ── F1. 조기 디로드 배너(문구+노출 판정) ────────────────────────────────────

export function buildEarlyDeloadBanner(
  input: {
    program: string | null | undefined;
    reason: string | null | undefined;
    // progression-state 경로: 아직 디로드 사이클(week 4) 진행 중일 때만 노출.
    // 저장 직후 경로(state 미제공): 방금 발동한 이벤트이므로 reason만으로 노출.
    state?: { week?: unknown } | null;
  },
  locale: FeedbackLocale,
): FeedbackBanner | null {
  if (input.program !== "asymptote") return null;
  const drivers = parseEarlyDeloadReason(input.reason);
  if (!drivers) return null;
  if (input.state && Math.floor(Number(input.state.week)) !== 4) return null;
  const abbrev = drivers.map((d) => TARGET_ABBREV[d] ?? d).join("·");
  return {
    title: locale === "ko" ? "⚠️ 조기 디로드 발동" : "⚠️ Early deload triggered",
    body:
      locale === "ko"
        ? `메인 리프트 2개에서 렙 급감이 누적돼 회복 사이클로 점프했어요${abbrev ? ` (${abbrev})` : ""}. TM은 유지됩니다.`
        : `Rep regression stacked up on two main lifts${abbrev ? ` (${abbrev})` : ""} — jumped to the recovery cycle. TM is unchanged.`,
  };
}

// ── 진행 판정 리포트(프로그램 공통) ─────────────────────────────────────────

// 최신 이벤트에 "주목할 판정"(INCREASE/RESET, 판정성 HOLD, 블록 동결)이 있을 때만 카드를 만든다.
// 블록 중간 스트릭 HOLD는 노이즈로 제외. 미등록 reason/패밀리는 기본 폴백 문구.
export function buildProgressReport(
  program: string | null | undefined,
  lastEvent: ProgressFeedbackEvent | null | undefined,
  locale: FeedbackLocale,
): ProgressReport | null {
  if (!lastEvent) return null;
  const catalog = CATALOGS[String(program ?? "")] ?? null;
  const decisions = (Array.isArray(lastEvent.targetDecisions) ? lastEvent.targetDecisions : []).filter(
    (d): d is FeedbackDecision => Boolean(d) && typeof d === "object",
  );
  const freezeFailed = parseBlockFreezeReason(lastEvent.reason);

  const notable = decisions.filter((decision) => {
    const eventType = String(decision.eventType ?? "").toUpperCase();
    if (eventType === "INCREASE" || eventType === "RESET") return true;
    const reason = String(decision.reason ?? "");
    return catalog?.isNotableHold?.(reason) === true;
  });
  if (notable.length === 0 && !freezeFailed) return null;

  let rows: ProgressReportRow[] = [];
  if (freezeFailed) {
    const text = (catalog?.freezeRow ?? blockLpCatalog.freezeRow!)(freezeFailed, locale);
    rows.push({ target: "__freeze__", text });
  }
  for (const decision of notable) {
    const text = catalog?.buildRow?.(decision, locale) ?? fallbackRow(decision, locale);
    if (text) rows.push({ target: canonicalTarget(decision) || String(decision.target ?? "?"), text });
  }
  if (catalog?.finalizeRows && !freezeFailed) {
    rows = catalog.finalizeRows(rows, decisions, locale);
  }
  if (rows.length === 0) return null;

  const title =
    catalog?.title?.(locale) ??
    (locale === "ko" ? "진행 판정 — 무게 변경 요약" : "Progression — weight changes");
  return { eventId: lastEvent.id, title, rows };
}

// ── 서버 조립 진입점 — plan_progress_event 행에서 바로 피드백을 만든다 ─────

// programSlug(이벤트 행에 저장된 템플릿 slug) → 카탈로그 키(ProgressionProgram) 매핑 포함.
// apps/api(progression-state)와 core 저장 서비스(logs upsert)가 같은 함수를 호출해
// web·TUI가 동일한 조립 문구를 받는다.
export function buildProgressionFeedbackFromEvent(
  input: {
    eventRow: {
      id: string;
      eventType: string;
      reason: string | null;
      meta: unknown;
      createdAt: Date | string;
      programSlug?: string | null;
    } | null;
    // progression-state 경로에서만 전달 — F1 노출 판정(week 4 진행 중)에 사용.
    state?: { week?: unknown } | null;
    definition?: unknown;
  },
  locale: FeedbackLocale,
): ProgressionFeedbackPayload {
  const row = input.eventRow;
  if (!row) return { report: null, earlyDeloadBanner: null };

  const program = resolveAutoProgressionProgram(String(row.programSlug ?? ""), input.definition);
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  const event: ProgressFeedbackEvent = {
    id: row.id,
    eventType: row.eventType,
    reason: row.reason ?? null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
    targetDecisions: Array.isArray(meta.targetDecisions) ? meta.targetDecisions : [],
  };

  return {
    report: buildProgressReport(program, event, locale),
    earlyDeloadBanner: buildEarlyDeloadBanner(
      { program, reason: event.reason, state: input.state ?? null },
      locale,
    ),
  };
}
