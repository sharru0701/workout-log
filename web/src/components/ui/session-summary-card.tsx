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
      <div style={{ marginBottom: "var(--space-sm)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-xs)" }}>
          {data.badgeLabel ? (
            <span className="label label-neutral label-sm">
              {data.badgeLabel}
            </span>
          ) : <span />}
          <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)" }}>{data.dateLabel}</span>
        </div>
        {!isToday && hasStats ? (
          <div style={{ display: "flex", gap: "var(--space-xs)", font: "var(--font-secondary)", color: "var(--color-text-muted)" }}>
            {data.totalSets !== undefined && (
              <span>{data.totalSets}세트</span>
            )}
            {data.totalVolume !== undefined && data.totalVolume > 0 && (
              <>
                <span>·</span>
                <span>{formatVolume(data.totalVolume)}</span>
              </>
            )}
            {data.bodyweightKg != null && (
              <>
                <span>·</span>
                <span>BW {data.bodyweightKg.toFixed(1)}kg</span>
              </>
            )}
          </div>
        ) : null}
        {isToday && data.bodyweightKg != null && (
          <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)" }}>BW {data.bodyweightKg.toFixed(1)}kg</span>
        )}
      </div>
      {data.exercises && data.exercises.length > 0 && (
        <div>
          {data.exercises.map((ex) => (
            <div key={ex.name}>
              <span>{ex.name}</span>
              <span>
                {ex.weightDelta != null && ex.weightDelta !== 0 && (
                  <span>
                    {ex.weightDelta > 0 ? "+" : ""}{ex.weightDelta}kg
                  </span>
                )}
                <span>{ex.bestSet}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {children}
    </>
  ) : (
    <>
      <div>{emptyMessage}</div>
      {children}
    </>
  );

  if (data?.href) {
    return (
      <Card as={Link} href={data.href} padding="md" interactive>
        {inner}
      </Card>
    );
  }

  return (
    <Card as="article" padding="md">
      {inner}
    </Card>
  );
}
