import { Suspense } from "react";
import { WorkoutLogScreen } from "@/widgets/workout-log-screen";
import { getWorkoutLogPageBootstrap } from "@/server/services/workout-log/get-workout-log-page-bootstrap";
import WorkoutRecordLoading from "./loading";

// PERF: PPR - 레이아웃 쉘 즉시 서빙, 운동 데이터는 스트리밍
export const experimental_ppr = true;

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
