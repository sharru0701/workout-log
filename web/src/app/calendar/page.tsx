import { Suspense } from "react";
import { cookies } from "next/headers";
import { desc, eq, gte, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { plan, generatedSession, workoutLog } from "@/server/db/schema";
import { getAuthenticatedUserId } from "@/server/auth/user";
import CalendarClient from "./_components/calendar-client";
import CalendarLoading from "./loading";

// 타임존을 고려한 현재 날짜 문자열 반환 (YYYY-MM-DD)
function dateOnlyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

// PERF: RSC에서 초기 데이터를 병렬 조회 → 클라이언트 mount 후 waterfall 1단계 제거
// Before: mount → /api/plans (1 RTT) → sessions+logs+todayLog (1 RTT) = 2 RTT
// After:  SSR에서 plans+sessions+logs 포함 → mount → todayLog만 (1 RTT) = 1 RTT
async function CalendarPageContent() {
  const userId = getAuthenticatedUserId();
  const cookieStore = await cookies();
  const timezone = cookieStore.get("timezone")?.value ?? "UTC";

  const now = new Date();
  const todayStr = dateOnlyInTimezone(now, timezone);

  // 초기 데이터: plans + 최근 3개월 sessions + 최근 3개월 logs (점 표시용)
  // 3개월치를 가져오면 월 이동 시에도 client re-fetch 없이 표시 가능
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [plans, recentSessions, recentLogs] = await Promise.all([
    db
      .select()
      .from(plan)
      .where(eq(plan.userId, userId))
      .orderBy(desc(plan.createdAt)),

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
          gte(generatedSession.updatedAt, threeMonthsAgo),
        ),
      )
      .orderBy(desc(generatedSession.updatedAt))
      .limit(300),

    db
      .select({
        id: workoutLog.id,
        performedAt: workoutLog.performedAt,
        generatedSessionId: workoutLog.generatedSessionId,
      })
      .from(workoutLog)
      .where(
        and(
          eq(workoutLog.userId, userId),
          gte(workoutLog.performedAt, threeMonthsAgo),
        ),
      )
      .orderBy(desc(workoutLog.performedAt))
      .limit(300),
  ]);

  // planId가 없는 plans 제외 후 직렬화 (jsonb params 포함)
  const serializedPlans = plans.map((p) => ({
    id: p.id,
    userId: p.userId,
    name: p.name,
    type: p.type,
    params: p.params,
    createdAt: p.createdAt.toISOString(),
  }));

  const serializedSessions = recentSessions.map((s) => ({
    id: s.id,
    sessionKey: s.sessionKey,
    updatedAt: s.updatedAt.toISOString(),
  }));

  const serializedLogs = recentLogs.map((l) => ({
    id: l.id,
    performedAt: l.performedAt.toISOString(),
    generatedSessionId: l.generatedSessionId ?? null,
  }));

  return (
    <CalendarClient
      initialPlans={serializedPlans}
      initialSessions={serializedSessions}
      initialLogs={serializedLogs}
      initialTimezone={timezone}
      initialToday={todayStr}
    />
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarLoading />}>
      <CalendarPageContent />
    </Suspense>
  );
}
