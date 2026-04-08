import { memo } from "react";
import { useLocale } from "@/components/locale-provider";
import { PlanSelectorButton } from "@/shared/ui/plan-selector-button";

export const WorkoutLogPlanSelector = memo(function WorkoutLogPlanSelector({
  planName,
  isLocked,
  isOpen,
  onClick,
}: {
  planName: string;
  isLocked: boolean;
  isOpen: boolean;
  onClick: () => void;
}) {
  const { copy } = useLocale();

  return (
    <section className="plan-selector-strip">
      <div className="plan-selector-strip__label">{copy.workoutLog.activePlanLabel}</div>
      <PlanSelectorButton
        planName={planName}
        aria-expanded={isLocked ? false : isOpen}
        onClick={isLocked ? undefined : onClick}
        disabled={isLocked}
      />
      {isLocked ? (
        <p style={{ marginTop: "var(--space-xs)", fontSize: "12px", color: "var(--text-hint)" }}>
          {copy.workoutLog.planLockedWhileEditing}
        </p>
      ) : null}
    </section>
  );
});
