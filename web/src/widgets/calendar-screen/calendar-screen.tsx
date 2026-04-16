"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import {
  dateOnlyInTimezone,
} from "@/features/calendar/lib/format";
import {
  useCalendarNavigationController,
} from "@/features/calendar/model/use-calendar-navigation-controller";
import {
  useCalendarDataController,
} from "@/features/calendar/model/use-calendar-data-controller";
import {
  buildPlannedExercisePreview,
  useCalendarDerivedState,
} from "@/features/calendar/model/use-calendar-derived-state";
import {
  useCalendarPlanPickerController,
} from "@/features/calendar/model/use-calendar-plan-picker-controller";
import {
  useCalendarSessionDetail,
} from "@/features/calendar/model/use-calendar-session-detail";
import {
  CalendarOverlaySheets,
} from "@/features/calendar/ui/calendar-overlay-sheets";
import {
  CalendarFilterBar,
} from "@/features/calendar/ui/calendar-filter-bar";
import {
  CalendarMonthCard,
} from "@/features/calendar/ui/calendar-month-card";
import {
  CalendarRecentLogsSection,
} from "@/features/calendar/ui/calendar-recent-logs-section";
import {
  CalendarSelectedDateSection,
} from "@/features/calendar/ui/calendar-selected-date-section";
import type { CalendarPageBootstrap } from "@/server/services/calendar/get-calendar-page-bootstrap";
import { APP_ROUTES } from "@/lib/app-routes";
import { apiDelete, apiPatch } from "@/lib/api";

import { buildTodayLogHref } from "@/lib/workout-links";

type CalendarScreenProps = CalendarPageBootstrap;

