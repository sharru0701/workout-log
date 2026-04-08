import { getAuthenticatedUserId } from "@/server/auth/user";
import { fetchStatsBundle } from "@/server/stats/bundle-service";
import {
  fetchE1rmStats,
  fetchStats1RMFilterOptions,
} from "@/server/stats/e1rm-service";

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function createDefaultStatsRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 90);
  const rangeMs = Math.max(1, to.getTime() - from.getTime());
  const rangeDays = Math.max(1, Math.ceil(rangeMs / 86_400_000));
  return { from, to, rangeDays };
}

export type StatsPageBootstrap = {
  initialBundle: Awaited<ReturnType<typeof fetchStatsBundle>>;
  initialExercises?: Awaited<ReturnType<typeof fetchStats1RMFilterOptions>>["exercises"];
  initialPlans?: Awaited<ReturnType<typeof fetchStats1RMFilterOptions>>["plans"];
  initialE1rm: Awaited<ReturnType<typeof fetchE1rmStats>> | null;
  initialSelectedExerciseId: string | null;
  initialSelectedPlanId: string;
};

export async function getStatsPageBootstrap(
  searchParams?: SearchParams,
): Promise<StatsPageBootstrap> {
  const userId = getAuthenticatedUserId();
  const params = searchParams ?? {};
  const defer1rmBootstrap = readString(params, "defer1rmBootstrap") === "1";
  const selectedExerciseId = readString(params, "exerciseId")?.trim() ?? "";
  const selectedExerciseName =
    readString(params, "exercise")?.trim() ||
    readString(params, "exerciseName")?.trim() ||
    "";
  const selectedPlanId = readString(params, "planId")?.trim() ?? "";
  const { from, to, rangeDays } = createDefaultStatsRange();

  if (defer1rmBootstrap) {
    return {
      initialBundle: await fetchStatsBundle({ userId, days: 90 }),
      initialExercises: undefined,
      initialPlans: undefined,
      initialE1rm: null,
      initialSelectedExerciseId: null,
      initialSelectedPlanId: selectedPlanId,
    };
  }

  const [bundle, filterOptions] = await Promise.all([
    fetchStatsBundle({ userId, days: 90 }),
    fetchStats1RMFilterOptions(userId),
  ]);

  const initialExerciseId =
    selectedExerciseId ||
    (!selectedExerciseName ? filterOptions.exercises[0]?.id || "" : "");
  const initialExerciseName = initialExerciseId ? "" : selectedExerciseName;
  const initialE1rm =
    initialExerciseId || initialExerciseName
      ? await fetchE1rmStats({
          userId,
          planId: selectedPlanId,
          exerciseId: initialExerciseId || null,
          exerciseName: initialExerciseName || null,
          from,
          to,
          rangeDays,
        })
      : null;

  return {
    initialBundle: bundle,
    initialExercises: filterOptions.exercises,
    initialPlans: filterOptions.plans,
    initialE1rm,
    initialSelectedExerciseId:
      initialE1rm?.exerciseId ?? (initialExerciseId || null),
    initialSelectedPlanId: selectedPlanId,
  };
}
