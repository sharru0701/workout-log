"use client";

import { memo } from "react";
import { dateOnlyToUtcDate } from "@/lib/date-utils";

type CalendarFilterBarProps = {
  locale: "ko" | "en";
  anchorDate: string;
  monthPickerOpen: boolean;
  selectedPlanName: string | null;
  onOpenMonthPicker: () => void;
  onOpenPlanPicker: () => void;
};

export const CalendarFilterBar = memo(function CalendarFilterBar({
  locale,
  anchorDate,
  monthPickerOpen,
  selectedPlanName,
  onOpenMonthPicker,
  onOpenPlanPicker,
}: CalendarFilterBarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        marginBottom: "var(--space-lg)",
      }}
    >
      <button
        type="button"
        onClick={onOpenMonthPicker}
        aria-label={locale === "ko" ? "연월 선택 열기" : "Open year and month picker"}
        aria-haspopup="dialog"
        aria-expanded={monthPickerOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexShrink: 0,
          background: "var(--color-surface-container-low)",
          border: "none",
          borderRadius: "12px",
          padding: "8px 14px",
          cursor: "pointer",
          fontFamily: "var(--font-label-family)",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}
      >
        <span>
          {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
            year: "numeric",
            month: "long",
            timeZone: "UTC",
          }).format(dateOnlyToUtcDate(anchorDate))}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>expand_more</span>
      </button>

      {selectedPlanName ? (
        <button
          type="button"
          onClick={onOpenPlanPicker}
          aria-label={locale === "ko" ? "플랜 변경" : "Change plan"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "6px",
            flex: 1,
            minWidth: 0,
            background: "var(--color-surface-container-low)",
            border: "none",
            borderRadius: "12px",
            padding: "8px 14px",
            cursor: "pointer",
            fontFamily: "var(--font-label-family)",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            overflow: "hidden",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedPlanName}</span>
          <span className="material-symbols-outlined" style={{ fontSize: "16px", flexShrink: 0 }}>filter_list</span>
        </button>
      ) : null}
    </div>
  );
});
