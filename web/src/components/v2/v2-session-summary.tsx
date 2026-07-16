"use client";

/**
 * 세션 요약 진입점(오케스트레이터). 로그 응답을 buildSummaryData로 접고 파생 라벨을 계산한 뒤
 * paper 본문에 전달한다.
 * - 로직: v2-session-summary.model.ts (React/DOM 무지, 유닛 테스트 대상)
 * - paper 본문: v2-session-summary-paper-view.tsx
 */

import { useMemo } from "react";
import { useLocale } from "@/components/locale-provider";
import { V2Card, V2Chip } from "./primitives";
import {
  buildSummaryData,
  formatDurationLong,
  formatPerformedAt,
  getHeroCopy,
  resolveGoal,
} from "./v2-session-summary.model";
import { PaperSessionSummaryBody } from "./v2-session-summary-paper-view";

export type {
  V2SummarySet,
  V2SummaryLog,
  V2PersonalRecord,
} from "./v2-session-summary.model";

import type { V2SummaryLog } from "./v2-session-summary.model";

export function V2SessionSummary({
  log,
  freshComplete = false,
}: {
  log: V2SummaryLog | null;
  /** true면 "방금 완료한 세션" 모드 (콘페티 + 큰 헤로 + 셀러브레이션 카피) */
  freshComplete?: boolean;
}) {
  const { locale } = useLocale();

  const summary = useMemo(() => (log ? buildSummaryData(log) : null), [log]);

  if (!log || !summary) return null;

  const durationLabel = formatDurationLong(log.durationMinutes);
  const performedAtLabel = formatPerformedAt(log.performedAt, locale);
  const resolvedGoal = resolveGoal(log.goal);
  const { title: heroTitle, eyebrow: heroEyebrow } = getHeroCopy(
    resolvedGoal,
    locale,
    freshComplete,
  );

  const bodyProps = {
    summary,
    notes: log.notes,
    durationLabel,
    performedAtLabel,
    resolvedGoal,
    heroTitle,
    heroEyebrow,
    freshComplete,
    locale,
  };

  return <PaperSessionSummaryBody {...bodyProps} />;
}

/* PR Card 노출용 (선택적 사용) */
export function V2PRCard({
  exerciseName,
  topWeightKg,
  estOneRm,
  previousBestKg,
}: {
  exerciseName: string;
  topWeightKg: number;
  estOneRm: number;
  previousBestKg?: number | null;
}) {
  const { locale } = useLocale();
  const delta = previousBestKg ? topWeightKg - previousBestKg : null;

  return (
    <div style={{ padding: "var(--v2-s-2) var(--v2-s-4) 0px" }}>
      <V2Card
        padding="var(--v2-s-5)"
        style={{
          background:
            "color-mix(in srgb, var(--v2-c-pr) 12%, var(--v2-paper))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--v2-s-3)" }}>
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: "var(--v2-t-h1)",
              color: "var(--v2-c-pr)",
              fontVariationSettings: "'FILL' 1, 'wght' 600",
            }}
            aria-hidden
          >
            workspace_premium
          </span>
          <div style={{ flex: 1 }}>
            <div
              className="v2-label"
              style={{ color: "var(--v2-c-pr)", fontSize: "var(--v2-t-eyebrow)" }}
            >
              {locale === "ko" ? "새 PR" : "NEW PR"}
            </div>
            <div className="v2-h2" style={{ fontSize: "var(--v2-t-20)", marginTop: 2 }}>
              {exerciseName} ·{" "}
              <span style={{ color: "var(--v2-c-pr)" }}>
                {topWeightKg.toFixed(1)} kg
              </span>
            </div>
            <div
              className="v2-mono-label"
              style={{ color: "var(--v2-ink-3)", marginTop: 4 }}
            >
              EST. 1RM {estOneRm.toFixed(1)}kg
              {delta != null
                ? ` · ${delta > 0 ? "+" : ""}${delta.toFixed(1)}`
                : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-s-1)", marginTop: 12 }}>
          <V2Chip tone="pr" icon="trending_up">
            {locale === "ko" ? "기록" : "Record"}
          </V2Chip>
        </div>
      </V2Card>
    </div>
  );
}
