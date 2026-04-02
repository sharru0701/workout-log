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

    return NextResponse.json(homeData);
  } catch (e: any) {
    logError("api.home.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const GET = withApiLogging(GETImpl);
