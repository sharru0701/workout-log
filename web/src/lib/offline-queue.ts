"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "wl-offline-queue";
const STORE_NAME = "pending-mutations";
const DB_VERSION = 1;

export type MutationMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export interface PendingMutation {
  id: string;
  method: MutationMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  enqueuedAt: number;
  invalidateCache: boolean;
  invalidateCachePrefixes?: string[];
}

interface QueueSchema extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: PendingMutation;
    indexes: { by_enqueued: number };
  };
}

let dbPromise: Promise<IDBPDatabase<QueueSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<QueueSchema>> | null {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  if (!dbPromise) {
    dbPromise = openDB<QueueSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("by_enqueued", "enqueuedAt");
      },
    });
  }
  return dbPromise;
}

/** Adds a mutation to the offline queue. No-ops if IndexedDB is unavailable. */
export async function enqueueMutation(
  mutation: Omit<PendingMutation, "id" | "enqueuedAt">,
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put(STORE_NAME, {
    ...mutation,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    enqueuedAt: Date.now(),
  });
}

/** Returns all pending mutations in FIFO order (oldest first). */
export async function getPendingMutations(): Promise<PendingMutation[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAllFromIndex(STORE_NAME, "by_enqueued");
}

export async function removeMutation(id: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.delete(STORE_NAME, id);
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  return db.count(STORE_NAME);
}
