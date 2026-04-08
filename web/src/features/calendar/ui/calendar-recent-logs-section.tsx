"use client";

import { memo } from "react";
import { dateOnlyInTimezone, formatCalendarDay, sessionKeyToWDLabel } from "@/features/calendar/lib/format";
import type {
  CalendarRecentGeneratedSession,
  CalendarWorkoutLogSummary,
} from "@/features/calendar/model/types";

type CalendarRecentLogsSectionProps = {
  locale: "ko" | "en";
  title: string;
  timezone: string;
  selectedPlanName: string | null;
  generatedById: Map<string, CalendarRecentGeneratedSession>;
  recentPastLogs: CalendarWorkoutLogSummary[];
  onSelectDate: (dateOnly: string) => void;
};

export const CalendarRecentLogsSection = memo(function CalendarRecentLogsSection({
  locale,
  title,
  timezone,
  selectedPlanName,
  generatedById,
  recentPastLogs,
  onSelectDate,
}: CalendarRecentLogsSectionProps) {
  if (recentPastLogs.length === 0) return null;

  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <h2
        style={{
          fontFamily: "var(--font-headline-family)",
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--color-text)",
          margin: 0,
          marginBottom: "var(--space-md)",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {recentPastLogs.map((log) => {
          const logDate = dateOnlyInTimezone(new Date(log.performedAt), timezone);
          const sessionLabel = log.generatedSessionId
            ? (sessionKeyToWDLabel(generatedById.get(log.generatedSessionId)?.sessionKey ?? "") ?? null)
            : null;

          return (
            <button
              key={log.id}
              type="button"
              onClick={() => onSelectDate(logDate)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "var(--color-surface-container-low)",
                border: "none",
                borderRadius: "20px",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "var(--color-success-weak)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "18px", color: "var(--color-success)", fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-headline-family)",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--color-text)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {selectedPlanName ?? (locale === "ko" ? "기록" : "Log")}
                    {sessionLabel ? (
                      <span
                        style={{
                          fontFamily: "var(--font-label-family)",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "var(--color-text-muted)",
                          background: "var(--color-surface-container-high)",
                          padding: "2px 8px",
                          borderRadius: "20px",
                        }}
                      >
                        {sessionLabel}
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-label-family)",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--color-text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    {formatCalendarDay(logDate, locale)}
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--color-text-subtle)", flexShrink: 0 }}>
                chevron_right
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
});
