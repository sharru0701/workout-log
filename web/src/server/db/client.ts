import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

declare global {
  var __dbPool: Pool | undefined;
}

// PERF: 개발/프로덕션 모두 전역에 풀을 저장해 서버리스 컨테이너 재사용 시 재연결 방지.
// 서버리스(Vercel) 환경에서 컨테이너가 warm이면 기존 풀을 그대로 씀 → 콜드 스타트 연결 비용 절감.
// max: 5 — Promise.all() 패턴에서 최대 4개의 병렬 쿼리가 실행됨 (home-service 기준).
//          5로 설정해 병렬 쿼리가 큐 대기 없이 즉시 실행되도록 함.
//          Vercel 서버리스 인스턴스당 최대 연결 수 관리 적합.
// keepAlive: true — TCP 연결 재사용으로 reconnect 오버헤드 제거 (특히 cold start 후 첫 쿼리)
const pool =
  global.__dbPool ??
  new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

global.__dbPool = pool;

export const db = drizzle(pool);
