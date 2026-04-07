import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { WorkoutSession } from "../workout/session.types";

const DB_NAME = "workout-log-db";
const STORE_NAME = "workout-sessions";
const DB_VERSION = 1;

interface WorkoutDB extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: WorkoutSession;
  };
}

let dbPromise: Promise<IDBPDatabase<WorkoutDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<WorkoutDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
        }
      },
    });
  }
  return dbPromise;
}

self.onmessage = async (event) => {
  const { type, payload, id } = event.data;

  try {
    const db = await getDB();
    let result;

    switch (type) {
      case "save":
        const sessionToSave = { ...payload, updatedAt: Date.now() };
        await db.put(STORE_NAME, sessionToSave);
        result = { success: true };
        break;
      case "load":
        result = await db.get(STORE_NAME, payload.sessionId);
        break;
      case "clear":
        await db.delete(STORE_NAME, payload.sessionId);
        result = { success: true };
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({ id, result, success: true });
  } catch (error) {
    self.postMessage({ id, error: String(error), success: false });
  }
};
