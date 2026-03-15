"use client";

import Link from "next/link";
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

function ExerciseGroupedList({ exercises }: { exercises: SessionCardExercise[] }) {
  if (exercises.length === 0) return null;
  const main = exercises.filter((e) => e.role === "MAIN");
  const assist = exercises.filter((e) => e.role !== "MAIN");
  return (
    <div>
      {main.length > 0 && (
        <div>
          {main.map((ex) => (
            <div key={ex.name}>
              <span>{ex.name}</span>
              <span>{ex.summary}</span>
            </div>
          ))}
        </div>
      )}
      {assist.length > 0 && (
        <div>
          {assist.slice(0, 3).map((ex) => (
            <div key={ex.name}>
              <span>{ex.name}</span>
              <span>{ex.summary}</span>
            </div>
          ))}
          {assist.length > 3 && (
            <div>
              +{assist.length - 3}개 보조 운동
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExerciseFlatList({ exercises }: { exercises: SessionCardExercise[] }) {
  if (exercises.length === 0) return null;
  return (
    <div>
      {exercises.map((ex) => (
        <div key={ex.name}>
          <span>{ex.name}</span>
          <span>
            {ex.weightDelta != null && ex.weightDelta !== 0 && (
              <span>
                {ex.weightDelta > 0 ? "+" : ""}{ex.weightDelta}kg
              </span>
            )}
            <span>{ex.summary}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

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
      <div>
        <div>
          <div>{title}</div>
          {meta && <p>{meta}</p>}
        </div>
        {badge && <span>{badge}</span>}
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
          <PrimaryButton as="div" variant="primary" size="lg" fullWidth interactive={false}>
            <span>{ctaLabel}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </PrimaryButton>
        ) : (
          <PrimaryButton as="a" href={ctaHref} variant="primary" size="lg" fullWidth>
            <span>{ctaLabel}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </PrimaryButton>
        )
      )}
    </>
  );

  if (href) return <Card as={Link} href={href} padding="none">{inner}</Card>;
  return <Card padding="none">{inner}</Card>;
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
      <div>
        <div>
          <div>{title}</div>
          <div>{date}</div>
        </div>
        <div>
          {totalSets !== undefined && (
            <span>{totalSets}세트</span>
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
              <span>BW {bodyweightKg.toFixed(1)}kg</span>
            </>
          )}
        </div>
      </div>
      <ExerciseFlatList exercises={exercises} />
    </>
  ) : (
    <div>{emptyMessage}</div>
  );

  if (href) return <Card as={Link} href={href} padding="none">{inner}</Card>;
  return <Card padding="none">{inner}</Card>;
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
