import { Suspense } from "react";
import { cookies } from "next/headers";
import { getHomeData } from "@/server/home/home-service";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { resolveRequestLocale, getAppCopy } from "@/lib/i18n/messages";
import { HomeDashboard } from "@/components/home/home-dashboard";
import HomeLoading from "./loading";

// PERF: 완전한 Server Component화로 클라이언트 JS 번들 최소화 및 Waterfall 제거
// React 19 Streaming + Zero-JS Dashboard (상호작용이 필요 없는 정적 뷰)

async function HomeContent() {
  const userId = getAuthenticatedUserId();
  const locale = await resolveRequestLocale();
  const copy = getAppCopy(locale);
  
  const cookieStore = await cookies();
  const timezone = cookieStore.get("timezone")?.value ?? "UTC";

  // DB 쿼리 및 데이터 빌드를 서버에서 직접 실행
  const data = await getHomeData({
    userId,
    locale,
    timezone,
  });

  return <HomeDashboard data={data} copy={copy} locale={locale} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}
