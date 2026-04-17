"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
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

type MoveDateConflictCopy = {
  title: string;
  description: string;
  close: string;
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
  moveDateConflictOpen: boolean;
  moveDateConflictCopy: MoveDateConflictCopy;
  onCloseMoveDateConflict: () => void;
  deleteConfirmOpen: boolean;
  deleteCopy: DeleteCopy;
  onCloseDeleteConfirm: () => void;
  onConfirmDelete: () => void;
};

const MoveDateConflictSheet = memo(function MoveDateConflictSheet({
  open,
  copy,
  onClose,
}: {
  open: boolean;
  copy: MoveDateConflictCopy;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      title={copy.title}
      onClose={onClose}
    >
      <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "20px", color: "var(--color-danger)", flexShrink: 0, marginTop: "1px" }}
          >
            warning
          </span>
          <p style={{ fontFamily: "var(--font-label-family)", fontSize: "14px", color: "var(--color-text)", lineHeight: 1.6, margin: 0 }}>
            {copy.description}
          </p>
        </div>
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
          {copy.close}
        </button>
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
  moveDateConflictOpen,
  moveDateConflictCopy,
  onCloseMoveDateConflict,
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
      <MoveDateConflictSheet
        open={moveDateConflictOpen}
        copy={moveDateConflictCopy}
        onClose={onCloseMoveDateConflict}
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
