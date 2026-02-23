export type WorkoutLogRequest = {
  planId: string;
  generatedSessionId: string | null;
  notes: string;
  sets: Array<Record<string, unknown>>;
};

type PendingWorkoutLog = {
  localId: string;
  payload: WorkoutLogRequest;
  payloadHash?: string;
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
const DEDUPE_WINDOW_MS = 20000;
let syncTask: Promise<SyncResult> | null = null;

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

function payloadHash(payload: WorkoutLogRequest) {
  try {
    return JSON.stringify(payload);
  } catch {
    return `${payload.planId}:${payload.generatedSessionId ?? "none"}:${payload.notes}`;
  }
}

export function getPendingWorkoutLogs(): PendingWorkoutLog[] {
  return readQueue();
}

export function getPendingWorkoutLogCount() {
  return readQueue().length;
}

export function enqueueWorkoutLog(payload: WorkoutLogRequest) {
  const hash = payloadHash(payload);
  const queue = readQueue();
  const nowMs = Date.now();
  const duplicate = queue.find((item) => {
    if (!item?.payload) return false;
    const itemHash = item.payloadHash ?? payloadHash(item.payload);
    const ageMs = Number.isFinite(Date.parse(item.queuedAt)) ? nowMs - Date.parse(item.queuedAt) : Number.MAX_SAFE_INTEGER;
    return itemHash === hash && ageMs <= DEDUPE_WINDOW_MS;
  });
  if (duplicate) {
    return duplicate;
  }

  const next: PendingWorkoutLog = {
    localId: nextId(),
    payload,
    payloadHash: hash,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
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

async function runSyncPendingWorkoutLogs(
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

export async function syncPendingWorkoutLogs(
  sender: (payload: WorkoutLogRequest) => Promise<unknown>,
): Promise<SyncResult> {
  if (syncTask) return syncTask;
  syncTask = runSyncPendingWorkoutLogs(sender).finally(() => {
    syncTask = null;
  });
  return syncTask;
}

async function postWorkoutLogToApi(payload: WorkoutLogRequest) {
  const response = await fetch("/api/logs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? `POST /api/logs failed: ${response.status}`);
  }
  return data;
}

export async function syncPendingWorkoutLogsViaApi() {
  return syncPendingWorkoutLogs((payload) => postWorkoutLogToApi(payload));
}

export function offlineQueueUpdateEventName() {
  return UPDATE_EVENT;
}
