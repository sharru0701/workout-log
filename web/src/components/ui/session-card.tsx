"use client";

import Link from "next/link";
import { memo } from "react";
import type { ReactNode } from "react";
import { Card } from "./card";
import { PrimaryButton } from "./primary-button";

export type SessionCardExercise = {
  name: string;
  /** Present → grouped layout (MAIN / ASSIST). Absent → flat layout. */
  role?: "MAIN" | "ASSIST" | string;
  /** Display string e.g. "3x5 @ 110kg" */
  summary: string;
  weightDelta?: number | null;
};

function formatVolume(kg: number): string {
  if (kg >= 1000) {
    const t = kg / 1000;
    return t % 1 === 0 ? `${t}t` : `${t.toFixed(1)}t`;
  }
  return `${kg}kg`;
}

// ─── Shared exercise list sub-components ──────────────────────────────────────

const ExerciseGroupedList = memo(function ExerciseGroupedList({ exercises }: { exercises: SessionCardExercise[] }) {
  if (exercises.length === 0) return null;
  const main = exercises.filter((e) => e.role === "MAIN");
  const assist = exercises.filter((e) => e.role !== "MAIN");
  return (
    <div>
      {main.length > 0 && (
        <div>
          {main.map((ex) => (
            <div key={ex.name} style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
              {/* INFO COLOR: exercise-name — 주 운동명은 즉시 식별 가능한 강조톤 */}
              <span style={{ font: "var(--font-card-title)", color: "var(--text-exercise-name)", fontWeight: "var(--font-weight-exercise-name)" }}>{ex.name}</span>
              <span style={{ font: "var(--font-secondary)", color: "var(--text-meta)", fontVariantNumeric: "tabular-nums" }}>{ex.summary}</span>
            </div>
          ))}
        </div>
      )}
      {assist.length > 0 && (
        <div style={{ marginTop: "var(--space-sm)", paddingTop: "var(--space-sm)", borderTop: "1px dashed var(--color-border)" }}>
          {assist.slice(0, 3).map((ex) => (
            <div key={ex.name} style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
              {/* INFO COLOR: exercise-name (assist) — 보조 운동은 muted 컨텍스트톤으로 위계 조정 */}
              <span style={{ font: "var(--font-secondary)", color: "var(--text-session-context)" }}>{ex.name}</span>
              <span style={{ font: "var(--font-secondary)", color: "var(--text-hint)", fontVariantNumeric: "tabular-nums" }}>{ex.summary}</span>
            </div>
          ))}
          {assist.length > 3 && (
            <div style={{ font: "var(--font-secondary)", color: "var(--text-hint)", textAlign: "right", marginTop: "var(--space-xs)" }}>
              +{assist.length - 3} more assist
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const ExerciseFlatList = memo(function ExerciseFlatList({ exercises }: { exercises: SessionCardExercise[] }) {
  if (exercises.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      {exercises.map((ex) => (
        <div key={ex.name} style={{ display: "flex", justifyContent: "space-between" }}>
          {/* INFO COLOR: exercise-name — 운동명은 700 weight와 강조톤으로 요약보다 먼저 읽힘 */}
          <span style={{ font: "var(--font-card-title)", color: "var(--text-exercise-name)", fontWeight: "var(--font-weight-exercise-name)" }}>{ex.name}</span>
          <span style={{ font: "var(--font-secondary)", color: "var(--text-meta)", fontVariantNumeric: "tabular-nums" }}>
            {ex.weightDelta != null && ex.weightDelta !== 0 && (
              <span className={`metric-trend ${ex.weightDelta > 0 ? "metric-trend--up" : "metric-trend--down"}`} style={{ marginRight: "var(--space-xs)" }}>
                {ex.weightDelta > 0 ? "+" : ""}{ex.weightDelta}kg
              </span>
            )}
            <span>{ex.summary}</span>
          </span>
        </div>
      ))}
    </div>
  );
});

// ─── "today" variant ───────────────────────────────────────────────────────────
// Used for: home 오늘의 운동 카드, 캘린더 하단 상세카드

export type TodaySessionCardProps = {
  variant: "today";
  /** If set, the whole card is a <Link>; CTA renders as a non-interactive <div>. */
  href?: string;
  className?: string;
  title: string;
  badge?: string | null;
  meta?: string | null;
  exercises?: SessionCardExercise[];
  ctaLabel?: string;
  /** Required when href is unset so CTA becomes a real <a>. */
  ctaHref?: string;
  /** Shown instead of CTA button when action is blocked. */
  ctaNote?: string | null;
  children?: ReactNode;
};

function TodayCard({
  href,
  className,
  title,
  badge,
  meta,
  exercises = [],
  ctaLabel,
  ctaHref,
  ctaNote,
  children,
}: Omit<TodaySessionCardProps, "variant">) {
  const hasGrouped = exercises.some((e) => e.role != null);
  const cls = ["hd-today-card", className].filter(Boolean).join(" ");

  const inner = (
    <>
      <div className="card-header">
        <div>
          {/* INFO COLOR: session-name — 오늘 세션 제목은 plan/program identity */}
          <div className="card-title" style={{ color: "var(--text-session-name)", font: "var(--font-card-title)", fontWeight: 700 }}>{title}</div>
          {meta && <p style={{ font: "var(--font-secondary)", color: "var(--text-session-context)", margin: 0, marginTop: "2px" }}>{meta}</p>}
        </div>
        {badge && <span className="label label-tag-session">{badge}</span>}
      </div>

      {hasGrouped ? (
        <ExerciseGroupedList exercises={exercises} />
      ) : (
        <ExerciseFlatList exercises={exercises} />
      )}

      {children}

      {ctaNote && <p>{ctaNote}</p>}

      {ctaLabel && (
        href ? (
          <PrimaryButton as="div" variant="primary" size="lg" fullWidth interactive={false} className="btn btn-primary" style={{ marginTop: "var(--space-md)" }}>
            <span>{ctaLabel}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, marginLeft: "var(--space-xs)" }}>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </PrimaryButton>
        ) : (
          <PrimaryButton as="a" href={ctaHref} variant="primary" size="lg" fullWidth className="btn btn-primary" style={{ marginTop: "var(--space-md)" }}>
            <span>{ctaLabel}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, marginLeft: "var(--space-xs)" }}>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </PrimaryButton>
        )
      )}
    </>
  );

  if (href) return <Card as={Link} href={href} padding="md">{inner}</Card>;
  return <Card padding="md">{inner}</Card>;
}

// ─── "last" variant ────────────────────────────────────────────────────────────
// Used for: home 지난 세션 카드, /기록 지난 세션 카드

export type LastSessionCardProps = {
  variant: "last";
  href?: string;
  title: string;
  date?: string | null;
  totalSets?: number;
  totalVolume?: number;
  bodyweightKg?: number | null;
  exercises?: SessionCardExercise[];
  emptyMessage?: string;
};

function LastCard({
  href,
  title,
  date,
  totalSets,
  totalVolume,
  bodyweightKg,
  exercises = [],
  emptyMessage = "지난 세션 없음",
}: Omit<LastSessionCardProps, "variant">) {
  const hasData = !!date;

  const inner = hasData ? (
    <>
      <div className="card-header">
        <div>
          {/* INFO COLOR: plan-name — 지난 세션 제목은 program/plan identity */}
          <div className="card-title" style={{ color: "var(--text-plan-name)", font: "var(--font-card-title)", fontWeight: 600 }}>{title}</div>
          {/* INFO COLOR: session-context — 날짜는 계획/컨텍스트 정보이므로 강조톤 */}
          <div style={{ font: "var(--font-secondary)", color: "var(--text-session-date)" }}>{date}</div>
        </div>
        {/* INFO COLOR: meta-muted — 총 세트/볼륨은 참고 통계로 muted */}
        <div style={{ font: "var(--font-secondary)", color: "var(--text-meta)", display: "flex", gap: "var(--space-xs)", fontVariantNumeric: "tabular-nums" }}>
          {totalSets !== undefined && (
            <span>{totalSets} sets</span>
          )}
          {totalVolume !== undefined && totalVolume > 0 && (
            <>
              <span>·</span>
              <span>{formatVolume(totalVolume)}</span>
            </>
          )}
          {bodyweightKg != null && (
            <>
              <span>·</span>
              <span style={{ color: "var(--text-session-context)" }}>BW {bodyweightKg.toFixed(1)}kg</span>
            </>
          )}
        </div>
      </div>
      <ExerciseFlatList exercises={exercises} />
    </>
  ) : (
    <div>{emptyMessage}</div>
  );

  if (href) return <Card as={Link} href={href} padding="md">{inner}</Card>;
  return <Card padding="md">{inner}</Card>;
}

// ─── Unified export ────────────────────────────────────────────────────────────

export type SessionCardProps = TodaySessionCardProps | LastSessionCardProps;

export function SessionCard(props: SessionCardProps) {
  if (props.variant === "today") {
    const { variant: _v, ...rest } = props;
    return <TodayCard {...rest} />;
  }
  const { variant: _v, ...rest } = props;
  return <LastCard {...rest} />;
}
