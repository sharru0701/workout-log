import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD;

  // 1. 환경변수가 설정되지 않은 경우 (로컬 개발 환경 등) 무사과 패스
  if (!basicAuthUser || !basicAuthPassword) {
    return NextResponse.next();
  }

  // 2. Authorization 헤더 확인 (Basic Auth)
  const basicAuth = req.headers.get("authorization");

  if (basicAuth) {
    const authValue = basicAuth.split(" ")[1];
    if (authValue) {
      // Base64 디코딩하여 user:password 추출
      // Next.js Edge 런타임에서는 atob() 전역 함수 지원
      const [user, pwd] = atob(authValue).split(":");

      // 3. 자격 증명이 일치하면 요청 허용
      if (user === basicAuthUser && pwd === basicAuthPassword) {
        return NextResponse.next();
      }
    }
  }

  // 4. 자격 증명이 없거나 틀린 경우 401 프롬프트 응답 반환
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Secure Area"',
    },
  });
}

// 다음 리소스들을 제외한 "모든" 요청(API, 페이지 등)에 미들웨어 적용
export const config = {
  matcher: [
    // _next/static, _next/image, 로고, PWA manifest, 서비스 워커 우회
    // 이 파일들은 비밀번호 없이도 다운로드 가능해야 앱 아이콘/오프라인 캐싱이 고장나지 않음
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-|icons/).*)",
  ],
};
