import { Suspense } from "react";
import { getStatsPageBootstrap } from "@/server/services/stats/get-stats-page-bootstrap";
import { StatsScreen } from "@/widgets/stats-screen";
import StatsLoading from "./loading";


// PERF: 데이터 페칭을 내부 컴포넌트로 이동하여 Suspense가 실제로 작동하도록 함
// 기존: async 외부 컴포넌트가 데이터를 기다린 후 Suspense에 전달 (의미없는 Suspense)
// 개선: 외부 컴포넌트는 동기, 내부 컴포넌트에서 await → Suspense가 로딩 UI 즉시 표시
async function StatsContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const bootstrap = await getStatsPageBootstrap(
    searchParams ? await searchParams : undefined,
  );
  return <StatsScreen {...bootstrap} />;
}

export default function StatsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<StatsLoading />}>
      <StatsContent searchParams={searchParams} />
    </Suspense>
  );
}
