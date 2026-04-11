import { toWorkoutLogPayload, type WorkoutRecordDraft } from "@/entities/workout-record";
import { isBodyweightExerciseName } from "@/lib/bodyweight-load";
import { submitWorkoutLogAction } from "../actions/submit-workout-log";
import { clearWorkoutDraft } from "@/lib/storage/workoutDraftStore";

export async function submitWorkoutLogDraft({
  draft,
  bodyweightKg,
  progressionOverride,
  persistenceKey,
}: {
  draft: WorkoutRecordDraft;
  bodyweightKg: number | null | undefined;
  progressionOverride: "hold" | "increase" | "reset" | null;
  persistenceKey: string | null;
}) {
  const payload = toWorkoutLogPayload(draft, {
    bodyweightKg: bodyweightKg ?? null,
    isBodyweightExercise: isBodyweightExerciseName,
  });

  const payloadWithOverride = progressionOverride ? { ...payload, progressionOverride } : payload;
  
  const result = await submitWorkoutLogAction({
    logId: draft.session.logId ?? undefined,
    timezone: payloadWithOverride.timezone ?? "UTC",
    performedAt: new Date(payloadWithOverride.performedAt),
    durationMinutes: payloadWithOverride.durationMinutes,
    notes: payloadWithOverride.notes,
    planId: payloadWithOverride.planId,
    generatedSessionId: payloadWithOverride.generatedSessionId,
    sets: payloadWithOverride.sets,
    progressionOverride: (payloadWithOverride as any).progressionOverride as "hold" | "increase" | "reset" | undefined,
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  if (persistenceKey) {
    await clearWorkoutDraft(persistenceKey);
  }

  return result.data;
}
