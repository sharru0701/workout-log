"use client";

import { useState } from "react";

type CalendarPlanOption = {
  id: string;
  name: string;
};

type UseCalendarPlanPickerControllerInput = {
  filteredPlans: CalendarPlanOption[];
  setPlanId: (planId: string) => void;
  resetPlanQuery: () => void;
};

export function useCalendarPlanPickerController({
  filteredPlans,
  setPlanId,
  resetPlanQuery,
}: UseCalendarPlanPickerControllerInput) {
  const [planSheetOpen, setPlanSheetOpen] = useState(false);

  function openPlanPicker() {
    resetPlanQuery();
    setPlanSheetOpen(true);
  }

  function closePlanPicker() {
    setPlanSheetOpen(false);
    resetPlanQuery();
  }

  function submitFirstMatchingPlan() {
    const first = filteredPlans[0] ?? null;
    if (!first) return;
    setPlanId(first.id);
    closePlanPicker();
  }

  function selectPlan(planId: string) {
    setPlanId(planId);
    closePlanPicker();
  }

  return {
    planSheetOpen,
    openPlanPicker,
    closePlanPicker,
    submitFirstMatchingPlan,
    selectPlan,
  };
}
