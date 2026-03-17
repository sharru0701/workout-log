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
 * Saves a workout record draft.
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

  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.put(STORE_NAME, data);
      return;
    } catch (error) {
      console.error("IndexedDB draft save failed, falling back to localStorage.", error);
    }
  }

  // Fallback to localStorage
  try {
    localStorage.setItem(getLocalStorageKey(key), JSON.stringify(data));
  } catch (error) {
    console.error("localStorage draft save failed.", error);
  }
}

/**
 * Loads a workout record draft.
 */
export async function loadWorkoutDraft(key: string): Promise<WorkoutDraftData | null> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      const data = await db.get(STORE_NAME, key);
      if (data) return data;
    } catch (error) {
      console.error("IndexedDB draft load failed, falling back to localStorage.", error);
    }
  }

  // Fallback to localStorage
  try {
    const dataJSON = localStorage.getItem(getLocalStorageKey(key));
    if (dataJSON) {
      return JSON.parse(dataJSON) as WorkoutDraftData;
    }
  } catch (error) {
    console.error("localStorage draft load failed.", error);
  }

  return null;
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
