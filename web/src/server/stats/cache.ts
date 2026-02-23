import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { statsCache } from "@/server/db/schema";

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((v) => stableSerialize(v)).join(",")}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashParams(params: Record<string, unknown>) {
  return createHash("sha256").update(stableSerialize(params)).digest("hex");
}

export async function getStatsCache<T>(input: {
  userId: string;
  metric: string;
  params: Record<string, unknown>;
  maxAgeSeconds?: number;
}): Promise<T | null> {
  const paramsHash = hashParams(input.params);
  const rows = await db
    .select({
      payload: statsCache.payload,
      updatedAt: statsCache.updatedAt,
    })
    .from(statsCache)
    .where(
      and(
        eq(statsCache.userId, input.userId),
        eq(statsCache.metric, input.metric),
        eq(statsCache.paramsHash, paramsHash),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (input.maxAgeSeconds && input.maxAgeSeconds > 0) {
    const minUpdatedAt = Date.now() - input.maxAgeSeconds * 1000;
    if (new Date(row.updatedAt).getTime() < minUpdatedAt) return null;
  }

  return row.payload as T;
}

export async function setStatsCache<T>(input: {
  userId: string;
  metric: string;
  params: Record<string, unknown>;
  payload: T;
}) {
  const paramsHash = hashParams(input.params);
  await db
    .insert(statsCache)
    .values({
      userId: input.userId,
      metric: input.metric,
      paramsHash,
      payload: input.payload as object,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [statsCache.userId, statsCache.metric, statsCache.paramsHash],
      set: {
        payload: input.payload as object,
        updatedAt: new Date(),
      },
    });
}

export async function invalidateStatsCacheForUser(userId: string, tx?: any) {
  const executor = tx ?? db;
  await executor.delete(statsCache).where(eq(statsCache.userId, userId));
}
