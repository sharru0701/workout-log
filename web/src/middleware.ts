import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "wl_session";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/sw.js",
  "/manifest",
  "/api/health",
  "/api/ops",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // dev fallback: WORKOUT_AUTH_USER_ID 가 셋팅되어 있으면 미들웨어 통과
  if ((process.env.WORKOUT_AUTH_USER_ID ?? "").trim()) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) return NextResponse.next();

  // 인증 안 됨 — API는 401, 페이지는 /login redirect
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // 정적 자원 / Next 내부 / public assets 제외
    "/((?!_next/static|_next/image|favicon.ico|fonts|images|sw.js|manifest).*)",
  ],
};
