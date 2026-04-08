import { Suspense } from "react";
import { WorkoutLogScreen } from "@/widgets/workout-log-screen";
import { getWorkoutLogPageBootstrap } from "@/server/services/workout-log/get-workout-log-page-bootstrap";
import WorkoutRecordLoading from "./loading";

async function WorkoutLogPageContent() {
  const bootstrap = await getWorkoutLogPageBootstrap();
  return <WorkoutLogScreen {...bootstrap} />;
}

export default function WorkoutLogPage() {
  return (
    <Suspense fallback={<WorkoutRecordLoading />}>
      <WorkoutLogPageContent />
    </Suspense>
  );
}
