import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { plan, userSetting } from "@/server/db/schema";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { WorkoutLogRoot } from "@/features/workout-logging/ui/workout-log-root";
import WorkoutRecordLoading from "./loading";

async function WorkoutLogPageContent({ searchParams }: { searchParams: Promise<any> }) {
  const userId = getAuthenticatedUserId();
  const params = await searchParams;
  const date = params.date || "";
  const logId = params.logId || "";
  const planIdFromQuery = params.planId || "";

  const [plans, settingRows] = await Promise.all([
    db
      .select({
        id: plan.id,
        name: plan.name,
        params: plan.params,
        isArchived: plan.isArchived,
      })
      .from(plan)
      .where(eq(plan.userId, userId))
      .orderBy(desc(plan.createdAt)),

    db
      .select({ key: userSetting.key, value: userSetting.value })
      .from(userSetting)
      .where(eq(userSetting.userId, userId)),
  ]);

  const settingsSnapshot: Record<string, string | number | boolean | null> = {};
  for (const row of settingRows) {
    const v = row.value;
    if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number") {
      settingsSnapshot[row.key] = v as string | number | boolean | null;
    }
  }

  const serializedPlans = plans.map((p) => ({
    id: p.id,
    name: p.name,
    params: p.params as Record<string, unknown> | null,
    isArchived: p.isArchived,
  }));

  const selectedPlanId = planIdFromQuery || serializedPlans[0]?.id || "";
  const persistenceKey = logId ? `log:${logId}` : selectedPlanId && date ? `plan:${selectedPlanId}:${date}` : null;

  return (
    <WorkoutLogRoot
      initialPlans={serializedPlans}
      initialSettings={settingsSnapshot}
      persistenceKey={persistenceKey}
    />
  );
}

export default function WorkoutLogPage({ searchParams }: { searchParams: Promise<any> }) {
  return (
    <Suspense fallback={<WorkoutRecordLoading />}>
      <WorkoutLogPageContent searchParams={searchParams} />
    </Suspense>
  );
}
