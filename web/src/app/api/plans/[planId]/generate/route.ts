import { NextResponse } from "next/server";
import { generateAndSaveSession } from "@/server/program-engine/generateSession";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { resolveRequestLocale } from "@/lib/i18n/messages";

type Ctx = { params: Promise<{ planId: string }> };

async function POSTImpl(req: Request, ctx: Ctx) {
  try {
    const { planId } = await ctx.params;
    const locale = await resolveRequestLocale();

    const body = await req.json();
    const userId = getAuthenticatedUserId();
    const rawWeek = body.week;
    const rawDay = body.day;
    const week =
      rawWeek === undefined || rawWeek === null || rawWeek === "" ? undefined : Number(rawWeek);
    const day =
      rawDay === undefined || rawDay === null || rawDay === "" ? undefined : Number(rawDay);
    const sessionDate =
      typeof body.sessionDate === "string" && body.sessionDate.trim()
        ? body.sessionDate.trim()
        : undefined;
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : undefined;

    if (
      (week !== undefined && !Number.isFinite(week)) ||
      (day !== undefined && !Number.isFinite(day))
    ) {
      return NextResponse.json(
        {
          error:
            locale === "ko"
              ? "week/day 값이 주어지면 숫자여야 합니다."
              : "week/day must be numeric when provided",
        },
        { status: 400 },
      );
    }

    const session = await generateAndSaveSession({
      userId,
      planId,
      week,
      day,
      sessionDate,
      timezone,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e, { extra: { detail: String(e) } });
  }
}

export const POST = withApiLogging(POSTImpl);
