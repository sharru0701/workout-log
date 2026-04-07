"use client";

import type { WorkoutSession } from "@/lib/workout/session.types";

/**
 * Workout Session Storage Module
 * PERF: Uses a Web Worker to offload IndexedDB operations from the main thread.
 * Falls back to localStorage if Workers or IndexedDB are unavailable.
 */

let worker: Worker | null = null;
const pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

if (typeof window !== "undefined" && window.Worker) {
  worker = new Worker(new URL("./storage.worker.ts", import.meta.url));
  worker.onmessage = (event) => {
    const { id, result, success, error } = event.data;
    const pending = pendingRequests.get(id);
    if (pending) {
      if (success) pending.resolve(result);
      else pending.reject(new Error(error));
      pendingRequests.delete(id);
    }
  };
}

function callWorker(type: string, payload: any): Promise<any> {
  if (!worker) return Promise.reject(new Error("Worker not available"));
  const id = Math.random().toString(36).substring(7);
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker!.postMessage({ type, payload, id });
  });
}

const getLocalStorageKey = (sessionId: string) => `workout-session-${sessionId}`;

/**
 * Saves a workout session. Prefers Web Worker (IndexedDB), falls back to localStorage.
 */
export async function saveSession(session: WorkoutSession): Promise<void> {
  const sessionToSave = { ...session, updatedAt: Date.now() };

  if (worker) {
    try {
      await callWorker("save", sessionToSave);
      return;
    } catch (error) {
      console.error("Worker save failed, falling back to localStorage.", error);
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
 * Loads a workout session. Checks Web Worker (IndexedDB) first, then localStorage.
 */
export async function loadSession(sessionId: string): Promise<WorkoutSession | null> {
  if (worker) {
    try {
      const session = await callWorker("load", { sessionId });
      if (session) return session;
    } catch (error) {
      console.error("Worker load failed, falling back to localStorage.", error);
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
 */
export async function clearSession(sessionId: string): Promise<void> {
  if (worker) {
    try {
      await callWorker("clear", { sessionId });
    } catch (error) {
      console.error("Worker delete failed.", error);
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
 */
export function debounce<F extends (...args: any[]) => any>(
  func: F,
  delay: number
): ((...args: Parameters<F>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const fn = (...args: Parameters<F>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => { func(...args); }, delay);
  };
  fn.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };
  return fn;
}
