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

  const inner = hasData ? (
    <>
      <div className={`wr-session-summary-header${isToday ? " wr-session-summary-header--today" : ""}`}>
        <div className="wr-session-summary-meta">
          <div className="wr-session-summary-line">
            <span className={`wr-session-summary-badge${isToday ? " wr-session-summary-badge--today" : ""}`}>
              {data.badgeLabel}
            </span>
            <span className="wr-session-summary-date">{data.dateLabel}</span>
          </div>
        </div>
        {!isToday && (
          <div className="wr-session-summary-stats">
            {data.totalSets !== undefined && (
              <span className="wr-session-summary-stat">{data.totalSets}세트</span>
            )}
            {data.totalVolume !== undefined && data.totalVolume > 0 && (
              <>
                <span className="wr-session-summary-sep">·</span>
                <span className="wr-session-summary-stat">{formatVolume(data.totalVolume)}</span>
              </>
            )}
            {data.bodyweightKg != null && (
              <>
                <span className="wr-session-summary-sep">·</span>
                <span className="wr-session-summary-stat">BW {data.bodyweightKg.toFixed(1)}kg</span>
              </>
            )}
          </div>
        )}
        {isToday && data.bodyweightKg != null && (
          <span className="wr-session-summary-bw">BW {data.bodyweightKg.toFixed(1)}kg</span>
        )}
      </div>
      {data.exercises && data.exercises.length > 0 && (
        <div className="wr-session-exercises">
          {data.exercises.map((ex) => (
            <div key={ex.name} className="wr-session-exercise-row">
              <span className="wr-session-exercise-name">{ex.name}</span>
              <span className="wr-session-exercise-right">
                {ex.weightDelta != null && ex.weightDelta !== 0 && (
                  <span className={`hd-last-delta hd-last-delta--${ex.weightDelta > 0 ? "up" : "down"}`}>
                    {ex.weightDelta > 0 ? "+" : ""}{ex.weightDelta}kg
                  </span>
                )}
                <span className="wr-session-exercise-detail">{ex.bestSet}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {children}
    </>
  ) : (
    <>
      <div className="wr-session-summary-empty">{emptyMessage}</div>
      {children}
    </>
  );

  if (data?.href) {
    return (
      <Card as={Link} href={data.href} padding="none" interactive>
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
