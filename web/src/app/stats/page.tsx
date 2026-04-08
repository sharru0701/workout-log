import { Suspense } from "react";
import { getStatsPageBootstrap } from "@/server/services/stats/get-stats-page-bootstrap";
import { StatsScreen } from "@/widgets/stats-screen";
import StatsLoading from "./loading";

export default async function StatsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const bootstrap = await getStatsPageBootstrap(
    searchParams ? await searchParams : undefined,
  );

  return (
    <Suspense fallback={<StatsLoading />}>
      <StatsScreen {...bootstrap} />
    </Suspense>
  );
}
