import { eq } from "drizzle-orm";
import { db } from "@workout/core/db/client";
import {
  generatedSession,
  plan,
  planProgressEvent,
  planRuntimeState,
  statsCache,
  userSetting,
  uxEventLog,
  workoutLog,
} from "@workout/core/db/schema";

/**
 * env fallback userId(WORKOUT_AUTH_USER_ID, 기본 "dev")로 쌓여 있던
 * 모든 도메인 데이터를 새 가입자(uuid)에게 옮기기.
 *
 * 시나리오:
 * - 개발 환경에서 단일 사용자로 데이터 누적
 * - 첫 가입자가 이 데이터를 claim 하면 모든 row의 user_id를 새 uuid로 update
 *
 * 안전 장치:
 * - env userId가 비어 있으면 noop
 * - 새 사용자(target)가 이미 본인 데이터가 있으면 noop (충돌 회피)
 */
export async function claimEnvFallbackData(input: {
  toUserId: string;
}): Promise<{
  claimed: boolean;
  fromUserId: string | null;
  movedRowCounts: Record<string, number> | null;
}> {
  const fromUserId = (process.env.WORKOUT_AUTH_USER_ID ?? "").trim();
  if (!fromUserId) {
    return { claimed: false, fromUserId: null, movedRowCounts: null };
  }
  if (fromUserId === input.toUserId) {
    return { claimed: false, fromUserId, movedRowCounts: null };
  }

  // 새 사용자에게 이미 데이터가 있으면 충돌 회피로 skip
  const existing = await db
    .select({ id: workoutLog.id })
    .from(workoutLog)
    .where(eq(workoutLog.userId, input.toUserId))
    .limit(1);
  if (existing.length > 0) {
    return { claimed: false, fromUserId, movedRowCounts: null };
  }

  // 모든 도메인 테이블의 user_id 일괄 update
  const tables = [
    { name: "plan", table: plan, col: plan.userId },
    {
      name: "planRuntimeState",
      table: planRuntimeState,
      col: planRuntimeState.userId,
    },
    {
      name: "generatedSession",
      table: generatedSession,
      col: generatedSession.userId,
    },
    { name: "workoutLog", table: workoutLog, col: workoutLog.userId },
    {
      name: "planProgressEvent",
      table: planProgressEvent,
      col: planProgressEvent.userId,
    },
    { name: "statsCache", table: statsCache, col: statsCache.userId },
    { name: "userSetting", table: userSetting, col: userSetting.userId },
    { name: "uxEventLog", table: uxEventLog, col: uxEventLog.userId },
  ];

  const movedRowCounts: Record<string, number> = {};
  await db.transaction(async (tx) => {
    for (const t of tables) {
      const result = await tx
        .update(t.table)
        .set({ userId: input.toUserId })
        .where(eq(t.col, fromUserId));
      // drizzle pg result에는 rowCount가 있음
      movedRowCounts[t.name] = (result as any)?.rowCount ?? 0;
    }
  });

  return { claimed: true, fromUserId, movedRowCounts };
}
