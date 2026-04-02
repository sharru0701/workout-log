// PERF: bundle-service.ts로 핵심 로직을 이전
// 이 라우트는 외부 클라이언트(구버전 브라우저, 캐시 미스 폴백)용 엔드포인트로만 유지
import { NextResponse } from "next/server";
import { fetchStatsBundle } from "@/server/stats/bundle-service";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { apiErrorResponse } from "@/app/api/_utils/error-response";

async function GETImpl(req: Request) {
  try {
    const userId = getAuthenticatedUserId();
    const url = new URL(req.url);
    const daysParam = url.searchParams.get("days");
    const days = daysParam !== null ? parseInt(daysParam, 10) : 30;

    const payload = await fetchStatsBundle({ userId, days });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const GET = withApiLogging(GETImpl);
