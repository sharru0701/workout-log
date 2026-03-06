import { NextResponse } from "next/server";
import { withApiLogging } from "@/server/observability/apiRoute";
import { getAuthenticatedUserId } from "@/server/auth/user";
import { runSeed } from "@/server/db/seed";

type ResetRequestBody = {
  confirmToken?: unknown;
};

async function POSTImpl(req: Request) {
  const userId = getAuthenticatedUserId();
  const body = (await req.json().catch(() => ({}))) as ResetRequestBody;

  if (body.confirmToken !== "RESET_APP_DATA") {
    return NextResponse.json({ error: "잘못된 초기화 요청입니다." }, { status: 400 });
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
