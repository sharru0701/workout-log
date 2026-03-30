import { NextResponse } from "next/server";
import { resolveRequestLocale } from "@/lib/i18n/messages";

type ApiErrorResponseInit = {
  status?: number;
  fallback?: {
    ko: string;
    en: string;
  };
  extra?: Record<string, unknown>;
};

export async function apiErrorResponse(error: unknown, init?: ApiErrorResponseInit) {
  const locale = await resolveRequestLocale();
  const fallbackMessage =
    locale === "ko"
      ? (init?.fallback?.ko ?? "알 수 없는 오류가 발생했습니다.")
      : (init?.fallback?.en ?? "An unknown error occurred.");

  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : fallbackMessage,
      ...(init?.extra ?? {}),
    },
    { status: init?.status ?? 500 },
  );
}
