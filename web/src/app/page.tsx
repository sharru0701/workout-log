import { Suspense } from "react";
import { cookies } from "next/headers";
import { getHomeData } from "@/server/home/home-service";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { resolveRequestLocale, getAppCopy } from "@/lib/i18n/messages";
import { HomeDashboard } from "@/components/home/home-dashboard";
import HomeLoading from "./loading";


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
