import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { logError } from "@/server/observability/logger";
import { withApiLogging } from "@/server/observability/apiRoute";
import { fetchE1rmStats } from "@/server/stats/e1rm-service";
import { parseDateRangeFromSearchParams } from "@/server/stats/range";

async function GETImpl(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = getAuthenticatedUserId();
    const planId = searchParams.get("planId")?.trim() ?? "";
    const exerciseId = searchParams.get("exerciseId")?.trim() ?? "";
    const exerciseName =
      (searchParams.get("exerciseId") ? null : searchParams.get("exercise")) ?? searchParams.get("exerciseName");

    if (!exerciseId && !exerciseName) {
      return NextResponse.json({ error: "exerciseId or exercise is required" }, { status: 400 });
    }

    const { from, to, rangeDays } = parseDateRangeFromSearchParams(searchParams, 180);
    const payload = await fetchE1rmStats({
      userId,
      planId,
      exerciseId,
      exerciseName,
      from,
      to,
      rangeDays,
    });

    return NextResponse.json(payload);
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const GET = withApiLogging(GETImpl);
