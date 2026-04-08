import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { plan, userSetting } from "@/server/db/schema";
import { getAuthenticatedUserId } from "@/server/auth/user";

export type WorkoutLogPlanListItem = {
  id: string;
  name: string;
  params: Record<string, unknown> | null;
  isArchived: boolean;
};

export type WorkoutLogSettingsSnapshot = Record<string, string | number | boolean | null>;

export type WorkoutLogPageBootstrap = {
  initialPlans: WorkoutLogPlanListItem[];
  initialSettings: WorkoutLogSettingsSnapshot;
};

export async function getWorkoutLogPageBootstrap(): Promise<WorkoutLogPageBootstrap> {
  const userId = getAuthenticatedUserId();

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

  const initialSettings: WorkoutLogSettingsSnapshot = {};
  for (const row of settingRows) {
    const value = row.value;
    if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
      initialSettings[row.key] = value;
    }
  }

  const initialPlans: WorkoutLogPlanListItem[] = plans.map((entry) => ({
    id: entry.id,
    name: entry.name,
    params: entry.params as Record<string, unknown> | null,
    isArchived: entry.isArchived,
  }));

  return {
    initialPlans,
    initialSettings,
  };
}
