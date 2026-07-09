"use client";

/**
 * v2-session-summary terminal(ironlog) 스킨 본문. paper 본문과 동일한 SummaryData·라벨을 받아
 * 표현만 TUI로: 콘페티/히어로 대신 헤더 readout + 스탯 + records(★) + 운동별 + 노트 + [홈으로].
 * --term-* 토큰만. 로직은 v2-session-summary.model.ts.
 */

import Link from "next/link";
import { TermBadge } from "./terminal";
import type {
  ExerciseSummary,
  ResolvedGoal,
  SummaryData,
} from "./v2-session-summary.model";

type TermStatTone = "gold" | "cyan";

/**
 * terminal 볼륨 표기. paper는 `formatVolumeShort`(예: "4.1k")의 숫자부에 "kg"를
 * 따로 붙이지만, terminal에서는 인라인이라 "4.1k"+"kg"="4.1kkg"로 뭉개진다.
 * 다른 TUI 뷰(home/stats/exercise-detail)의 formatKg와 동일하게 ≥1000은 톤(t),
 * 그 미만은 그대로 kg로 단위를 한 번만 붙인다.
 */
function formatTermVolume(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return "0kg";
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg).toLocaleString()}kg`;
}

function TermSummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: TermStatTone;
}) {
  return (
    <span style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-s-2)" }}>
      <span style={{ color: "var(--term-dim)" }}>{label}</span>
      <span style={{ color: tone === "gold" ? "var(--term-gold)" : "var(--term-cyan)" }}>
        {value}
      </span>
    </span>
  );
}

type TermStatCell = {
  key: string;
  label: string;
  value: string;
  tone: TermStatTone;
};

/**
 * paper BigStat의 goal별 차별화를 terminal readout 순서·강조로 재현.
 * strength=top e1RM(gold) 우선, endurance=시간+세트 우선, 기타=볼륨 우선.
 * 항상 같은 5종(볼륨/세트/reps/시간/e1RM)을 노출하되 순서로 주요 지표를 드러낸다.
 */
function buildTermStatCells(
  summary: SummaryData,
  goal: ResolvedGoal,
  durationLabel: string | null,
  ko: boolean,
): TermStatCell[] {
  const volume: TermStatCell = {
    key: "volume",
    label: ko ? "총 볼륨" : "volume",
    value: formatTermVolume(summary.totalVolume),
    tone: "cyan",
  };
  const sets: TermStatCell = {
    key: "sets",
    label: ko ? "세트" : "sets",
    value: String(summary.totalSets),
    tone: "cyan",
  };
  const reps: TermStatCell = {
    key: "reps",
    label: "reps",
    value: summary.totalReps.toLocaleString(),
    tone: "cyan",
  };
  const time: TermStatCell = {
    key: "time",
    label: ko ? "시간" : "time",
    value: durationLabel ?? "—",
    tone: "cyan",
  };
  const e1rm: TermStatCell | null = summary.topEstOneRm
    ? {
        key: "e1rm",
        label: ko ? "최고 e1RM" : "top e1RM",
        value: `${summary.topEstOneRm.estOneRm.toFixed(1)}kg`,
        tone: "gold",
      }
    : null;

  if (goal === "strength") {
    // 주요: top e1RM(gold) → 시간 → 볼륨 → 세트 → reps
    return [e1rm, time, volume, sets, reps].filter(
      (c): c is TermStatCell => c != null,
    );
  }
  if (goal === "endurance") {
    // 주요: 시간 → 세트 → reps → 볼륨 → (e1RM)
    return [time, sets, reps, volume, e1rm].filter(
      (c): c is TermStatCell => c != null,
    );
  }
  // hypertrophy/general — 주요: 볼륨 → 세트 → 시간 → reps → (e1RM)
  return [volume, sets, time, reps, e1rm].filter(
    (c): c is TermStatCell => c != null,
  );
}

/** paper 운동별 우측 메트릭과 동일: strength=top kg, endurance=reps, 기타=volume. */
function termExerciseMetric(ex: ExerciseSummary, goal: ResolvedGoal): string {
  if (goal === "strength") {
    return ex.topWeightKg > 0
      ? `${ex.topWeightKg.toLocaleString()}kg${
          ex.topWeightSuffix ? ` ${ex.topWeightSuffix}` : ""
        }`
      : "—";
  }
  if (goal === "endurance") {
    return `${ex.totalReps.toLocaleString()} reps`;
  }
  return ex.volumeKg > 0
    ? formatTermVolume(ex.volumeKg)
    : ex.topWeightKg > 0
      ? `${ex.topWeightKg.toLocaleString()}kg`
      : "—";
}

/**
 * paper 운동별 sub-line의 보조 메트릭(주요 메트릭과 중복 없이):
 * strength=볼륨, endurance=top kg, 기타=top kg. 없으면 빈 문자열.
 */
function termExerciseSubMetric(ex: ExerciseSummary, goal: ResolvedGoal): string {
  if (goal === "strength") {
    return ex.volumeKg > 0 ? formatTermVolume(ex.volumeKg) : "";
  }
  // endurance / hypertrophy / general — top kg 병기(맨몸 suffix 포함)
  return ex.topWeightKg > 0
    ? `top ${ex.topWeightKg.toLocaleString()}kg${
        ex.topWeightSuffix ? ` ${ex.topWeightSuffix}` : ""
      }`
    : "";
}

export function SessionSummaryTuiView({
  summary,
  notes,
  durationLabel,
  performedAtLabel,
  resolvedGoal,
  heroTitle,
  heroEyebrow,
  freshComplete,
  locale,
}: {
  summary: SummaryData;
  notes: string | null;
  durationLabel: string | null;
  performedAtLabel: string;
  resolvedGoal: ResolvedGoal;
  heroTitle: string;
  heroEyebrow: string;
  freshComplete: boolean;
  locale: "ko" | "en";
}) {
  const ko = locale === "ko";
  return (
    <section
      aria-label={ko ? "세션 요약" : "Session summary"}
      style={{
        // 뷰페인을 채워(부모 div가 min-height:100%) 하단 액션을 바닥에 고정 →
        // 짧은 요약에서 콘텐츠와 status bar 사이에 생기던 큰 빈 공간을 없앤다.
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "var(--v2-s-4)",
        padding: "var(--v2-s-3) 0",
      }}
    >
      {/* 헤더 */}
      <div
        className="v2-mono-label"
        style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}
      >
        <span style={{ color: freshComplete ? "var(--term-gold)" : "var(--term-dim)" }}>
          {freshComplete ? "▸ " : ""}
          {heroEyebrow}
        </span>
        <span style={{ color: "var(--term-fg)", fontSize: "var(--v2-t-20)" }}>
          {heroTitle}
        </span>
        <span style={{ color: "var(--term-dim)" }}>
          {performedAtLabel}
          {durationLabel ? ` · ${durationLabel}` : ""}
        </span>
      </div>

      {/* 스탯 readout — paper와 동일하게 goal별로 주요 스탯을 앞·강조.
          auto 컬럼 + justify start로 라벨·값 쌍을 내용 너비에 묶어 왼쪽 정렬한다.
          (1fr 컬럼이면 "시간 —"처럼 짧은 값이 화면 우측 끝까지 밀려 큰 여백이 생김) */}
      <div
        className="v2-mono-label"
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto",
          justifyContent: "start",
          gap: "var(--v2-s-1) var(--v2-s-7)",
        }}
      >
        {buildTermStatCells(summary, resolvedGoal, durationLabel, ko).map((c) => (
          <TermSummaryCell key={c.key} label={c.label} value={c.value} tone={c.tone} />
        ))}
      </div>

      {/* records (★) — paper PR 카드와 동일하게 source(자동증량/신기록) 구분 +
          progression은 before→after 진행, personal은 EST 1RM 갱신폭 표기. */}
      {summary.prCards.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}>
          <span className="v2-mono-label" style={{ color: "var(--term-dim)" }}>
            {ko ? "기록" : "records"}
          </span>
          {summary.prCards.map((p) => {
            const isPersonal = p.source === "personal";
            // paper: personal=새 PR/NEW PR, progression=증량 성공/PROGRESSED
            const eyebrow = isPersonal
              ? ko
                ? "새PR"
                : "NEW PR"
              : ko
                ? "증량"
                : "PROGRESSED";
            return (
              <div
                key={`${p.source}:${p.target}`}
                className="v2-mono-label"
                style={{ display: "flex", alignItems: "center", gap: "var(--v2-s-2)" }}
              >
                <span style={{ color: "var(--term-gold)" }}>★</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "var(--term-fg)",
                  }}
                >
                  <span style={{ color: "var(--term-dim)" }}>{eyebrow} </span>
                  {p.target}
                  <span style={{ color: "var(--term-dim)" }}>
                    {" · "}
                    {isPersonal
                      ? `${p.afterWorkKg.toFixed(1)}kg${
                          (p.estOneRm ?? 0) > 0
                            ? ` · e1RM ${(p.estOneRm ?? 0).toFixed(1)}`
                            : ""
                        }`
                      : p.beforeWorkKg != null
                        ? `${p.beforeWorkKg.toFixed(1)}→${p.afterWorkKg.toFixed(1)}kg${
                            (p.estOneRm ?? 0) > 0
                              ? ` · e1RM ${(p.estOneRm ?? 0).toFixed(1)}`
                              : ""
                          }`
                        : `${p.afterWorkKg.toFixed(1)}kg${
                            (p.estOneRm ?? 0) > 0
                              ? ` · e1RM ${(p.estOneRm ?? 0).toFixed(1)}`
                              : ""
                          }`}
                  </span>
                </span>
                <TermBadge tone={isPersonal ? "pr" : "success"}>
                  {isPersonal && !(p.deltaKg > 0)
                    ? "PR"
                    : `+${p.deltaKg.toFixed(1)}`}
                </TermBadge>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* 운동별 */}
      {summary.exerciseSummaries.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}>
          <span className="v2-mono-label" style={{ color: "var(--term-dim)" }}>
            {ko ? "운동별" : "by exercise"}
          </span>
          {summary.exerciseSummaries.map((ex, i) => {
            const isPr = summary.prKeys.has(ex.name.trim().toLowerCase());
            // paper 운동별 주요 메트릭: strength=top kg, endurance=reps, 기타=volume.
            const metric = termExerciseMetric(ex, resolvedGoal);
            const subMetric = termExerciseSubMetric(ex, resolvedGoal);
            return (
              <div
                key={`${ex.name}-${i}`}
                className="v2-mono-label"
                style={{ display: "flex", alignItems: "center", gap: "var(--v2-s-2)" }}
              >
                <span style={{ color: "var(--term-ghost)", minWidth: "var(--v2-s-5)" }}>
                  #{i + 1}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "var(--term-fg)",
                  }}
                >
                  {ex.name}
                  <span style={{ color: "var(--term-dim)" }}>
                    {" "}
                    · {ex.setCount}
                    {ko ? "세트" : " sets"}
                    {subMetric ? ` · ${subMetric}` : ""}
                  </span>
                </span>
                {isPr ? <TermBadge tone="pr">PR</TermBadge> : null}
                <span style={{ color: "var(--term-cyan)", whiteSpace: "nowrap" }}>
                  {metric}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* 노트 */}
      {notes && notes.trim().length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}>
          <span className="v2-mono-label" style={{ color: "var(--term-dim)" }}>
            {ko ? "노트" : "notes"}
          </span>
          <p
            className="v2-mono-label"
            style={{ color: "var(--term-fg)", whiteSpace: "pre-wrap", margin: 0 }}
          >
            {notes}
          </p>
        </div>
      ) : null}

      {/* 액션 — marginTop auto로 뷰페인 바닥에 고정(콘텐츠는 상단 정렬) */}
      <Link
        href="/"
        className="v2-mono-label"
        style={{
          marginTop: "auto",
          minHeight: "var(--v2-touch)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 var(--v2-s-3)",
          background: "var(--term-sel)",
          color: "var(--term-amber)",
          textDecoration: "none",
          boxShadow: "inset 0 0 0 1px var(--term-line-box)",
          borderRadius: "var(--v2-r-2)",
        }}
      >
        [{ko ? "홈으로" : "home"}]
      </Link>
    </section>
  );
}
