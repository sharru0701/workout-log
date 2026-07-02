"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { V2Card } from "@/components/v2/primitives";

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
  emptyMessage,
  children,
}: {
  data: SessionSummaryCardData | null | undefined;
  variant?: "default" | "today";
  emptyMessage?: string;
  children?: ReactNode;
}) {
  const { locale } = useLocale();
  const isToday = variant === "today";
  const hasData = data && data.dateLabel;
  const resolvedEmptyMessage = emptyMessage ?? (locale === "ko" ? "지난 세션 없음" : "No previous session");
  const hasStats =
    data != null &&
    (
      data.totalSets !== undefined ||
      (data.totalVolume !== undefined && data.totalVolume > 0) ||
      data.bodyweightKg != null
    );

  const inner = hasData ? (
    <>
      <div style={{ marginBottom: "var(--v2-s-2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--v2-s-1)" }}>
          {data.badgeLabel ? (
            <h3 className="v2-h2 card-title" style={{ color: "var(--text-session-name)", margin: 0, lineHeight: 1 }}>
              {data.badgeLabel}
            </h3>
          ) : <span />}
          <span className="v2-small" style={{ color: "var(--text-session-date)", lineHeight: 1, paddingBottom: 2 }}>{data.dateLabel}</span>
        </div>
        {!isToday && hasStats ? (
          <div className="v2-small" style={{ display: "flex", gap: "var(--v2-s-1)", color: "var(--text-meta)" }}>
            {data.totalSets !== undefined && (
              <span>{locale === "ko" ? `${data.totalSets}세트` : `${data.totalSets} sets`}</span>
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
                <span>{locale === "ko" ? `체중 ${data.bodyweightKg.toFixed(1)}kg` : `BW ${data.bodyweightKg.toFixed(1)}kg`}</span>
              </>
            )}
          </div>
        ) : null}
        {isToday && data.bodyweightKg != null && (
          <span className="v2-small" style={{ color: "var(--text-meta)" }}>
            {locale === "ko" ? `체중 ${data.bodyweightKg.toFixed(1)}kg` : `BW ${data.bodyweightKg.toFixed(1)}kg`}
          </span>
        )}
      </div>
      {data.exercises && data.exercises.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}>
          {data.exercises.map((ex) => (
            <div key={ex.name} style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-s-2)" }}>
              <span className="v2-body" style={{ color: "var(--text-exercise-name)", fontWeight: 600 }}>{ex.name}</span>
              <span className="v2-small" style={{ color: "var(--text-meta)", fontVariantNumeric: "tabular-nums" }}>
                {ex.weightDelta != null && ex.weightDelta !== 0 && (
                  <span className={`metric-trend ${ex.weightDelta > 0 ? "metric-trend--up" : "metric-trend--down"}`} style={{ marginRight: "var(--v2-s-1)" }}>
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
      <div className="v2-small" style={{ color: "var(--text-hint)" }}>{resolvedEmptyMessage}</div>
      {children}
    </>
  );

  if (data?.href) {
    return (
      <Link
        href={data.href}
        style={{ display: "block", textDecoration: "none", color: "inherit" }}
      >
        <V2Card padding="var(--v2-s-4)">{inner}</V2Card>
      </Link>
    );
  }

  return (
    <V2Card padding="var(--v2-s-4)">
      {inner}
    </V2Card>
  );
}
