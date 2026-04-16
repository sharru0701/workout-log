"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useState } from "react";
import { getMonth, getYear } from "@/lib/date-utils";

const MonthYearPickerSheet = dynamic(() => import("@/components/ui/month-year-picker-sheet").then(mod => mod.MonthYearPickerSheet), { ssr: false });
const SearchSelectSheet = dynamic(() => import("@/components/ui/search-select-sheet").then(mod => mod.SearchSelectSheet), { ssr: false });
const BottomSheet = dynamic(() => import("@/components/ui/bottom-sheet").then(mod => mod.BottomSheet), { ssr: false });

type CalendarPlanOption = {
  id: string;
  name: string;
};

type CalendarOverlaySheetsCopy = {
  planSheetTitle: string;
  planSheetDescription: string;
  close: string;
  planSearchPlaceholder: string;
  planSearchResults: string;
  noMatchingPlans: string;
  monthPickerTitle: string;
};

type MoveDateCopy = {
  title: string;
  confirm: string;
  close: string;
  blockedTitle: string;
  blockedDescription: string;
};

type DeleteCopy = {
  title: string;
  confirm: string;
  cancel: string;
};

type CalendarOverlaySheetsProps = {
  copy: CalendarOverlaySheetsCopy;
  planSheetOpen: boolean;
  planQuery: string;
  filteredPlans: CalendarPlanOption[];
  selectedPlanId: string;
  onClosePlanSheet: () => void;
  onPlanQueryChange: (value: string) => void;
  onPlanQuerySubmit: () => void;
  onSelectPlan: (planId: string) => void;
  monthPickerOpen: boolean;
  anchorDate: string;
  today: string;
  onCloseMonthPicker: () => void;
  onMonthChange: (value: { year: number; month: number }) => void;
  moveDateSheetOpen: boolean;
  moveDateCurrentDate: string;
  moveDateCopy: MoveDateCopy;
  moveDateHasConflict: boolean;
  onCloseMoveDateSheet: () => void;
  onMoveDateChange: (newDate: string) => void;
  onConfirmMoveDate: () => void;
  deleteConfirmOpen: boolean;
  deleteCopy: DeleteCopy;
  onCloseDeleteConfirm: () => void;
  onConfirmDelete: () => void;
};

const MoveDateSheet = memo(function MoveDateSheet({
  open,
  currentDate,
  moveDateCopy,
  hasConflict,
  onClose,
  onDateChange,
  onConfirm,
}: {
  open: boolean;
  currentDate: string;
  moveDateCopy: MoveDateCopy;
  hasConflict: boolean;
  onClose: () => void;
  onDateChange: (newDate: string) => void;
  onConfirm: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState(currentDate);

  useEffect(() => {
    if (open) {
      setSelectedDate(currentDate);
      onDateChange(currentDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentDate]);

  const handleChange = (value: string) => {
    setSelectedDate(value);
    onDateChange(value);
  };

  const isUnchanged = selectedDate === currentDate;

  return (
    <BottomSheet
      open={open}
      title={moveDateCopy.title}
      onClose={onClose}
      closeLabel={moveDateCopy.close}
      primaryAction={{
        ariaLabel: moveDateCopy.confirm,
        onPress: onConfirm,
        disabled: isUnchanged || hasConflict,
      }}
    >
      <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            if (e.target.value) handleChange(e.target.value);
          }}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: "14px",
            border: `1px solid ${hasConflict ? "var(--color-danger)" : "var(--color-outline-variant)"}`,
            background: "var(--color-surface-container-low)",
            fontFamily: "var(--font-label-family)",
            fontSize: "16px",
            color: "var(--color-text)",
            boxSizing: "border-box",
          }}
        />
        {hasConflict && !isUnchanged ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              padding: "12px 14px",
              borderRadius: "12px",
              background: "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface-container-low))",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px", color: "var(--color-danger)", flexShrink: 0, marginTop: "1px" }}
            >
              warning
            </span>
            <div>
              <div style={{ fontFamily: "var(--font-label-family)", fontSize: "12px", fontWeight: 700, color: "var(--color-danger)", marginBottom: "2px" }}>
                {moveDateCopy.blockedTitle}
              </div>
              <div style={{ fontFamily: "var(--font-label-family)", fontSize: "12px", color: "var(--color-danger)", lineHeight: 1.5, opacity: 0.85 }}>
                {moveDateCopy.blockedDescription}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
});

const DeleteConfirmSheet = memo(function DeleteConfirmSheet({
  open,
  deleteCopy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  deleteCopy: DeleteCopy;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      title={deleteCopy.title}
      onClose={onClose}
    >
      <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: "14px",
            border: "none",
            background: "var(--color-danger)",
            color: "#fff",
            fontFamily: "var(--font-headline-family)",
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {deleteCopy.confirm}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: "14px",
            border: "none",
            background: "var(--color-surface-container)",
            color: "var(--color-text)",
            fontFamily: "var(--font-headline-family)",
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {deleteCopy.cancel}
        </button>
      </div>
    </BottomSheet>
  );
});

export const CalendarOverlaySheets = memo(function CalendarOverlaySheets({
  copy,
  planSheetOpen,
  planQuery,
  filteredPlans,
  selectedPlanId,
  onClosePlanSheet,
  onPlanQueryChange,
  onPlanQuerySubmit,
  onSelectPlan,
  monthPickerOpen,
  anchorDate,
  today,
  onCloseMonthPicker,
  onMonthChange,
  moveDateSheetOpen,
  moveDateCurrentDate,
  moveDateCopy,
  moveDateHasConflict,
  onCloseMoveDateSheet,
  onMoveDateChange,
  onConfirmMoveDate,
  deleteConfirmOpen,
  deleteCopy,
  onCloseDeleteConfirm,
  onConfirmDelete,
}: CalendarOverlaySheetsProps) {
  return (
    <>
      <SearchSelectSheet
        open={planSheetOpen}
        title={copy.planSheetTitle}
        description={copy.planSheetDescription}
        onClose={onClosePlanSheet}
        closeLabel={copy.close}
        query={planQuery}
        placeholder={copy.planSearchPlaceholder}
        onQueryChange={onPlanQueryChange}
        onQuerySubmit={onPlanQuerySubmit}
        resultsAriaLabel={copy.planSearchResults}
        emptyText={copy.noMatchingPlans}
        options={filteredPlans.map((plan) => ({
          key: plan.id,
          label: plan.name,
          active: plan.id === selectedPlanId,
          ariaCurrent: plan.id === selectedPlanId,
          onSelect: () => onSelectPlan(plan.id),
        }))}
      />
      <MonthYearPickerSheet
        open={monthPickerOpen}
        onClose={onCloseMonthPicker}
        title={copy.monthPickerTitle}
        year={getYear(anchorDate)}
        month={getMonth(anchorDate)}
        minYear={getYear(today) - 10}
        maxYear={getYear(today) + 10}
        onChange={onMonthChange}
      />
      <MoveDateSheet
        open={moveDateSheetOpen}
        currentDate={moveDateCurrentDate}
        moveDateCopy={moveDateCopy}
        hasConflict={moveDateHasConflict}
        onClose={onCloseMoveDateSheet}
        onDateChange={onMoveDateChange}
        onConfirm={onConfirmMoveDate}
      />
      <DeleteConfirmSheet
        open={deleteConfirmOpen}
        deleteCopy={deleteCopy}
        onClose={onCloseDeleteConfirm}
        onConfirm={onConfirmDelete}
      />
    </>
  );
});
