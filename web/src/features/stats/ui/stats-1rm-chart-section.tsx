"use client";

import { memo } from "react";
import type { E1RMPoint, E1RMResponse } from "@/features/stats/model/stats-1rm-types";

function formatPointDate(dateIso: string, locale: "ko" | "en") {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export const Stats1RMChartSection = memo(function Stats1RMChartSection({
  locale,
  stats,
  activePoint,
  chart,
}: {
  locale: "ko" | "en";
  stats: E1RMResponse | null;
  activePoint: E1RMPoint | null;
  chart: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <div
        style={{
          background: "var(--color-surface-container-low)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 1px 3px var(--shadow-color-soft)",
        }}
      >
        <header
          style={{
            padding: "var(--space-md)",
            borderBottom:
              "1px solid color-mix(in srgb, var(--color-outline-variant) 12%, transparent)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  letterSpacing: "-0.3px",
                  color: "var(--color-text)",
                  margin: "0 0 2px 0",
                }}
              >
                {locale === "ko" ? "e1RM 상세 추이" : "Detailed e1RM Trend"}
              </h2>
              {stats ? (
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  {formatPointDate(stats.from, locale)} ~ {formatPointDate(stats.to, locale)}
                </div>
              ) : null}
            </div>
            <div className="metric-1rm" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span className="metric-value" style={{ fontSize: "24px" }}>
                {activePoint ? `${activePoint.e1rm.toFixed(1)}` : "-"}
                <span style={{ fontSize: "14px", marginLeft: "2px", fontWeight: 400 }}>kg</span>
              </span>
              <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)" }}>
                {activePoint ? formatPointDate(activePoint.date, locale) : "-"}
              </span>
            </div>
          </div>
        </header>

        <div style={{ padding: "var(--space-md)" }}>{chart}</div>

        {activePoint ? (
          <div
            style={{
              padding: "0 var(--space-md) var(--space-md) var(--space-md)",
              display: "flex",
              gap: "var(--space-sm)",
            }}
          >
            <div className="label label-neutral label-sm">
              {activePoint.weightKg}kg × {activePoint.reps}
              {locale === "ko" ? "회" : " reps"}
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          background: "var(--color-surface-container-low)",
          borderRadius: "20px",
          padding: "var(--space-md)",
          boxShadow: "0 1px 3px var(--shadow-color-soft)",
        }}
      >
        <div className="metric-1rm" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="metric-label" style={{ display: "block", marginBottom: "2px" }}>
              {locale === "ko" ? "최고 e1RM" : "Best e1RM"}
            </span>
            <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)", fontSize: "13px" }}>
              {stats?.best ? formatPointDate(stats.best.date, locale) : "-"}
            </span>
          </div>
          <div className="metric-value" style={{ fontSize: "24px", textAlign: "right" }}>
            {stats?.best ? stats.best.e1rm.toFixed(1) : "-"}
            <span style={{ fontSize: "14px", marginLeft: "2px", fontWeight: 400 }}>kg</span>
          </div>
        </div>
      </div>
    </div>
  );
});