export function CalendarScreen({
  initialPlans,
  initialSessions,
  initialLogs,
  initialTimezone,
  initialToday,
}: CalendarScreenProps) {
  const { copy, locale } = useLocale();
  const timezone = useMemo(
    () => initialTimezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
    [initialTimezone],
  );
  const today = useMemo(
    () => initialToday ?? dateOnlyInTimezone(new Date(), timezone),
    [initialToday, timezone],
  );

  const {
    anchorDate,
    selectedDate,
    monthPickerOpen,
    setMonthPickerOpen,
    monthNavFeedback,
    shiftMonthWithFeedback,
    handleMonthPickerChange,
    selectDate,
    focusDate,
  } = useCalendarNavigationController({
    initialToday: today,
  });
  const [planQuery, setPlanQuery] = useState("");
  const {
    planId,
    setPlanId,
    recentSessions,
    allPlanLogs,
    currentSelectedLog,
    selectedLogLoading,
    completedLogKey,
    error,
    setError,
    loading,
    selectedPlan,
    filteredPlans,
  } = useCalendarDataController({
    locale,
    timezone,
    selectedDate,
    planQuery,
    initialPlans,
    initialSessions,
    initialLogs,
  });
  const {
    planSheetOpen,
    openPlanPicker,
    closePlanPicker,
    submitFirstMatchingPlan,
    selectPlan,
  } = useCalendarPlanPickerController({
    filteredPlans,
    setPlanId,
    resetPlanQuery: () => setPlanQuery(""),
  });
  const currentLogKey = planId ? `${planId}|${selectedDate}` : "";

  const {
    generatedById,
    logDates,
    selectedCtx,
    selectedSession,
    isPastDateCreationBlocked,
    hasLaterLogs,
    loggedSummary,
    nextSessionLabel,
    loggedDayLabel,
    selectedSessionWDLabel,
    recentPastLogs,
  } = useCalendarDerivedState({
    selectedPlan,
    selectedDate,
    today,
    timezone,
    recentSessions,
    allPlanLogs,
    currentSelectedLog,
  });
  const { selectedSessionDetail } = useCalendarSessionDetail({
    locale,
    planId,
    selectedSessionId: selectedSession?.id ?? null,
    currentSelectedLogId: currentSelectedLog?.id ?? null,
    setError,
  });
  const plannedExercises = useMemo(
    () => buildPlannedExercisePreview(selectedSessionDetail?.snapshot ?? null),
    [selectedSessionDetail],
  );

  const workoutHref = currentSelectedLog
    ? buildTodayLogHref({ planId, date: selectedDate, logId: currentSelectedLog.id })
    : planId
      ? buildTodayLogHref({ planId, date: selectedDate, autoGenerate: false })
      : APP_ROUTES.todayLog;

  const isAutoProgressionPlan = selectedPlan?.params?.autoProgression === true;

  // ── Move date sheet ──────────────────────────────────────────────────────────
  const [moveDateSheetOpen, setMoveDateSheetOpen] = useState(false);
  const [moveDatePendingDate, setMoveDatePendingDate] = useState(selectedDate);

  const moveDateHasConflict = useMemo(() => {
    if (!isAutoProgressionPlan || !currentSelectedLog) return false;
    const oldDate = selectedDate;
    const newDate = moveDatePendingDate;
    if (oldDate === newDate) return false;
    const [minDate, maxDate] = oldDate < newDate ? [oldDate, newDate] : [newDate, oldDate];
    return Array.from(logDates).some(
      (d) => d !== oldDate && d > minDate && d < maxDate,
    );
  }, [isAutoProgressionPlan, currentSelectedLog, selectedDate, moveDatePendingDate, logDates]);

  const handleOpenMoveDate = useCallback(() => {
    setMoveDatePendingDate(selectedDate);
    setMoveDateSheetOpen(true);
  }, [selectedDate]);

  const handleCloseMoveDate = useCallback(() => {
    setMoveDateSheetOpen(false);
  }, []);

  const handleMoveDateChange = useCallback((newDate: string) => {
    setMoveDatePendingDate(newDate);
  }, []);

  const handleConfirmMoveDate = useCallback(async () => {
    if (!currentSelectedLog?.id || moveDateHasConflict) return;
    const [year, month, day] = moveDatePendingDate.split("-").map(Number);
    const newPerformedAt = new Date(year!, (month ?? 1) - 1, day!);
    try {
      await apiPatch(`/api/logs/${currentSelectedLog.id}`, {
        performedAt: newPerformedAt.toISOString(),
        timezone,
      });
    } catch {
      // error will surface via SWR revalidation
    }
    setMoveDateSheetOpen(false);
  }, [currentSelectedLog?.id, moveDateHasConflict, moveDatePendingDate, timezone]);

  // ── Delete confirm sheet ─────────────────────────────────────────────────────
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleOpenDeleteLog = useCallback(() => {
    setDeleteConfirmOpen(true);
  }, []);

  const handleCloseDeleteLog = useCallback(() => {
    setDeleteConfirmOpen(false);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!currentSelectedLog?.id) return;
    try {
      await apiDelete(`/api/logs/${currentSelectedLog.id}`);
    } catch {
      // error will surface via SWR revalidation
    }
    setDeleteConfirmOpen(false);
  }, [currentSelectedLog?.id]);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "var(--space-sm)",
          marginBottom: "var(--space-lg)",
        }}
      >
        <h1 style={{
          fontFamily: "var(--font-headline-family)",
          fontSize: "20px",
          fontWeight: 700,
          letterSpacing: "-0.3px",
          color: "var(--color-text)",
          margin: 0,
        }}>
          {copy.calendar.title}
        </h1>
      </div>

      <CalendarFilterBar
        locale={locale}
        anchorDate={anchorDate}
        monthPickerOpen={monthPickerOpen}
        selectedPlanName={selectedPlan?.name ?? null}
        onOpenMonthPicker={() => setMonthPickerOpen(true)}
        onOpenPlanPicker={openPlanPicker}
      />

      <CalendarMonthCard
        locale={locale}
        anchorDate={anchorDate}
        selectedDate={selectedDate}
        today={today}
        hasSelectedPlan={!!selectedPlan}
        logDates={logDates}
        monthNavFeedback={monthNavFeedback}
        onSelectDate={selectDate}
        onShiftPrevMonth={() => shiftMonthWithFeedback(-1)}
        onShiftNextMonth={() => shiftMonthWithFeedback(1)}
      />

      <CalendarSelectedDateSection
        locale={locale}
        copy={copy.calendarMain}
        selectedDate={selectedDate}
        today={today}
        selectedPlanName={selectedPlan?.name ?? null}
        error={error}
        isLoading={loading || selectedLogLoading || (!!planId && completedLogKey !== currentLogKey)}
        currentSelectedLog={currentSelectedLog}
        loggedSummary={loggedSummary}
        workoutHref={workoutHref}
        selectedSession={selectedSession}
        selectedSessionWDLabel={selectedSessionWDLabel}
        plannedExercises={plannedExercises}
        isPastDateCreationBlocked={isPastDateCreationBlocked}
        selectedCtx={selectedCtx}
        nextSessionLabel={nextSessionLabel}
        loggedDayLabel={loggedDayLabel}
        onMoveDate={handleOpenMoveDate}
        onDeleteLog={handleOpenDeleteLog}
      />

      <CalendarRecentLogsSection
        locale={locale}
        title={copy.calendarMain.recentLogs}
        timezone={timezone}
        selectedPlanName={selectedPlan?.name ?? null}
        generatedById={generatedById}
        recentPastLogs={recentPastLogs}
        onSelectDate={focusDate}
      />

      <CalendarOverlaySheets
        copy={copy.calendar}
        planSheetOpen={planSheetOpen}
        planQuery={planQuery}
        filteredPlans={filteredPlans}
        selectedPlanId={planId}
        onClosePlanSheet={closePlanPicker}
        onPlanQueryChange={setPlanQuery}
        onPlanQuerySubmit={submitFirstMatchingPlan}
        onSelectPlan={selectPlan}
        monthPickerOpen={monthPickerOpen}
        anchorDate={anchorDate}
        today={today}
        onCloseMonthPicker={() => setMonthPickerOpen(false)}
        onMonthChange={handleMonthPickerChange}
        moveDateSheetOpen={moveDateSheetOpen}
        moveDateCurrentDate={selectedDate}
        moveDateCopy={{
          title: copy.calendarMain.moveDateTitle,
          confirm: copy.calendarMain.moveDateConfirm,
          close: locale === "ko" ? "닫기" : "Close",
          blockedTitle: copy.calendarMain.moveDateBlockedTitle,
          blockedDescription: copy.calendarMain.moveDateBlockedDescription,
        }}
        moveDateHasConflict={moveDateHasConflict}
        onCloseMoveDateSheet={handleCloseMoveDate}
        onMoveDateChange={handleMoveDateChange}
        onConfirmMoveDate={handleConfirmMoveDate}
        deleteConfirmOpen={deleteConfirmOpen}
        deleteCopy={{
          title: copy.calendarMain.deleteLog,
          confirm: copy.calendarMain.deleteLogConfirm,
          cancel: locale === "ko" ? "취소" : "Cancel",
        }}
        onCloseDeleteConfirm={handleCloseDeleteLog}
        onConfirmDelete={handleConfirmDelete}
      />
    </>
  );
}
