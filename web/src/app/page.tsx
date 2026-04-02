import { Suspense } from "react";
import { cookies } from "next/headers";
import { getHomeData } from "@/server/home/home-service";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { resolveRequestLocale } from "@/lib/i18n/messages";
import { HomeDashboard } from "@/components/home/home-dashboard";
import HomeLoading from "./loading";

// PERF: 서버 사이드 데이터 페칭으로 Waterfall 제거 (RTT ~300ms+ 단축)
// React 19 Streaming + Suspense 활용

async function HomeContent() {
  const userId = getAuthenticatedUserId();
  const locale = await resolveRequestLocale();
  const cookieStore = await cookies();
  const timezone = cookieStore.get("timezone")?.value ?? "UTC";

  // DB 쿼리 및 데이터 빌드를 서버에서 직접 실행
  const data = await getHomeData({
    userId,
    locale,
    timezone,
  });

  return <HomeDashboard data={data} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}
