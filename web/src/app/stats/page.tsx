import { Suspense } from "react";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { fetchStatsBundle } from "@/server/stats/bundle-service";
import { fetchE1rmStats, fetchStats1RMFilterOptions } from "@/server/stats/e1rm-service";
import { StatsClient } from "./_components/stats-client";
import StatsLoading from "./loading";

// PERF: 서버 컴포넌트로 전환 → 클라이언트 데이터 fetch waterfall 제거
// compliance + prs 데이터를 SSR 시점에 DB에서 직접 조회하여 HTML에 포함
// 클라이언트는 로딩 없이 즉시 렌더링

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

export default async function StatsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const userId = getAuthenticatedUserId();
  const params = searchParams ? await searchParams : {};
  const selectedExerciseId = readString(params, "exerciseId")?.trim() ?? "";
  const selectedExerciseName = readString(params, "exercise")?.trim() || readString(params, "exerciseName")?.trim() || "";
  const selectedPlanId = readString(params, "planId")?.trim() ?? "";
  const { from, to, rangeDays } = createDefaultStatsRange();

  const [bundle, filterOptions] = await Promise.all([
    fetchStatsBundle({ userId, days: 90 }),
    fetchStats1RMFilterOptions(userId),
  ]);

  const initialExerciseId = selectedExerciseId || (!selectedExerciseName ? filterOptions.exercises[0]?.id || "" : "");
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

  return (
    // useSearchParams() 사용 컴포넌트를 위한 Suspense 경계
    <Suspense fallback={<StatsLoading />}>
      <StatsClient
        initialBundle={bundle}
        initialExercises={filterOptions.exercises}
        initialPlans={filterOptions.plans}
        initialE1rm={initialE1rm}
        initialSelectedExerciseId={initialE1rm?.exerciseId ?? (initialExerciseId || null)}
        initialSelectedPlanId={selectedPlanId}
      />
    </Suspense>
  );
}
