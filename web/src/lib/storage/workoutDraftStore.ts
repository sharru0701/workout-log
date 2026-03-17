"use client";

import { openDB, DBSchema } from "idb";
import type { WorkoutRecordDraft } from "@/lib/workout-record/model";
import type { WorkoutProgramExerciseEntryStateMap } from "@/lib/workout-record/entry-state";

const DB_NAME = "workout-draft-db";
const STORE_NAME = "workout-drafts";
const DB_VERSION = 1;

export type WorkoutDraftData = {
  key: string; // planId + date
  draft: WorkoutRecordDraft;
  programEntryState: WorkoutProgramExerciseEntryStateMap;
  updatedAt: number;
};

interface WorkoutDraftDB extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: WorkoutDraftData;
  };
}

const isIndexedDBSupported = () => typeof window !== "undefined" && "indexedDB" in window;

const dbPromise = isIndexedDBSupported()
  ? openDB<WorkoutDraftDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      },
    })
  : null;

const getLocalStorageKey = (key: string) => `workout-draft-${key}`;

/**
 * Helper to get DB with timeout
 */
async function getDBWithTimeout(timeoutMs = 150): Promise<any> {
  if (!dbPromise) return null;
  
  return Promise.race([
    dbPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("IndexedDB timeout")), timeoutMs))
  ]).catch(() => null);
}

/**
 * Saves a workout record draft.
 * Dual-writes to both IndexedDB and localStorage for Safari compatibility.
 */
export async function saveWorkoutDraft(
  key: string,
  draft: WorkoutRecordDraft,
  programEntryState: WorkoutProgramExerciseEntryStateMap
): Promise<void> {
  const data: WorkoutDraftData = {
    key,
    draft,
    programEntryState,
    updatedAt: Date.now(),
  };

  // 1. Always write to localStorage first (fast & reliable on Safari)
  try {
    localStorage.setItem(getLocalStorageKey(key), JSON.stringify(data));
  } catch (error) {
    console.error("localStorage draft save failed", error);
  }

  // 2. Then try IndexedDB
  const db = await getDBWithTimeout(200);
  if (db) {
    try {
      await db.put(STORE_NAME, data);
    } catch (error) {
      console.error("IndexedDB draft save failed", error);
    }
  }
}

/**
 * Loads a workout record draft.
 * Priorities: 
 * 1. Read from localStorage immediately.
 * 2. Try IndexedDB with short timeout.
 * 3. Compare updatedAt and return the latest one.
 */
export async function loadWorkoutDraft(key: string): Promise<WorkoutDraftData | null> {
  let localData: WorkoutDraftData | null = null;
  
  // 1. Immediate read from localStorage
  try {
    const dataJSON = localStorage.getItem(getLocalStorageKey(key));
    if (dataJSON) {
      localData = JSON.parse(dataJSON) as WorkoutDraftData;
    }
  } catch (error) {
    console.warn("localStorage draft load failed", error);
  }

  // 2. Try IndexedDB with timeout
  const db = await getDBWithTimeout(250);
  let idbData: WorkoutDraftData | null = null;
  if (db) {
    try {
      idbData = await db.get(STORE_NAME, key);
    } catch (error) {
      console.warn("IndexedDB draft load failed", error);
    }
  }

  // 3. Compare and return the latest
  if (localData && idbData) {
    return localData.updatedAt >= idbData.updatedAt ? localData : idbData;
  }
  
  return localData || idbData || null;
}

/**
 * Clears a workout record draft.
 */
export async function clearWorkoutDraft(key: string): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.delete(STORE_NAME, key);
    } catch (error) {
      console.error("IndexedDB draft delete failed.", error);
    }
  }

  // Also clear from localStorage
  try {
    localStorage.removeItem(getLocalStorageKey(key));
  } catch (error) {
    console.error("localStorage draft delete failed.", error);
  }
}
