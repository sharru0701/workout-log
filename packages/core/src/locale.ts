// 요청 컨텍스트 무지 locale 타입/헬퍼. core 서비스는 locale을 항상 명시 인자로 받는다 —
// 해석(쿠키/Accept-Language)은 호출자(web resolveRequestLocale, apps/api resolveLocale)의 몫.
export type AppLocale = "ko" | "en";

export function coerceAppLocale(value: unknown): AppLocale {
  return String(value ?? "").trim().toLowerCase().startsWith("en") ? "en" : "ko";
}
