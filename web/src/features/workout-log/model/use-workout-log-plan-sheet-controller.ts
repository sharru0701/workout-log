import { useCallback, useMemo, useState } from "react";

type WorkoutLogPlanLike = {
  id: string;
  name: string;
};

type UseWorkoutLogPlanSheetControllerInput<TPlan extends WorkoutLogPlanLike> = {
  plans: TPlan[];
  selectedPlan: TPlan | null;
  selectedPlanId: string;
  onPlanChange: (planId: string) => Promise<void> | void;
};

export function useWorkoutLogPlanSheetController<TPlan extends WorkoutLogPlanLike>({
  plans,
  selectedPlan,
  selectedPlanId,
  onPlanChange,
}: UseWorkoutLogPlanSheetControllerInput<TPlan>) {
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [planQuery, setPlanQuery] = useState("");

  const orderedPlans = useMemo(() => {
    if (!selectedPlan) return plans;
    return [selectedPlan, ...plans.filter((entry) => entry.id !== selectedPlan.id)];
  }, [plans, selectedPlan]);

  const filteredPlans = useMemo(() => {
    const normalizedQuery = planQuery.trim().toLowerCase();
    if (!normalizedQuery) return orderedPlans;
    return orderedPlans.filter((plan) =>
      plan.name.toLowerCase().includes(normalizedQuery),
    );
  }, [orderedPlans, planQuery]);

  const closePlanSheet = useCallback(() => {
    setPlanSheetOpen(false);
    setPlanQuery("");
  }, []);

  const openPlanSheet = useCallback(() => {
    setPlanQuery("");
    setPlanSheetOpen(true);
  }, []);

  const handlePlanSheetSelect = useCallback(
    (planId: string) => {
      closePlanSheet();
      if (planId === selectedPlanId) return;
      void onPlanChange(planId);
    },
    [closePlanSheet, onPlanChange, selectedPlanId],
  );

  const planSheetOptions = useMemo(
    () =>
      filteredPlans.map((plan) => ({
        key: plan.id,
        label: plan.name,
        active: selectedPlanId === plan.id,
        ariaCurrent: selectedPlanId === plan.id,
        onSelect: () => {
          handlePlanSheetSelect(plan.id);
        },
      })),
    [filteredPlans, handlePlanSheetSelect, selectedPlanId],
  );

  return {
    planSheetOpen,
    planQuery,
    setPlanQuery,
    openPlanSheet,
    closePlanSheet,
    planSheetOptions,
  };
}
