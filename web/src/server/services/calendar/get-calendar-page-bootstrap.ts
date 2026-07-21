import { cookies } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { requireAuthenticatedUserId } from "@/server/auth/user";
import { db } from "@workout/core/db/client";
import { generatedSession, plan, userSetting, workoutLog } from "@workout/core/db/schema";
import { ACTIVE_PLAN_SETTING_KEY, resolveActivePlan } from "@workout/core/active-plan";

type SerializedPlan = {
  id: string;
  userId: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
  params: Record<string, unknown> | null;
  createdAt: string;
};

type SerializedGeneratedSession = {
  id: string;
  sessionKey: string;
  updatedAt: string;
};

type SerializedWorkoutLog = {
  id: string;
  performedAt: string;
  generatedSessionId: string | null;
};

export type CalendarPageBootstrap = {
  initialPlans: SerializedPlan[];
  initialSessions: SerializedGeneratedSession[];
  initialLogs: SerializedWorkoutLog[];
  initialTimezone: string;
  initialToday: string;
};

function dateOnlyInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((part) => part.type === "year")?.value ?? "1970";
  const m = parts.find((part) => part.type === "month")?.value ?? "01";
  const d = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export async function getCalendarPageBootstrap(): Promise<CalendarPageBootstrap> {
  const userId = await requireAuthenticatedUserId();
  const cookieStore = await cookies();
  const timezone = cookieStore.get("timezone")?.value ?? "UTC";

  const now = new Date();
  const today = dateOnlyInTimezone(now, timezone);

  const [allPlans, activePlanSettingRows] = await Promise.all([
    db
      .select()
      .from(plan)
      // 보관된 플랜은 선택 목록에서 제외한다 — 기록은 남아 있고 플랜 관리에서 되돌릴 수 있다.
      .where(and(eq(plan.userId, userId), eq(plan.isArchived, false)))
      .orderBy(desc(plan.createdAt)),
    db
      .select({ value: userSetting.value })
      .from(userSetting)
      .where(
        and(eq(userSetting.userId, userId), eq(userSetting.key, ACTIVE_PLAN_SETTING_KEY)),
      )
      .limit(1),
  ]);

  // 캘린더는 플랜 스코프 화면: 컨트롤러가 initialPlans[0]을 기본 선택하고 이후
  // refetch(/api/generated-sessions·/api/logs)를 planId로 필터하므로 SSR도 같은
  // 스코프여야 한다. 유저 전체를 내려보내면 다른 플랜 기록이 선택 플랜명으로
  // 라벨링되고 isLatestLog(삭제/날짜이동 허용) 판정도 오판한다. limit 100은 라우트 상한.
  //
  // 기본 선택은 홈·기록과 같은 활성 플랜 규칙을 따른다. 컨트롤러가 initialPlans[0]을
  // 집으므로, 고른 플랜을 목록 맨 앞으로 올려 SSR 스코프와 클라이언트 선택을 일치시킨다.
  const rawActivePlanId = activePlanSettingRows[0]?.value;
  const activePlanId = typeof rawActivePlanId === "string" ? rawActivePlanId.trim() : null;
  const activePlan = resolveActivePlan(allPlans, activePlanId);
  const plans = activePlan
    ? [activePlan, ...allPlans.filter((entry) => entry.id !== activePlan.id)]
    : allPlans;
  const defaultPlanId = plans[0]?.id ?? null;

  const [recentSessions, recentLogs] = defaultPlanId
    ? await Promise.all([
        db
          .select({
            id: generatedSession.id,
            sessionKey: generatedSession.sessionKey,
            updatedAt: generatedSession.updatedAt,
          })
          .from(generatedSession)
          .where(
            and(
              eq(generatedSession.userId, userId),
              eq(generatedSession.planId, defaultPlanId),
            ),
          )
          .orderBy(desc(generatedSession.updatedAt))
          .limit(100),
        db
          .select({
            id: workoutLog.id,
            performedAt: workoutLog.performedAt,
            generatedSessionId: workoutLog.generatedSessionId,
          })
          .from(workoutLog)
          .where(
            and(eq(workoutLog.userId, userId), eq(workoutLog.planId, defaultPlanId)),
          )
          .orderBy(desc(workoutLog.performedAt), desc(workoutLog.id))
          .limit(100),
      ])
    : [[], []];

  return {
    initialPlans: plans.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      name: entry.name,
      type: entry.type,
      params: entry.params as Record<string, unknown> | null,
      createdAt: entry.createdAt.toISOString(),
    })),
    initialSessions: recentSessions.map((entry) => ({
      id: entry.id,
      sessionKey: entry.sessionKey,
      updatedAt: entry.updatedAt.toISOString(),
    })),
    initialLogs: recentLogs.map((entry) => ({
      id: entry.id,
      performedAt: entry.performedAt.toISOString(),
      generatedSessionId: entry.generatedSessionId ?? null,
    })),
    initialTimezone: timezone,
    initialToday: today,
  };
}
