import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Vercel deployment: use VERCEL_GIT_COMMIT_SHA, fallback to NEXT_PUBLIC_APP_VERSION or dev
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
  },
  // PERF: 대용량 패키지의 named import를 자동으로 tree-shake → 번들 크기 감소
  // drizzle-orm만 유지 (date-fns, lucide-react는 실제 의존성에 없음)
  experimental: {
    optimizePackageImports: ["drizzle-orm"],
  },
  // Vercel 환경에서는 output: "standalone"을 사용하지 않으므로 제거 또는 주석 처리
  // output: "standalone",
  outputFileTracingIncludes: {
    "/api/health": [
      "./scripts/migrate.mjs",
      "./scripts/seed-if-needed.mjs",
      "./src/server/db/migrations/*",
      "./node_modules/drizzle-orm/**/*",
      "./node_modules/pg/**/*",
    ],
  },
  // 서버 응답 gzip/brotli 압축 활성화 (Next.js 기본값이지만 명시)
  compress: true,
  // next/image 최적화: AVIF 우선, WebP 폴백 → 동일 품질에서 20-50% 용량 절감
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // production 빌드(Turbopack)에서만 React Compiler 활성화.
  // dev + Turbopack에서는 HMR 그래프 오류가 간헐적으로 발생할 수 있어 비활성화.
  reactCompiler: process.env.NODE_ENV === "production",
  async headers() {
    return [
      // 정적 자산 장기 캐싱 — Next.js는 /_next/static/** 파일에 content-hash를 포함하므로
      // max-age=1년으로 설정해도 배포 후 새 파일 URL로 버스팅됨
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // PWA 아이콘 / manifest 중간 캐싱
      {
        source: "/(icons|manifest.json|sw.js)(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
