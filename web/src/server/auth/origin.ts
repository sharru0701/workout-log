import { NextResponse } from "next/server";

/**
 * CSRF 방어 — 동일 출처 요청만 허용.
 *
 * SameSite=lax cookie + Origin/Referer 헤더 검증의 조합.
 * 같은 출처(Origin === request host)이거나 Origin이 비어있는 경우(직접 호출)만 허용.
 *
 * 모든 mutating endpoint(POST/PUT/PATCH/DELETE)에서 호출해야 안전하지만,
 * 우선 인증 라우트에만 적용. 추후 모든 mutating 엔드포인트로 확장 가능.
 */
export function assertSameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  // Origin이 없으면 server-to-server 또는 native client. 통과.
  if (!origin) return null;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json(
      { error: "Invalid Origin header" },
      { status: 403 },
    );
  }

  const reqHost = req.headers.get("host") ?? new URL(req.url).host;
  if (originHost === reqHost) return null;

  // 환경변수로 추가 허용 origin 지정 가능 (로컬 다중 포트 등)
  const allowed = (process.env.WORKOUT_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length > 0) {
    for (const a of allowed) {
      try {
        if (new URL(a).host === originHost) return null;
      } catch {
        // ignore malformed
      }
    }
  }

  return NextResponse.json(
    { error: "Origin not allowed" },
    { status: 403 },
  );
}
