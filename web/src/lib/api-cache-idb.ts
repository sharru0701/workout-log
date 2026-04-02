"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "wl-api-cache";
const STORE_NAME = "entries";
const DB_VERSION = 1;

// 이 시간보다 오래된 IDB 엔트리는 웜업 시 무시
const MAX_IDB_ENTRY_AGE_MS = 24 * 60 * 60 * 1000; // 24h

interface IdbCacheEntry {
  key: string;
  data: unknown;
  updatedAt: number;
  lastAccessedAt: number;
}

interface ApiCacheSchema extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: IdbCacheEntry;
    indexes: { by_last_accessed: number };
  };
}

let dbPromise: Promise<IDBPDatabase<ApiCacheSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<ApiCacheSchema>> | null {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  if (!dbPromise) {
    dbPromise = openDB<ApiCacheSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("by_last_accessed", "lastAccessedAt");
      },
    });
  }
  return dbPromise;
}

/** 단일 캐시 엔트리를 IDB에 저장. 실패해도 무시. */
export async function idbWriteEntry(
  key: string,
  data: unknown,
  updatedAt: number,
  lastAccessedAt: number,
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put(STORE_NAME, { key, data, updatedAt, lastAccessedAt });
}

/**
 * 캐시 엔트리 삭제.
 * - prefix 없으면 전체 삭제
 * - prefix 있으면 해당 prefix로 시작하는 엔트리만 삭제
 */
export async function idbDeleteEntries(prefix?: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  if (!prefix) {
    await db.clear(STORE_NAME);
    return;
  }
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  let cursor = await store.openCursor();
  while (cursor) {
    if ((cursor.key as string).startsWith(prefix)) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * 웜업용: MAX_IDB_ENTRY_AGE_MS 이내의 유효 엔트리 전체 반환.
 * 만료된 엔트리는 이 시점에 함께 정리.
 */
export async function idbLoadAllEntries(): Promise<IdbCacheEntry[]> {
  const db = await getDB();
  if (!db) return [];

  const cutoff = Date.now() - MAX_IDB_ENTRY_AGE_MS;
  const all = await db.getAll(STORE_NAME);

  const valid: IdbCacheEntry[] = [];
  const tx = db.transaction(STORE_NAME, "readwrite");
  for (const entry of all) {
    if (entry.updatedAt < cutoff) {
      void tx.objectStore(STORE_NAME).delete(entry.key);
    } else {
      valid.push(entry);
    }
  }
  await tx.done;

  return valid;
}
