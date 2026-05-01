import { Suspense } from "react";
import { getPlansForManage } from "@/server/services/plans/get-plans-for-manage";
import { PlansOverviewContent } from "./_components/plans-overview-content";
import PlansLoading from "./loading";

async function PlansPageContent() {
  const initialPlans = await getPlansForManage();
  return <PlansOverviewContent initialPlans={initialPlans} />;
}

export default function PlansPage() {
  return (
    <Suspense fallback={<PlansLoading />}>
      <PlansPageContent />
    </Suspense>
  );
}
