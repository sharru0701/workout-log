"use client";

import { memo } from "react";
import { formatCalendarDay, formatVolume } from "@/features/calendar/lib/format";
import type {
  CalendarExercisePreviewItem,
  CalendarRecentGeneratedSession,
  CalendarWorkoutLogForDate,
} from "@/features/calendar/model/types";

type CalendarMainCopy = {
  noPlanSelected: string;
  completed: string;
  sets: string;
  volume: string;
  editLog: string;
  blockedTitle: string;
  blockedDescription: string;
  blockedHasLaterLogs: string;
  beforeStart: string;
  startLogging: string;
  noSession: string;
  canLogImmediately: string;
  plannedDescription: string;
  immediateDescription: string;
  moveDate: string;
  moveDateTitle: string;
  moveDateConfirm: string;
  deleteLog: string;
  deleteLogConfirm: string;
  moveDateBlockedTitle: string;
  moveDateBlockedDescription: string;
};

type LoggedSummary = {
  exercises: CalendarExercisePreviewItem[];
  totalSets: number;
  totalVolume: number;
};

type CalendarSelectedDateSectionProps = {
  locale: "ko" | "en";
  copy: CalendarMainCopy;
  selectedDate: string;
  today: string;
  selectedPlanName: string | null;
  error: string | null;
  isLoading: boolean;
  currentSelectedLog: CalendarWorkoutLogForDate | null;
  loggedSummary: LoggedSummary;
  workoutHref: string;
  selectedSession: CalendarRecentGeneratedSession | null;
  selectedSessionWDLabel: string | null;
  plannedExercises: CalendarExercisePreviewItem[];
  isPastDateCreationBlocked: boolean;
  selectedCtx: { planned: boolean } | null;
  nextSessionLabel: string | null;
  loggedDayLabel: string | null;
  onMoveDate: () => void;
  onDeleteLog: () => void;
};

