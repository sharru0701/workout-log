export type WorkoutLogRequest = {
  planId: string;
  generatedSessionId: string | null;
  notes: string;
  sets: Array<Record<string, unknown>>;
};

type PendingWorkoutLog = {
  localId: string;
  payload: WorkoutLogRequest;
  queuedAt: string;
  attempts: number;
  lastError?: string;
};

type SyncResult = {
  synced: number;
  failed: number;
  remaining: number;
  lastSyncedLogId: string | null;
};

const STORAGE_KEY = "workout-log.pending-logs.v1";
const UPDATE_EVENT = "offline-log-queue-update";

function isBrowser() {
  return typeof window !== "undefined";
}

function fallbackId() {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nextId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return fallbackId();
}

function readQueue(): PendingWorkoutLog[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.localId === "string" &&
        typeof item.queuedAt === "string" &&
        typeof item.attempts === "number" &&
        item.payload &&
        typeof item.payload === "object",
    ) as PendingWorkoutLog[];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingWorkoutLog[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

export function getPendingWorkoutLogs(): PendingWorkoutLog[] {
  return readQueue();
}

export function getPendingWorkoutLogCount() {
  return readQueue().length;
}

export function enqueueWorkoutLog(payload: WorkoutLogRequest) {
  const next: PendingWorkoutLog = {
    localId: nextId(),
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  const queue = readQueue();
  queue.push(next);
  writeQueue(queue);
  return next;
}

export function isLikelyNetworkError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  const msg = text.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("fetch")
  );
}

function extractLogId(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const maybeObj = response as Record<string, unknown>;
  if (typeof maybeObj.id === "string") return maybeObj.id;
  const nested = maybeObj.log;
  if (nested && typeof nested === "object" && typeof (nested as Record<string, unknown>).id === "string") {
    return (nested as Record<string, string>).id;
  }
  return null;
}

export async function syncPendingWorkoutLogs(
  sender: (payload: WorkoutLogRequest) => Promise<unknown>,
): Promise<SyncResult> {
  let queue = readQueue();
  if (!queue.length) {
    return { synced: 0, failed: 0, remaining: 0, lastSyncedLogId: null };
  }

  let synced = 0;
  let failed = 0;
  let lastSyncedLogId: string | null = null;

  for (const entry of [...queue]) {
    try {
      const result = await sender(entry.payload);
      lastSyncedLogId = extractLogId(result) ?? lastSyncedLogId;
      synced += 1;
      queue = queue.filter((item) => item.localId !== entry.localId);
      writeQueue(queue);
    } catch (error) {
      failed += 1;
      queue = queue.map((item) =>
        item.localId === entry.localId
          ? {
              ...item,
              attempts: item.attempts + 1,
              lastError: error instanceof Error ? error.message : String(error),
            }
          : item,
      );
      writeQueue(queue);
      if (isLikelyNetworkError(error)) break;
    }
  }

  return {
    synced,
    failed,
    remaining: queue.length,
    lastSyncedLogId,
  };
}

export function offlineQueueUpdateEventName() {
  return UPDATE_EVENT;
}
