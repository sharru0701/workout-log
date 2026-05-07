import { Suspense } from "react";
import { getPrHistoryBootstrap } from "@/server/services/stats/get-pr-history-bootstrap";
import { PrHistoryScreen } from "@/widgets/pr-history-screen";
import PrHistoryLoading from "./loading";

async function PrHistoryContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const bootstrap = await getPrHistoryBootstrap(
    searchParams ? await searchParams : undefined,
  );
  return <PrHistoryScreen {...bootstrap} />;
}

export default function PrHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PrHistoryLoading />}>
      <PrHistoryContent searchParams={searchParams} />
    </Suspense>
  );
}
