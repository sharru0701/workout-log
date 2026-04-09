import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { resolveRequestLocale } from "@/lib/i18n/messages";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { getHomeData } from "@/server/home/home-service";

function normalizeTimezone(raw: string | null): string {
  const tz = raw?.trim();
  if (!tz) return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return "UTC";
  }
}

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const locale = await resolveRequestLocale();
    const timezone = normalizeTimezone(searchParams.get("timezone"));
    const recentLimit = parseInt(searchParams.get("recentLimit") || "3", 10);

    // PERF: 서버 서비스 레이어로 로직 이전
    // 쿼리 및 데이터 빌드 프로세스를 단일 서비스 함수로 캡슐화
    const homeData = await getHomeData({
      userId,
      locale,
      timezone,
      recentLimit,
    });

    // PERF: home 데이터는 90초 DB 캐시와 정합되는 HTTP 캐시 설정
    // private: 싱글 유저 앱, CDN 캐시 불필요
    // max-age=60: 클라이언트 1분 캐시 (DB 캐시 90s보다 짧게 설정해 항상 최신 DB 캐시 반영)
    // stale-while-revalidate=120: 캐시 만료 후 2분간 stale 반환하며 백그라운드 재검증
    return NextResponse.json(homeData, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  } catch (e: any) {
    logError("api.home.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const GET = withApiLogging(GETImpl);