export const CalendarSelectedDateSection = memo(function CalendarSelectedDateSection({
  locale,
  copy,
  selectedDate,
  today,
  selectedPlanName,
  error,
  isLoading,
  currentSelectedLog,
  loggedSummary,
  workoutHref,
  selectedSession,
  selectedSessionWDLabel,
  plannedExercises,
  isPastDateCreationBlocked,
  selectedCtx,
  nextSessionLabel,
  loggedDayLabel,
  onMoveDate,
  onDeleteLog,
}: CalendarSelectedDateSectionProps) {
  return (
    <section style={{ marginBottom: "var(--space-xl)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-md)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-headline-family)",
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          {selectedDate === today ? (locale === "ko" ? "오늘" : "Today") : formatCalendarDay(selectedDate, locale)}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {selectedPlanName && selectedDate !== today ? (
            <span
              style={{
                fontFamily: "var(--font-label-family)",
                fontSize: "11px",
                color: "var(--color-text-muted)",
                maxWidth: "120px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedPlanName}
            </span>
          ) : null}
          {selectedDate === today ? (
            <span
              style={{
                fontFamily: "var(--font-label-family)",
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--color-text-on-primary)",
                background: "var(--color-primary)",
                padding: "4px 12px",
                borderRadius: "20px",
                letterSpacing: "0.04em",
              }}
            >
              {locale === "ko" ? "오늘" : "Today"}
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          style={{
            color: "var(--color-danger)",
            marginBottom: "var(--space-sm)",
            fontFamily: "var(--font-label-family)",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div
          style={{
            display: "flex",
            gap: "6px",
            justifyContent: "center",
            padding: "var(--space-xl)",
          }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-outline-variant)", display: "inline-block" }} />
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-outline-variant)", display: "inline-block" }} />
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-outline-variant)", display: "inline-block" }} />
        </div>
      ) : !selectedPlanName ? (
        <div
          style={{
            padding: "var(--space-xl)",
            textAlign: "center",
            background: "var(--color-surface-container-low)",
            borderRadius: "20px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "var(--color-text-muted)", display: "block", marginBottom: "8px" }}>calendar_month</span>
          <p
            style={{
              fontFamily: "var(--font-label-family)",
              fontSize: "13px",
              color: "var(--color-text-muted)",
              margin: 0,
            }}
          >
            {copy.noPlanSelected}
          </p>
        </div>
      ) : currentSelectedLog ? (
        <div style={{ background: "var(--color-surface-container-low)", borderRadius: "24px", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "var(--color-success-weak)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--color-success)", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-headline-family)", fontSize: "15px", fontWeight: 700, color: "var(--color-text)" }}>
                  {selectedPlanName}
                </div>
                <div style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginTop: "2px" }}>
                  {copy.completed}
                </div>
              </div>
            </div>
            {loggedDayLabel ? (
              <span
                style={{
                  fontFamily: "var(--font-label-family)",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--color-primary)",
                  background: "var(--color-primary-weak)",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  flexShrink: 0,
                  border: "1px solid color-mix(in srgb, var(--color-primary) 28%, transparent)",
                }}
              >
                {loggedDayLabel}
              </span>
            ) : null}
          </div>

          {loggedSummary.exercises.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {loggedSummary.exercises.map((exercise) => (
                <div key={exercise.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-headline-family)", fontSize: "14px", fontWeight: 700, color: "var(--color-text)" }}>{exercise.name}</span>
                  <span style={{ fontFamily: "var(--font-label-family)", fontSize: "13px", color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>{exercise.summary}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "32px", borderTop: "1px solid var(--color-outline-variant)", paddingTop: "16px", marginBottom: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>{copy.sets}</span>
              <span style={{ fontFamily: "var(--font-label-family)", fontSize: "18px", fontWeight: 700, color: "var(--color-text)" }}>{loggedSummary.totalSets}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>{copy.volume}</span>
              <span style={{ fontFamily: "var(--font-label-family)", fontSize: "18px", fontWeight: 700, color: "var(--color-text)" }}>{formatVolume(loggedSummary.totalVolume)}</span>
            </div>
          </div>

          <a
            href={workoutHref}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "14px 20px",
              borderRadius: "14px",
              background: "var(--color-primary)",
              color: "var(--color-text-on-primary)",
              textDecoration: "none",
              fontFamily: "var(--font-headline-family)",
              fontSize: "15px",
              fontWeight: 700,
              marginBottom: "10px",
            }}
          >
            {copy.editLog}
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_right</span>
          </a>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onMoveDate}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "11px 16px",
                borderRadius: "12px",
                background: "var(--color-surface-container)",
                color: "var(--color-text)",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-label-family)",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>calendar_clock</span>
              {copy.moveDate}
            </button>
            <button
              type="button"
              onClick={onDeleteLog}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "11px 16px",
                borderRadius: "12px",
                background: "color-mix(in srgb, var(--color-danger) 10%, var(--color-surface-container-low))",
                color: "var(--color-danger)",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-label-family)",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
              {copy.deleteLog}
            </button>
          </div>
        </div>
      ) : selectedSession ? (
        isPastDateCreationBlocked ? (
          <div style={{ padding: "24px 20px", borderRadius: "20px", background: "var(--color-surface-container-low)", textAlign: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "var(--color-text-muted)", display: "block", marginBottom: "10px" }}>block</span>
            <div style={{ fontFamily: "var(--font-headline-family)", fontSize: "14px", fontWeight: 700, color: "var(--color-text)", marginBottom: "6px" }}>{copy.blockedTitle}</div>
            <div style={{ fontFamily: "var(--font-label-family)", fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              {copy.blockedHasLaterLogs}
            </div>
          </div>
        ) : (
          <div style={{ background: "var(--color-surface-container-low)", borderRadius: "24px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: plannedExercises.length > 0 ? "16px" : "0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "var(--color-primary-weak)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--color-primary)" }}>fitness_center</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-headline-family)", fontSize: "15px", fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedPlanName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <span style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{copy.beforeStart}</span>
                    {selectedSessionWDLabel ? (
                      <span style={{ fontFamily: "var(--font-label-family)", fontSize: "11px", fontWeight: 700, color: "var(--color-primary)", background: "var(--color-primary-weak)", padding: "2px 8px", borderRadius: "20px" }}>
                        {selectedSessionWDLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <a
                href={workoutHref}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 18px",
                  borderRadius: "12px",
                  flexShrink: 0,
                  marginLeft: "12px",
                  background: "var(--color-primary)",
                  color: "var(--color-text-on-primary)",
                  textDecoration: "none",
                  fontFamily: "var(--font-headline-family)",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                {copy.startLogging}
              </a>
            </div>

            {plannedExercises.length > 0 ? (
              <div style={{ borderTop: "1px solid var(--color-outline-variant)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {plannedExercises
                  .filter((exercise) => exercise.role === "MAIN")
                  .map((exercise) => (
                    <div key={exercise.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--font-headline-family)", fontSize: "14px", fontWeight: 700, color: "var(--color-text)" }}>{exercise.name}</span>
                      <span style={{ fontFamily: "var(--font-label-family)", fontSize: "13px", color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>{exercise.summary}</span>
                    </div>
                  ))}
                {plannedExercises.some((exercise) => exercise.role !== "MAIN") ? (
                  <div style={{ borderTop: "1px dashed var(--color-outline-variant)", paddingTop: "8px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {plannedExercises
                      .filter((exercise) => exercise.role !== "MAIN")
                      .slice(0, 3)
                      .map((exercise) => (
                        <div key={exercise.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontFamily: "var(--font-label-family)", fontSize: "13px", color: "var(--color-text-muted)" }}>{exercise.name}</span>
                          <span style={{ fontFamily: "var(--font-label-family)", fontSize: "13px", color: "var(--color-text-subtle)", fontVariantNumeric: "tabular-nums" }}>{exercise.summary}</span>
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      ) : (
        <div
          style={{
            padding: "24px 20px",
            borderRadius: "20px",
            background: "var(--color-surface-container-low)",
            textAlign: "center",
          }}
        >
          {isPastDateCreationBlocked ? (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "var(--color-text-muted)", display: "block", marginBottom: "10px" }}>block</span>
              <div
                style={{
                  fontFamily: "var(--font-headline-family)",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  marginBottom: "6px",
                }}
              >
                {copy.blockedTitle}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-label-family)",
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                  lineHeight: 1.5,
                }}
              >
                {copy.blockedHasLaterLogs}
              </div>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "var(--color-primary)", display: "block", marginBottom: "10px" }}>fitness_center</span>
              <div
                style={{
                  fontFamily: "var(--font-headline-family)",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  marginBottom: "6px",
                }}
              >
                {selectedCtx?.planned ? (nextSessionLabel ?? copy.noSession) : copy.canLogImmediately}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-label-family)",
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                  marginBottom: "18px",
                  lineHeight: 1.5,
                }}
              >
                {selectedCtx?.planned ? copy.plannedDescription : copy.immediateDescription}
              </div>
              <a
                href={workoutHref}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 22px",
                  borderRadius: "12px",
                  background: "var(--color-primary)",
                  color: "var(--color-text-on-primary)",
                  textDecoration: "none",
                  fontFamily: "var(--font-label-family)",
                  fontSize: "13px",
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
                {copy.startLogging}
              </a>
            </>
          )}
        </div>
      )}
    </section>
  );
});
