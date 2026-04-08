import { WorkoutLogScreen } from "@/widgets/workout-log-screen";
import type { WorkoutLogPageBootstrap } from "@/server/services/workout-log/get-workout-log-page-bootstrap";

export function LegacyWorkoutLogScreen({ initialPlans, initialSettings }: WorkoutLogPageBootstrap) {
  return (
    <WorkoutLogScreen
      initialPlans={initialPlans}
      initialSettings={initialSettings}
    />
  );
}
