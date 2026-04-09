/**
 * 서버 전용 i18n 유틸리티
 * 이 파일은 서버 컴포넌트/Route Handler에서만 import해야 함.
 * next/headers를 동적으로 import해 클라이언트 번들 오염 방지.
 */
import { cache } from "react";
import { LOCALE_COOKIE_NAME, coerceAppLocale, parseAcceptLanguage } from "./messages";
import type { AppLocale } from "./messages";

// PERF: cache()로 래핑 → 동일 요청 내 여러 RSC/API Route에서 호출해도 쿠키+헤더를 한 번만 읽음.
// React.cache()는 요청 단위 메모이제이션 (전역 캐시 아님, SSR 요청 간 공유되지 않음).
export const resolveRequestLocale = cache(async (): Promise<AppLocale> => {
  const { cookies, headers } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale) {
    return coerceAppLocale(cookieLocale);
  }

  const requestHeaders = await headers();
  return parseAcceptLanguage(requestHeaders.get("accept-language"));
});
