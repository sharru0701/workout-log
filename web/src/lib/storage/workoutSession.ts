"use client";

import { openDB, DBSchema } from "idb";
import type { WorkoutSession } from "@/lib/workout/session.types";

const DB_NAME = "workout-log-db";
const STORE_NAME = "workout-sessions";
const DB_VERSION = 1;

interface WorkoutDB extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: WorkoutSession;
  };
}

const isIndexedDBSupported = () => typeof window !== "undefined" && "indexedDB" in window;

const dbPromise = isIndexedDBSupported()
  ? openDB<WorkoutDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
        }
      },
    })
  : null;

const getLocalStorageKey = (sessionId: string) => `workout-session-${sessionId}`;

/**
 * Saves a workout session. Prefers IndexedDB, falls back to localStorage.
 * @param session The workout session to save.
 */
export async function saveSession(session: WorkoutSession): Promise<void> {
  // Ensure updatedAt is always current on save
  const sessionToSave = { ...session, updatedAt: Date.now() };

  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.put(STORE_NAME, sessionToSave);
      return;
    } catch (error) {
      console.error("IndexedDB save failed, falling back to localStorage.", error);
    }
  }

  // Fallback to localStorage
  try {
    localStorage.setItem(getLocalStorageKey(session.sessionId), JSON.stringify(sessionToSave));
  } catch (error) {
    console.error("localStorage save failed.", error);
  }
}

/**
 * Loads a workout session. Checks IndexedDB first, then localStorage.
 * @param sessionId The ID of the session to load.
 * @returns The workout session, or null if not found.
 */
export async function loadSession(sessionId: string): Promise<WorkoutSession | null> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      const session = await db.get(STORE_NAME, sessionId);
      if (session) return session;
    } catch (error) {
      console.error("IndexedDB load failed, falling back to localStorage.", error);
    }
  }

  // Fallback to localStorage
  try {
    const sessionJSON = localStorage.getItem(getLocalStorageKey(sessionId));
    if (sessionJSON) {
      return JSON.parse(sessionJSON) as WorkoutSession;
    }
  } catch (error) {
    console.error("localStorage load failed.", error);
  }

  return null;
}

/**
 * Clears a workout session from all storage.
 * @param sessionId The ID of the session to clear.
 */
export async function clearSession(sessionId: string): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.delete(STORE_NAME, sessionId);
    } catch (error) {
      console.error("IndexedDB delete failed.", error);
    }
  }

  // Also clear from localStorage
  try {
    localStorage.removeItem(getLocalStorageKey(sessionId));
  } catch (error) {
    console.error("localStorage delete failed.", error);
  }
}

/**
 * A simple debounce utility.
 * @param func The function to debounce.
 * @param delay The debounce delay in ms.
 */
export function debounce<F extends (...args: any[]) => any>(func: F, delay: number): (...args: Parameters<F>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}
