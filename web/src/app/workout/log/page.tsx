import { Suspense } from "react";
import { WorkoutLogScreen } from "@/widgets/workout-log-screen";
import { getWorkoutLogPageBootstrap } from "@/server/services/workout-log/get-workout-log-page-bootstrap";
import WorkoutRecordLoading from "./loading";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function WorkoutLogPageContent({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const bootstrap = await getWorkoutLogPageBootstrap(resolvedParams);
  return <WorkoutLogScreen {...bootstrap} />;
}

export default function WorkoutLogPage(props: PageProps) {
  return (
    <Suspense fallback={<WorkoutRecordLoading />}>
      <WorkoutLogPageContent searchParams={props.searchParams} />
    </Suspense>
  );
}
