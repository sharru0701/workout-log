import { Suspense } from "react";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { fetchStatsBundle } from "@/server/stats/bundle-service";
import { StatsClient } from "./_components/stats-client";
import StatsLoading from "./loading";

// PERF: 서버 컴포넌트로 전환 → 클라이언트 데이터 fetch waterfall 제거
// compliance + prs 데이터를 SSR 시점에 DB에서 직접 조회하여 HTML에 포함
// 클라이언트는 로딩 없이 즉시 렌더링

export default async function StatsPage() {
  const userId = getAuthenticatedUserId();
  // DB 캐시(5분 TTL) 히트 시 쿼리 없이 즉시 반환
  const bundle = await fetchStatsBundle({ userId, days: 90 });

  return (
    // useSearchParams() 사용 컴포넌트를 위한 Suspense 경계
    <Suspense fallback={<StatsLoading />}>
      <StatsClient initialBundle={bundle} />
    </Suspense>
  );
}
