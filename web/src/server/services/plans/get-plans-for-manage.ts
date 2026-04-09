import { db } from "@/server/db/client";
import { plan, programTemplate, programVersion, workoutLog } from "@/server/db/schema";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { resolveRequestLocale } from "@/lib/i18n/messages";

// PERF: Plans manage 페이지 SSR용 서버 전용 플랜 조회 함수.
// /api/plans GET과 동일한 쿼리 로직이지만 직렬화된 형태로 반환.

export type PlanForManage = {
  id: string;
  userId: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
  rootProgramVersionId: string | null;
  params: unknown;
  createdAt: string; // ISO 문자열 (클라이언트 직렬화 호환)
  baseProgramName: string | null;
  lastPerformedAt: string | null; // ISO 문자열
};

export async function getPlansForManage(): Promise<PlanForManage[]> {
  const locale = await resolveRequestLocale();
  const userId = getAuthenticatedUserId();

  const baseItems = await db
    .select()
    .from(plan)
    .where(eq(plan.userId, userId))
    .orderBy(desc(plan.createdAt));

  if (baseItems.length === 0) return [];

  const rootVersionIds = Array.from(
    new Set(
      baseItems
        .map((item) => item.rootProgramVersionId)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const planIds = baseItems.map((item) => item.id);

  // PERF: versionRows와 logRows는 독립적이므로 병렬 실행
  const [versionRows, logRows] = await Promise.all([
    rootVersionIds.length > 0
      ? db
          .select({ versionId: programVersion.id, templateName: programTemplate.name })
          .from(programVersion)
          .leftJoin(programTemplate, eq(programTemplate.id, programVersion.templateId))
          .where(inArray(programVersion.id, rootVersionIds))
      : Promise.resolve([]),
    db
      .select({ planId: workoutLog.planId, performedAt: workoutLog.performedAt })
      .from(workoutLog)
      .where(
        and(
          eq(workoutLog.userId, userId),
          isNotNull(workoutLog.planId),
          inArray(workoutLog.planId, planIds),
        ),
      )
      .orderBy(desc(workoutLog.performedAt)),
  ]);

  const versionNameById = new Map<string, string>();
  for (const row of versionRows) {
    if (!row.versionId) continue;
    const label = String(row.templateName ?? "").trim();
    if (label) versionNameById.set(row.versionId, label);
  }

  const lastPerformedAtByPlanId = new Map<string, Date>();
  for (const row of logRows) {
    if (!row.planId || lastPerformedAtByPlanId.has(row.planId)) continue;
    lastPerformedAtByPlanId.set(row.planId, row.performedAt);
  }

  return baseItems.map((item): PlanForManage => {
    const baseProgramName =
      (item.rootProgramVersionId && versionNameById.get(item.rootProgramVersionId)) ??
      (item.type === "COMPOSITE"
        ? locale === "ko" ? "복합 플랜" : "Composite Plan"
        : locale === "ko" ? "프로그램 정보 없음" : "No Program Info");
    const lastPerformedAt = lastPerformedAtByPlanId.get(item.id);
    return {
      id: item.id,
      userId: item.userId,
      name: item.name,
      type: item.type as PlanForManage["type"],
      rootProgramVersionId: item.rootProgramVersionId,
      params: item.params,
      createdAt: item.createdAt.toISOString(),
      baseProgramName,
      lastPerformedAt: lastPerformedAt ? lastPerformedAt.toISOString() : null,
    };
  });
}
