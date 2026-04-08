import { apiPatch, apiPost } from "@/shared/api";
import { toWorkoutLogPayload, type WorkoutRecordDraft } from "@/entities/workout-record";
import { isBodyweightExerciseName } from "@/lib/bodyweight-load";
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

  if (draft.session.logId) {
    await apiPatch(`/api/logs/${encodeURIComponent(draft.session.logId)}`, payloadWithOverride);
  } else {
    await apiPost("/api/logs", payloadWithOverride);
  }

  if (persistenceKey) {
    await clearWorkoutDraft(persistenceKey);
  }
}
