import { NextResponse } from "next/server";
import { parseDateRangeFromSearchParams } from "@/server/stats/range";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { requireAuthenticatedUserId } from "@/server/auth/user";
import { fetchPrsList } from "@/server/stats/prs-service";
import { apiErrorResponse } from "@/app/api/_utils/error-response";

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = await requireAuthenticatedUserId();
    const exerciseId = searchParams.get("exerciseId")?.trim() ?? "";
    const exerciseName = searchParams.get("exercise") ?? searchParams.get("exerciseName");
    const limitRaw = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 20;

    const { from, to, rangeDays } = parseDateRangeFromSearchParams(searchParams, 365);

    const result = await fetchPrsList({
      userId,
      from,
      to,
      rangeDays,
      exerciseId,
      exerciseName,
      limit,
    });

    return NextResponse.json({
      from: result.from,
      to: result.to,
      rangeDays: result.rangeDays,
      items: result.items,
    });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const GET = withApiLogging(GETImpl);
