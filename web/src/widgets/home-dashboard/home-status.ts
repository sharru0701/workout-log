import type { HomeTodaySummary } from "@/lib/home/home-data-source";

type HomeCompletionState = Pick<
  HomeTodaySummary,
  "completedSets" | "loggedExercises" | "totalPlannedSets"
> & {
  /** Optional so an older cached home payload remains safe during rollout. */
  hasCompletedWorkout?: boolean;
};

export function isHomeWorkoutComplete(today: HomeCompletionState) {
  if (today.hasCompletedWorkout === true) return true;
  if (today.loggedExercises.length > 0) return true;
  return (
    today.totalPlannedSets > 0 &&
    today.completedSets >= today.totalPlannedSets
  );
}
