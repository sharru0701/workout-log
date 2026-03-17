"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { loadSession, saveSession, clearSession } from "@/lib/storage/workoutSession";
import useWorkoutStore from "@/store/workoutStore";

// Session is considered expired after 6 hours of inactivity
const SESSION_EXPIRATION_MS = 6 * 60 * 60 * 1000;

export function useWorkoutPersistence(sessionId: string) {
  const { restoreSession, _getSessionForSaving, setRestoring } = useWorkoutStore(s => s.actions);
  const [showRestoredToast, setShowRestoredToast] = useState(false);
  const isRestoringRef = useRef(false);

  // Function to force-save the current session state immediately.
  // This is critical for `pagehide` and `visibilitychange`.
  const forceSaveSession = useCallback(() => {
    const session = _getSessionForSaving();
    if (session) {
      // Use a synchronous save method if available, or a non-debounced async save.
      // navigator.sendBeacon could be an option here but let's stick to saveSession for now.
      saveSession(session);
      console.log("Workout session saved due to page lifecycle event.");
    }
  }, [_getSessionForSaving]);

  const attemptRestore = useCallback(async () => {
    if (isRestoringRef.current) return;
    isRestoringRef.current = true;

    console.log("Attempting to restore session...");
    const loaded = await loadSession(sessionId);

    if (loaded) {
      const isExpired = Date.now() - loaded.updatedAt > SESSION_EXPIRATION_MS;
      if (isExpired) {
        console.log("Found expired session, clearing it.");
        await clearSession(sessionId);
      } else {
        console.log("Found valid session, restoring.");
        restoreSession(loaded);
        setShowRestoredToast(true);
      }
    } else {
        console.log("No session found to restore.");
    }

    // Set restoring to false, even if nothing was loaded
    setRestoring(false);
    isRestoringRef.current = false;
  }, [sessionId, restoreSession, setRestoring]);

  // Effect for initial load
  useEffect(() => {
    attemptRestore();
  }, [attemptRestore]);

  // Effect for lifecycle events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        forceSaveSession();
      }
    };

    const handlePageHide = () => {
      forceSaveSession();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
        // According to the prompt, restore regardless of bfcache status
        console.log(`Page shown (persisted: ${event.persisted}). Re-evaluating session.`);
        attemptRestore();
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [forceSaveSession, attemptRestore]);

  return { showRestoredToast, setShowRestoredToast };
}
