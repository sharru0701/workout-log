import { asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { exercise } from "@/server/db/schema";
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

  // PERF: exerciseId/exerciseName이 URL에 이미 있으면 3개 fetch를 모두 병렬로 실행 → 왕복 1회 절감
  if (selectedExerciseId || selectedExerciseName) {
    const [bundle, filterOptions, initialE1rm] = await Promise.all([
      fetchStatsBundle({ userId, days: 90 }),
      fetchStats1RMFilterOptions(userId),
      fetchE1rmStats({
        userId,
        planId: selectedPlanId,
        exerciseId: selectedExerciseId || null,
        exerciseName: selectedExerciseName || null,
        from,
        to,
        rangeDays,
      }),
    ]);
    return {
      initialBundle: bundle,
      initialExercises: filterOptions.exercises,
      initialPlans: filterOptions.plans,
      initialE1rm,
      initialSelectedExerciseId:
        initialE1rm?.exerciseId ?? (selectedExerciseId || null),
      initialSelectedPlanId: selectedPlanId,
    };
  }

  // exerciseId/exerciseName 미지정: 첫 번째 운동 ID를 빠른 쿼리로 먼저 조회한 뒤
  // bundle + filterOptions + e1rm을 모두 병렬로 실행 → 왕복 2회(직렬) → 2회(1회 초경량 + 1회 병렬)
  const firstExerciseRows = await db
    .select({ id: exercise.id })
    .from(exercise)
    .orderBy(asc(exercise.name))
    .limit(1);
  const initialExerciseId = firstExerciseRows[0]?.id ?? "";

  const [bundle, filterOptions, initialE1rm] = await Promise.all([
    fetchStatsBundle({ userId, days: 90 }),
    fetchStats1RMFilterOptions(userId),
    initialExerciseId
      ? fetchE1rmStats({
          userId,
          planId: selectedPlanId,
          exerciseId: initialExerciseId,
          exerciseName: null,
          from,
          to,
          rangeDays,
        })
      : Promise.resolve(null),
  ]);

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
