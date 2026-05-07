import { NextResponse } from "next/server";
import { withApiLogging } from "@/server/observability/apiRoute";
import { logError } from "@/server/observability/logger";
import { requireAuthenticatedUserId } from "@/server/auth/user";
import { importUserData, type ImportMode } from "@/server/import/userImport";
import { invalidateStatsCacheForUser } from "@/server/stats/cache";
import { apiErrorResponse } from "@/app/api/_utils/error-response";
import { resolveRequestLocale } from "@/lib/i18n/messages";

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB

type ImportRequestBody = {
  mode?: unknown;
  confirmToken?: unknown;
  data?: unknown;
};

async function POSTImpl(req: Request) {
  const locale = await resolveRequestLocale();
  try {
    const userId = await requireAuthenticatedUserId();

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > 0 && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          error:
            locale === "ko"
              ? "import 본문이 너무 큽니다 (최대 10MB)."
              : "import body too large (max 10MB).",
        },
        { status: 413 },
      );
    }

    const body = (await req.json().catch(() => null)) as ImportRequestBody | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          error:
            locale === "ko"
              ? "잘못된 JSON 본문입니다."
              : "invalid JSON body.",
        },
        { status: 400 },
      );
    }

    const mode = body.mode as ImportMode | undefined;
    if (mode !== "dryRun" && mode !== "replace") {
      return NextResponse.json(
        {
          error:
            locale === "ko"
              ? "mode는 'dryRun' 또는 'replace' 여야 합니다."
              : "mode must be 'dryRun' or 'replace'.",
        },
        { status: 400 },
      );
    }

    if (mode === "replace" && body.confirmToken !== "REPLACE_USER_DATA") {
      return NextResponse.json(
        {
          error:
            locale === "ko"
              ? "replace 모드는 confirmToken='REPLACE_USER_DATA' 가 필요합니다."
              : "replace mode requires confirmToken='REPLACE_USER_DATA'.",
        },
        { status: 400 },
      );
    }

    const result = await importUserData(userId, body.data, mode).catch(
      (err: Error & { code?: string }) => {
        if (err.code === "INVALID_IMPORT_BODY") {
          return { __validationError: err.message } as const;
        }
        throw err;
      },
    );

    if ("__validationError" in result) {
      return NextResponse.json(
        {
          error:
            locale === "ko"
              ? `import 본문 검증 실패: ${result.__validationError}`
              : `import body validation failed: ${result.__validationError}`,
        },
        { status: 400 },
      );
    }

    if (result.applied) {
      await invalidateStatsCacheForUser(userId);
    }

    return NextResponse.json(result);
  } catch (e: any) {
    logError("api.handler_error", { error: e });
    return apiErrorResponse(e);
  }
}

export const POST = withApiLogging(POSTImpl);
