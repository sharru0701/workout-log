"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { workoutLog, workoutSet } from "@/server/db/schema";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { logError } from "@/server/observability/logger";
import { resolveExerciseByName, getExerciseById } from "@/server/exercise/resolve";
import { applyAutoProgressionFromLog } from "@/server/progression/autoProgression";
import { invalidateStatsCacheForUser } from "@/server/stats/cache";
import { buildProgressionSummary, readProgressEventByLog } from "@/server/progression/summary";
import { generateAndSaveSession } from "@/server/program-engine/generateSession";
import type { WorkoutLogPayload } from "@/entities/workout";

export async function generateWorkoutSessionAction(params: {
  planId: string;
  week?: number;
  day?: number;
  sessionDate?: string;
  timezone?: string;
}) {
  try {
    const userId = getAuthenticatedUserId();
    const { planId, week, day, sessionDate, timezone } = params;

    const session = await generateAndSaveSession({
      userId,
      planId,
      week,
      day,
      sessionDate,
      timezone,
    });

    return { success: true, session };
  } catch (error: any) {
    logError("action.generateWorkoutSessionAction_failed", { error: error.message });
    return { success: false, error: error.message };
  }
}

export async function saveWorkoutLogAction(payload: WorkoutLogPayload) {
  try {
    const userId = getAuthenticatedUserId();
    const { sets, planId, generatedSessionId, performedAt, durationMinutes, notes } = payload;

    if (!sets || sets.length === 0) {
      throw new Error("Sets are required.");
    }

    // Resolve exercises
    const resolvedByName = new Map<string, string | null>();
    const resolvedById = new Map<string, string | null>();

    const uniqueExerciseIds = Array.from(
      new Set(sets.map((s) => s.exerciseId).filter(Boolean) as string[])
    );
    const uniqueExerciseNames = Array.from(
      new Set(
        sets
          .filter((s) => !s.exerciseId)
          .map((s) => s.exerciseName.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    await Promise.all([
      ...uniqueExerciseIds.map(async (id) => {
        const found = await getExerciseById(id);
        resolvedById.set(id, found?.id ?? null);
      }),
      ...uniqueExerciseNames.map(async (nameLower) => {
        const found = await resolveExerciseByName(nameLower);
        resolvedByName.set(nameLower, found?.id ?? null);
      }),
    ]);

    const result = await db.transaction(async (tx) => {
      const [log] = await tx
        .insert(workoutLog)
        .values({
          userId,
          planId,
          generatedSessionId,
          performedAt: new Date(performedAt),
          durationMinutes,
          notes,
        })
        .returning();

      await tx.insert(workoutSet).values(
        sets.map((s, idx) => {
          let exerciseId: string | null = null;
          if (s.exerciseId) {
            exerciseId = resolvedById.get(s.exerciseId) ?? null;
          } else {
            exerciseId = resolvedByName.get(s.exerciseName.toLowerCase()) ?? null;
          }

          return {
            logId: log.id,
            exerciseId,
            exerciseName: s.exerciseName,
            sortOrder: idx,
            setNumber: s.setNumber,
            reps: s.reps,
            weightKg: s.weightKg,
            rpe: s.rpe,
            isExtra: s.isExtra,
            meta: s.meta,
          };
        })
      );

      const progressionResult = await applyAutoProgressionFromLog({
        tx,
        userId,
        planId,
        logId: log.id,
        sets: sets as any, // Need to match type exactly if needed
      });

      const progressionEvent = await readProgressEventByLog({
        tx,
        planId,
        logId: log.id,
      });

      await invalidateStatsCacheForUser(userId, tx);

      return {
        log,
        progression: buildProgressionSummary({
          mode: "upsert",
          applyResult: progressionResult,
          eventRow: progressionEvent,
        }),
      };
    });

    revalidatePath("/workout/log");
    revalidatePath("/calendar");
    revalidatePath("/stats");

    return { success: true, data: result };
  } catch (error: any) {
    logError("action.saveWorkoutLogAction_failed", { error: error.message });
    return { success: false, error: error.message };
  }
}
