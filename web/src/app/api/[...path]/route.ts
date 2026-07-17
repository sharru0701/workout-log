import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@workout/core/auth/session";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/locale-cookie";

// Catch-all proxy: forwards web /api/* to the standalone apps/api (Hono) backend.
// The browser keeps calling same-origin /api/* (httpOnly wl_session cookie sent
// automatically); this server-side handler reads that cookie and re-issues the
// request to APPS_API_BASE with `Authorization: Bearer <token>` — the web cookie
// value and the apps/api session token are the SAME auth_session row, so no
// exchange is needed. Concrete route.ts files always win over this catch-all
// (Next.js: static > dynamic > catch-all), so auth/ops/unported routes stay in
// web; only deleted data routes fall through here.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Hop-by-hop + connection-specific request headers that must not be forwarded.
const STRIP_REQUEST_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "cookie",
]);

// undici has already decoded the upstream body, so forwarding the original
// encoding/length headers would corrupt it.
const STRIP_RESPONSE_HEADERS = ["content-encoding", "content-length", "transfer-encoding", "connection"];

const UPSTREAM_TIMEOUT_MS = 55_000;

async function handler(req: Request): Promise<Response> {
  const base = process.env.APPS_API_BASE;
  if (!base) {
    // Fail loud so a missing dev/preview env var is obvious, not a silent 404.
    return Response.json({ error: "APPS_API_BASE is not configured" }, { status: 500 });
  }

  // No basePath/rewrite in this app, so pathname is already exactly /api/...,
  // which is what apps/api mounts. Forward verbatim (encoding-safe).
  const url = new URL(req.url);
  const target = base.replace(/\/$/, "") + url.pathname + url.search;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);
  // 브라우저 OS 언어가 아니라 앱에서 고른 언어가 서버 조립 피드백·오류 문구의
  // 기준이다. cutover 프록시가 이 값을 덮지 않으면 한국어 UI 안에 영어 API 카피가 섞인다.
  const appLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (appLocale === "ko" || appLocale === "en") {
    headers.set("accept-language", appLocale);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const isUxTelemetry =
    url.pathname === "/api/ux-events" || url.pathname === "/api/ux-events/public";

  // `duplex: "half"` is required to stream a request body via undici (large
  // export/import without buffering); it isn't in the DOM RequestInit type yet.
  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  };
  if (hasBody) {
    if (isUxTelemetry) {
      try {
        // pagehide keepalive 요청을 상류 스트림과 직접 결합하면 탭 종료 시 중간 abort가
        // apps/api의 본문 파서를 5xx로 만들 수 있다. 작은 텔레메트리만 먼저 버퍼링한다.
        init.body = await req.arrayBuffer();
      } catch {
        // 선택적 텔레메트리는 다음 동기화 때 재시도된다. 사용자 화면에는 오류를 남기지 않는다.
        return new Response(null, { status: 204 });
      }
    } else {
      init.body = req.body;
      init.duplex = "half";
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const name = (err as Error | undefined)?.name;
    const timedOut = name === "AbortError" || name === "TimeoutError";
    return Response.json(
      { error: timedOut ? "Upstream timed out" : "Upstream unavailable" },
      { status: timedOut ? 504 : 502 },
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const h of STRIP_RESPONSE_HEADERS) responseHeaders.delete(h);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
  handler as OPTIONS,
};
