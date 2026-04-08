import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { plan, programVersion, programTemplate, workoutLog, workoutSet } from "@/server/db/schema";
import type { AppLocale } from "@/lib/i18n/messages";

async function fetchPlans(userId: string, locale: AppLocale) {
  const rows = await db
    .select({
      id: plan.id,
      name: plan.name,
      type: plan.type,
      rootProgramVersionId: plan.rootProgramVersionId,
      createdAt: plan.createdAt,
      templateName: programTemplate.name,
      lastPerformedAt: sql<Date | null>`max(${workoutLog.performedAt})`,
    })
    .from(plan)
    .leftJoin(programVersion, eq(programVersion.id, plan.rootProgramVersionId))
    .leftJoin(programTemplate, eq(programTemplate.id, programVersion.templateId))
    .leftJoin(workoutLog, eq(workoutLog.planId, plan.id))
    .where(eq(plan.userId, userId))
    .groupBy(plan.id, programTemplate.name)
    .orderBy(desc(plan.createdAt));

  if (rows.length === 0) return [];

  return rows.map((row) => {
    const baseProgramName =
      (row.rootProgramVersionId && row.templateName)
        ? String(row.templateName).trim()
        : (row.type === "COMPOSITE"
          ? (locale === "ko" ? "복합 플랜" : "Composite Plan")
          : (locale === "ko" ? "프로그램 정보 없음" : "No Program Info"));
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      rootProgramVersionId: row.rootProgramVersionId,
      createdAt: row.createdAt,
      baseProgramName,
      lastPerformedAt: row.lastPerformedAt,
    };
  });
}

async function fetchLogs(userId: string, limit: number) {
  const subq = db
    .select()
    .from(workoutLog)
    .where(eq(workoutLog.userId, userId))
    .orderBy(desc(workoutLog.performedAt))
    .limit(limit)
    .as("l");

  const rows = await db
    .select({
      id: subq.id,
      planId: subq.planId,
      performedAt: subq.performedAt,
      exerciseName: workoutSet.exerciseName,
      reps: workoutSet.reps,
      weightKg: workoutSet.weightKg,
      meta: workoutSet.meta,
    })
    .from(subq)
    .leftJoin(workoutSet, eq(workoutSet.logId, subq.id))
    .orderBy(desc(subq.performedAt), subq.id, workoutSet.sortOrder);

  if (rows.length === 0) return [];

  const logsById = new Map<string, any>();

  for (const r of rows) {
    if (!logsById.has(r.id)) {
      logsById.set(r.id, {
        id: r.id,
        planId: r.planId,
        performedAt: r.performedAt,
        sets: [],
      });
    }
    if (r.exerciseName) {
      logsById.get(r.id).sets.push({
        exerciseName: r.exerciseName,
        reps: r.reps,
        weightKg: r.weightKg,
        meta: r.meta,
      });
    }
  }

  return Array.from(logsById.values());
}
