import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "./card";

export type SessionSummaryExercise = {
  name: string;
  bestSet: string;
  weightDelta?: number | null;
};

export type SessionSummaryCardData = {
  badgeLabel: string;
  dateLabel: string;
  totalSets?: number;
  totalVolume?: number;
  bodyweightKg?: number | null;
  exercises?: SessionSummaryExercise[];
  href?: string;
};

function formatVolume(kg: number) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg}kg`;
}

export function SessionSummaryCard({
  data,
  variant = "default",
  emptyMessage = "지난 세션 없음",
  children,
}: {
  data: SessionSummaryCardData | null | undefined;
  variant?: "default" | "today";
  emptyMessage?: string;
  children?: ReactNode;
}) {
  const isToday = variant === "today";
  const hasData = data && data.dateLabel;
  const hasStats =
    data != null &&
    (
      data.totalSets !== undefined ||
      (data.totalVolume !== undefined && data.totalVolume > 0) ||
      data.bodyweightKg != null
    );

  const inner = hasData ? (
    <>
      <div className={`session-card-header${isToday ? " session-card-header--today" : ""}`}>
        <div className="session-card-meta">
          <span className={`session-card-badge${isToday ? " session-card-badge--today" : ""}`}>
            {data.badgeLabel}
          </span>
          <span className="session-card-date">{data.dateLabel}</span>
        </div>
        {!isToday && hasStats ? (
          <div className="session-card-stats">
            {data.totalSets !== undefined && (
              <span className="session-card-stat">{data.totalSets}세트</span>
            )}
            {data.totalVolume !== undefined && data.totalVolume > 0 && (
              <>
                <span className="session-card-sep">·</span>
                <span className="session-card-stat">{formatVolume(data.totalVolume)}</span>
              </>
            )}
            {data.bodyweightKg != null && (
              <>
                <span className="session-card-sep">·</span>
                <span className="session-card-stat">BW {data.bodyweightKg.toFixed(1)}kg</span>
              </>
            )}
          </div>
        ) : null}
        {isToday && data.bodyweightKg != null && (
          <span className="session-card-bw">BW {data.bodyweightKg.toFixed(1)}kg</span>
        )}
      </div>
      {data.exercises && data.exercises.length > 0 && (
        <div className="session-card-exercises">
          {data.exercises.map((ex) => (
            <div key={ex.name} className="session-card-exercise-row">
              <span className="session-card-exercise-name">{ex.name}</span>
              <span className="session-card-exercise-right">
                {ex.weightDelta != null && ex.weightDelta !== 0 && (
                  <span className={`session-card-delta session-card-delta--${ex.weightDelta > 0 ? "up" : "down"}`}>
                    {ex.weightDelta > 0 ? "+" : ""}{ex.weightDelta}kg
                  </span>
                )}
                <span className="session-card-exercise-detail">{ex.bestSet}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {children}
    </>
  ) : (
    <>
      <div className="session-card-empty">{emptyMessage}</div>
      {children}
    </>
  );

  if (data?.href) {
    return (
      <Card as={Link} href={data.href} padding="none" interactive className="session-card-link">
        {inner}
      </Card>
    );
  }

  return (
    <Card as="article" padding="none">
      {inner}
    </Card>
  );
}
