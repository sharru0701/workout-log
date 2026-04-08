"use client";

import { memo } from "react";

function CalendarIcon() {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: 20, fontVariationSettings: "'wght' 400", lineHeight: 1 }}
    >
      calendar_today
    </span>
  );
}

export const Stats1RMControls = memo(function Stats1RMControls({
  locale,
  selectedExerciseName,
  selectedProgramLabel,
  rangePreset,
  isControlPending,
  onOpenExerciseSheet,
  onOpenProgramSheet,
  onOpenRangeSheet,
  onSelectPreset,
}: {
  locale: "ko" | "en";
  selectedExerciseName: string | null;
  selectedProgramLabel: string;
  rangePreset: 7 | 30 | 90 | 180 | 365 | "CUSTOM";
  isControlPending: boolean;
  onOpenExerciseSheet: () => void;
  onOpenProgramSheet: () => void;
  onOpenRangeSheet: () => void;
  onSelectPreset: (preset: 7 | 30 | 90 | 365) => void;
}) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
        <button
          type="button"
          onClick={onOpenExerciseSheet}
          className="btn"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px var(--space-md)",
            border: "none",
            borderRadius: "14px",
            backgroundColor: "var(--color-surface-container-low)",
            cursor: "pointer",
            textAlign: "left",
            boxShadow: "0 1px 3px var(--shadow-color-soft)",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "2px", fontWeight: 500 }}>
              {locale === "ko" ? "운동종목" : "Exercise"}
            </div>
            <div
              style={{
                font: "var(--font-body)",
                fontWeight: 700,
                color: "var(--color-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                opacity: isControlPending ? 0.72 : 1,
              }}
            >
              {selectedExerciseName ?? (locale === "ko" ? "선택" : "Select")}
            </div>
          </div>
          <span aria-hidden="true" style={{ color: "var(--color-text-muted)", flexShrink: 0, marginLeft: "4px" }}>
            <svg viewBox="0 0 12 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
              <path d="M2.5 6L6 9.5L9.5 6" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenProgramSheet}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px var(--space-md)",
            border: "none",
            borderRadius: "14px",
            backgroundColor: "var(--color-surface-container-low)",
            cursor: "pointer",
            textAlign: "left",
            boxShadow: "0 1px 3px var(--shadow-color-soft)",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "2px", fontWeight: 500 }}>
              {locale === "ko" ? "필터링" : "Filter"}
            </div>
            <div
              style={{
                font: "var(--font-body)",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                opacity: isControlPending ? 0.72 : 1,
              }}
            >
              {selectedProgramLabel}
            </div>
          </div>
          <span aria-hidden="true" style={{ color: "var(--color-text-muted)", flexShrink: 0, marginLeft: "4px" }}>
            <svg viewBox="0 0 12 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
              <path d="M2.5 6L6 9.5L9.5 6" />
            </svg>
          </span>
        </button>
      </div>

      <div style={{ marginTop: "2px" }}>
        <div style={{ background: "var(--color-surface-container)", borderRadius: "12px", overflow: "hidden", padding: "3px" }}>
          <div style={{ display: "flex", gap: "2px" }}>
            {[
              { label: "7D", value: 7 },
              { label: "1M", value: 30 },
              { label: "3M", value: 90 },
              { label: "ALL", value: 365 },
            ].map((option) => {
              const isActive = rangePreset === option.value;
              return (
                <button
                  key={option.label}
                  onClick={() => onSelectPreset(option.value as 7 | 30 | 90 | 365)}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    border: "none",
                    borderRadius: "9px",
                    fontSize: "12px",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    background: isActive ? "var(--color-bg)" : "transparent",
                    color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                    boxShadow: isActive ? "0 2px 6px var(--shadow-color-soft)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
            <button
              onClick={onOpenRangeSheet}
              aria-label={locale === "ko" ? "기간 지정" : "Choose date range"}
              style={{
                width: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: "9px",
                background: rangePreset === "CUSTOM" ? "var(--color-bg)" : "transparent",
                color: rangePreset === "CUSTOM" ? "var(--color-primary)" : "var(--color-text-subtle)",
                cursor: "pointer",
                boxShadow: rangePreset === "CUSTOM" ? "0 2px 6px var(--shadow-color-soft)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <CalendarIcon />
            </button>
          </div>
        </div>
      </div>
    </>
  );
});
