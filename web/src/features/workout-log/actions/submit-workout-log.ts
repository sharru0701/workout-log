"use server";

import { getAuthenticatedUserId } from "@/server/auth/user";
import { resolveRequestLocale } from "@/lib/i18n/messages";
import { upsertWorkoutLogService, type UpsertWorkoutLogInput } from "@/server/services/workout-log/upsert-log";
import { logError } from "@/server/observability/logger";
import { clearWorkoutDraft } from "@/lib/storage/workoutDraftStore";

export async function submitWorkoutLogAction(
  payload: Omit<UpsertWorkoutLogInput, "userId" | "locale">,
  persistenceKey: string | null
) {
  try {
    const userId = getAuthenticatedUserId();
    const locale = await resolveRequestLocale();

    const result = await upsertWorkoutLogService({
      ...payload,
      userId,
      locale,
    });

    if (persistenceKey) {
      await clearWorkoutDraft(persistenceKey);
    }

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    logError("action.submit_workout_log_error", { error });
    return {
      success: false,
      error: error?.message ?? "Failed to save the workout log.",
    };
  }
}
