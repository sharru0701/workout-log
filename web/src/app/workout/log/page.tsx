import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { plan, userSetting } from "@/server/db/schema";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { WorkoutRecordPage } from "./_components/workout-log-client";
import WorkoutRecordLoading from "./loading";

// PERF: RSC에서 플랜 목록 + 사용자 설정을 병렬 조회 → 클라이언트 mount 후 첫 번째 API 왕복 제거
// Before: mount → /api/plans + /api/settings (1 RTT) → 기존 로그 확인 (1 RTT) → 세션 생성 (1 RTT) = 3 RTTs
// After:  SSR에서 plans+settings 포함 → mount → 기존 로그 확인 (1 RTT) → 세션 생성 (1 RTT) = 2 RTTs
async function WorkoutLogPageContent() {
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

  return (
    <WorkoutRecordPage
      initialPlans={serializedPlans}
      initialSettings={settingsSnapshot}
    />
  );
}

export default function WorkoutLogPage() {
  return (
    <Suspense fallback={<WorkoutRecordLoading />}>
      <WorkoutLogPageContent />
    </Suspense>
  );
}
