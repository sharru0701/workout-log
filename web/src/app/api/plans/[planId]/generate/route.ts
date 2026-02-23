import { NextResponse } from "next/server";
import { generateAndSaveSession } from "@/server/program-engine/generateSession";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { getAuthenticatedUserId } from "@/server/auth/user";

type Ctx = { params: Promise<{ planId: string }> };

async function POSTImpl(req: Request, ctx: Ctx) {
  try {
    const { planId } = await ctx.params;

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
        { error: "week/day must be numeric when provided" },
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
    return NextResponse.json(
      { error: e?.message ?? "Unknown error", detail: String(e) },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging(POSTImpl);
