"use server";

import { getAuthenticatedUserId } from "@/server/auth/user";
import { resolveRequestLocale } from "@/lib/i18n/messages";
import { upsertWorkoutLogService, type UpsertWorkoutLogInput } from "@/server/services/workout-log/upsert-log";
import { logError } from "@/server/observability/logger";

export async function submitWorkoutLogAction(
  payload: Omit<UpsertWorkoutLogInput, "userId" | "locale">
) {
  try {
    const userId = getAuthenticatedUserId();
    const locale = await resolveRequestLocale();

    const result = await upsertWorkoutLogService({
      ...payload,
      userId,
      locale,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    logError("action.submit_workout_log_error", { error });
    // Server Action은 Turbopack에서 자동 instrumentation이 안 됨 → 명시 캡처
    try {
      const { captureException } = await import("@sentry/nextjs");
      captureException(error, { tags: { action: "submit_workout_log" } });
    } catch {
      // Sentry 모듈 로드 실패 시 무시
    }
    return {
      success: false,
      error: error?.message ?? "Failed to save the workout log.",
    };
  }
}
