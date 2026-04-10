import { Suspense } from "react";
import { ProgramStoreScreen } from "@/widgets/program-store-screen/program-store-screen";
import { getProgramStorePageBootstrap } from "@/server/services/program-store/get-program-store-page-bootstrap";

async function ProgramStorePageContent() {
  const bootstrap = await getProgramStorePageBootstrap();
  return (
    <ProgramStoreScreen
      initialTemplates={bootstrap.initialTemplates}
      initialPlans={bootstrap.initialPlans}
      initialExercises={bootstrap.initialExercises}
    />
  );
}

function ProgramStoreLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--token-page-bg)]" />
  );
}

export default function ProgramStorePage() {
  return (
    <Suspense fallback={<ProgramStoreLoading />}>
      <ProgramStorePageContent />
    </Suspense>
  );
}
