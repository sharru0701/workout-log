import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

declare global {
  var __dbPool: Pool | undefined;
}

// PERF: 개발/프로덕션 모두 전역에 풀을 저장해 서버리스 컨테이너 재사용 시 재연결 방지.
// 서버리스(Vercel) 환경에서 컨테이너가 warm이면 기존 풀을 그대로 씀 → 콜드 스타트 연결 비용 절감.
// max: 2 — 서버리스 함수 인스턴스당 동시 연결이 많지 않으므로 작게 설정해 DB 측 max_connections 보호.
const pool =
  global.__dbPool ??
  new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

global.__dbPool = pool;

export const db = drizzle(pool);
