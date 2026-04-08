"use client";

import React, { useState, useMemo } from "react";
import { useLocale } from "@/components/locale-provider";
import { monthGrid, getDayOfWeek, dayOfMonth, monthStart } from "@/lib/date-utils";

type CalendarProps = {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onRangeChange: (start: string, end: string) => void;
};

export function CalendarRangePicker({ startDate, endDate, onRangeChange }: CalendarProps) {
  const { locale } = useLocale();
  const [viewDateStr, setViewDateStr] = useState(() => {
    const d = new Date(endDate || new Date());
    return d.toISOString().slice(0, 10);
  });

  const cells = useMemo(() => monthGrid(viewDateStr), [viewDateStr]);
  const currentMonthKey = monthStart(viewDateStr).slice(0, 7);

  const handleDateClick = (dateStr: string) => {
    // If we have a complete range or nothing, start a new range
    if (!startDate || (startDate && endDate && startDate !== endDate)) {
      onRangeChange(dateStr, dateStr); // Set both to same for intermediate state
    } else {
      // We have only startDate (or same-day range), set the second point
      if (dateStr < startDate) {
        onRangeChange(dateStr, startDate);
      } else {
        onRangeChange(startDate, dateStr);
      }
    }
  };

  const isStart = (dateStr: string) => dateStr === startDate;
  const isEnd = (dateStr: string) => dateStr === endDate;
  const isInRange = (dateStr: string) => startDate && endDate && dateStr > startDate && dateStr < endDate;

  const changeMonth = (delta: number) => {
    const d = new Date(viewDateStr);
    d.setMonth(d.getMonth() + delta);
    setViewDateStr(d.toISOString().slice(0, 10));
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isSelectingEnd = startDate && endDate && startDate === endDate;
  const monthHeading = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
  }).format(new Date(`${viewDateStr.slice(0, 10)}T00:00:00`));
  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", { weekday: "short" }).format(
      new Date(2026, 2, 29 + index),
    ),
  );

  return (
    <div style={{ font: "var(--font-body)", color: "var(--color-text)" }}>
      {/* Search status header */}
      <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
        <div style={{ flex: 1, padding: "var(--space-sm)", background: "var(--color-surface-container)", borderRadius: "12px", textAlign: "center", border: !isSelectingEnd && startDate ? "1px solid var(--color-primary)" : "1px solid transparent" }}>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "2px" }}>{locale === "ko" ? "시작일" : "Start"}</div>
          <div style={{ fontSize: "14px", fontWeight: 700 }}>{startDate || "-"}</div>
        </div>
        <div style={{ alignSelf: "center", color: "var(--color-text-muted)" }}>→</div>
        <div style={{ flex: 1, padding: "var(--space-sm)", background: "var(--color-surface-container)", borderRadius: "12px", textAlign: "center", border: isSelectingEnd ? "1px solid var(--color-primary)" : "1px solid transparent" }}>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "2px" }}>{locale === "ko" ? "종료일" : "End"}</div>
          <div style={{ fontSize: "14px", fontWeight: 700 }}>{(!isSelectingEnd && endDate && startDate !== endDate) ? endDate : "-"}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
        <div style={{ fontSize: "13px", color: "var(--color-primary)", fontWeight: 500 }}>
          {isSelectingEnd
            ? (locale === "ko" ? "종료일을 선택해 주세요" : "Select an end date")
            : (locale === "ko" ? "달력에서 날짜를 선택하세요" : "Choose dates from the calendar")}
        </div>
        <button 
          onClick={() => onRangeChange("", "")}
          style={{ background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "12px", textDecoration: "underline", cursor: "pointer", minHeight: "44px", minWidth: "44px", padding: "10px 12px" }}
        >
          {locale === "ko" ? "초기화" : "Reset"}
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)", padding: "0 4px" }}>
        <button onClick={() => changeMonth(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "18px", minHeight: "44px", minWidth: "44px", padding: "8px" }}>◀</button>
        <span style={{ font: "var(--font-section-title)", fontWeight: 700 }}>
          {monthHeading}
        </span>
        <button onClick={() => changeMonth(1)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "18px", minHeight: "44px", minWidth: "44px", padding: "8px" }}>▶</button>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--color-text-subtle)", marginBottom: "var(--space-xs)" }}>
        {weekdayLabels.map((d) => <div key={d}>{d}</div>)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {cells.map((dateStr) => {
          const start = isStart(dateStr);
          const end = isEnd(dateStr);
          const selected = start || end;
          const range = isInRange(dateStr);
          const isToday = dateStr === todayStr;
          const isOutside = !dateStr.startsWith(currentMonthKey);
          const dow = getDayOfWeek(dateStr);

          // Selection styling matching main calendar
          const selectionStyle: React.CSSProperties = selected ? {
            background: "var(--color-selected-bg)",
            border: "1px solid var(--color-selected-border)",
            color: "var(--color-selected-text)",
            zIndex: 2,
          } : range ? {
            background: "var(--color-surface-container)",
            color: "var(--color-text)",
            borderRadius: 0,
          } : {};

          // Shape adjustments for range
          const borderRadius = selected ? "50%" : 0;

          // Day color logic matching main calendar
          const dayColor = selected ? "var(--color-selected-text)" :
                          isOutside ? "var(--color-text-subtle)" :
                          dow === 0 ? "var(--color-danger)" :
                          dow === 6 ? "var(--color-calendar-saturday)" :
                          "var(--color-text)";

          return (
            <button
              key={dateStr}
              onClick={() => handleDateClick(dateStr)}
              style={{
                aspectRatio: "1",
                border: "1px solid transparent",
                background: "transparent",
                color: dayColor,
                borderRadius: borderRadius,
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: (isToday || selected) ? 700 : 400,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                ...selectionStyle
              }}
            >
              {dayOfMonth(dateStr)}
              {isToday && !selected && (
                <div style={{ position: "absolute", bottom: "4px", width: "4px", height: "4px", borderRadius: "50%", background: "var(--color-primary)" }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
