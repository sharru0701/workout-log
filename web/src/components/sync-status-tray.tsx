"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPendingWorkoutLogCount,
  offlineQueueUpdateEventName,
  syncPendingWorkoutLogsViaApi,
} from "@/lib/offlineLogQueue";

export function SyncStatusTray() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const syncInFlight = useRef(false);
  const noticeTimerId = useRef<number | null>(null);

  const refreshPendingCount = useCallback(() => {
    if (typeof window === "undefined") return;
    setPendingCount(getPendingWorkoutLogCount());
  }, []);

  const setTransientNotice = useCallback((next: string | null) => {
    if (typeof window === "undefined") return;
    if (noticeTimerId.current !== null) {
      window.clearTimeout(noticeTimerId.current);
      noticeTimerId.current = null;
    }
    setNotice(next);
    if (!next) return;
    noticeTimerId.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerId.current = null;
    }, 2600);
  }, []);

  const syncPending = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) return;
    if (syncInFlight.current) return;

    if (getPendingWorkoutLogCount() === 0) {
      setPendingCount(0);
      return;
    }

    syncInFlight.current = true;
    setIsSyncing(true);
    try {
      const result = await syncPendingWorkoutLogsViaApi();
      setPendingCount(result.remaining);
      if (result.synced > 0) {
        setTransientNotice(`Synced ${result.synced} log${result.synced > 1 ? "s" : ""}`);
      } else if (result.remaining > 0) {
        setTransientNotice(`${result.remaining} pending`);
      }
    } finally {
      syncInFlight.current = false;
      setIsSyncing(false);
    }
  }, [setTransientNotice]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      refreshPendingCount();
      void syncPending();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setTransientNotice("Offline mode");
      refreshPendingCount();
    };

    const handleStorage = () => {
      refreshPendingCount();
    };

    const handleQueueUpdate = () => {
      refreshPendingCount();
    };

    const handleFocus = () => {
      refreshPendingCount();
      if (navigator.onLine && getPendingWorkoutLogCount() > 0) {
        void syncPending();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      handleFocus();
    };

    setIsOnline(navigator.onLine);
    refreshPendingCount();
    if (navigator.onLine && getPendingWorkoutLogCount() > 0) {
      void syncPending();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    window.addEventListener(offlineQueueUpdateEventName(), handleQueueUpdate);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(offlineQueueUpdateEventName(), handleQueueUpdate);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (noticeTimerId.current !== null) {
        window.clearTimeout(noticeTimerId.current);
      }
    };
  }, [refreshPendingCount, setTransientNotice, syncPending]);

  if (isOnline && pendingCount === 0 && !isSyncing && !notice) {
    return null;
  }

  return (
    <div className="app-sync-tray" aria-live="polite">
      <div className={`app-sync-dot ${isOnline ? "is-online" : "is-offline"}`} aria-hidden="true" />
      <span className="app-sync-text">
        {!isOnline
          ? `Offline mode${pendingCount > 0 ? ` · ${pendingCount} queued` : ""}`
          : isSyncing
            ? "Syncing queued logs..."
            : pendingCount > 0
              ? `${pendingCount} queued`
              : notice ?? "Synced"}
      </span>
      {isOnline && pendingCount > 0 && (
        <button type="button" className="app-sync-action" onClick={() => void syncPending()} disabled={isSyncing}>
          Sync now
        </button>
      )}
    </div>
  );
}
