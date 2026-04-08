import { apiGet } from "@/shared/api";
import { fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import type { SettingsSnapshot } from "@/lib/settings/workout-preferences";
import type {
  WorkoutLogExerciseResponse,
  WorkoutLogExerciseOption,
  WorkoutLogPlanItem,
  WorkoutLogPlansResponse,
} from "./types";

type WorkoutLogClientBootstrapInput = {
  initialPlans?: WorkoutLogPlanItem[];
  initialSettings?: SettingsSnapshot | null;
};

type WorkoutLogClientBootstrapResult = {
  plans: WorkoutLogPlanItem[];
  settingsSnapshot: SettingsSnapshot | null;
};

export async function getWorkoutLogClientBootstrap({
  initialPlans,
  initialSettings,
}: WorkoutLogClientBootstrapInput): Promise<WorkoutLogClientBootstrapResult> {
  if (initialPlans != null) {
    return {
      plans: initialPlans,
      settingsSnapshot: initialSettings ?? null,
    };
  }

  const [planRes, settingsSnapshot] = await Promise.all([
    apiGet<WorkoutLogPlansResponse>("/api/plans"),
    fetchSettingsSnapshot().catch(() => null),
  ]);

  return {
    plans: planRes.items ?? [],
    settingsSnapshot,
  };
}

export async function fetchWorkoutExerciseOptions(
  queryValue: string,
  signal?: AbortSignal,
): Promise<WorkoutLogExerciseOption[]> {
  const params = new URLSearchParams({ limit: "40" });
  if (queryValue.trim()) {
    params.set("query", queryValue.trim());
  }

  const response = await apiGet<WorkoutLogExerciseResponse>(
    `/api/exercises?${params.toString()}`,
    { signal },
  );

  return response.items ?? [];
}
