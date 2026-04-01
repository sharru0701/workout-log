import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Vercel deployment: use VERCEL_GIT_COMMIT_SHA, fallback to NEXT_PUBLIC_APP_VERSION or dev
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
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
  // production 빌드(Turbopack)에서만 React Compiler 활성화.
  // dev + Turbopack에서는 HMR 그래프 오류가 간헐적으로 발생할 수 있어 비활성화.
  reactCompiler: process.env.NODE_ENV === "production",
};

export default nextConfig;
