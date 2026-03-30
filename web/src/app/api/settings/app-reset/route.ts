import { NextResponse } from "next/server";
import { withApiLogging } from "@/server/observability/apiRoute";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { runSeed } from "@/server/db/seed";
import { resolveRequestLocale } from "@/lib/i18n/messages";

type ResetRequestBody = {
  confirmToken?: unknown;
};

async function POSTImpl(req: Request) {
  const locale = await resolveRequestLocale();
  const userId = getAuthenticatedUserId();
  const body = (await req.json().catch(() => ({}))) as ResetRequestBody;

  if (body.confirmToken !== "RESET_APP_DATA") {
    return NextResponse.json(
      { error: locale === "ko" ? "잘못된 초기화 요청입니다." : "Invalid reset request." },
      { status: 400 },
    );
  }

  const result = await runSeed({
    shouldHardReset: true,
    includeDemoPlans: false,
  });

  return NextResponse.json({
    ok: true,
    summary: {
      triggeredBy: userId,
      baseTemplateCount: result.baseTemplateCount,
      baseExerciseCount: result.baseExerciseCount,
      includeDemoPlans: result.includeDemoPlans,
    },
  });
}

export const POST = withApiLogging(POSTImpl);
