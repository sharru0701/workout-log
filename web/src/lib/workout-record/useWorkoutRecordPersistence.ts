"use client";

import { useEffect, useCallback, useRef } from "react";
import { saveWorkoutDraft, loadWorkoutDraft, type WorkoutDraftData } from "@/lib/storage/workoutDraftStore";
import type { WorkoutRecordDraft } from "@/lib/workout-record/model";
import type { WorkoutProgramExerciseEntryStateMap } from "@/lib/workout-record/entry-state";
import { debounce } from "@/lib/storage/workoutSession";

const DRAFT_EXPIRATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export function useWorkoutRecordPersistence(
  key: string | null,
  draft: WorkoutRecordDraft | null,
  programEntryState: WorkoutProgramExerciseEntryStateMap,
  onRestore: (data: WorkoutDraftData) => void
) {
  const isRestoringRef = useRef(false);
  const lastSavedKeyRef = useRef<string | null>(null);

  const forceSave = useCallback(() => {
    if (!key || !draft) return;
    saveWorkoutDraft(key, draft, programEntryState);
    console.log(`[Persistence] Draft saved for key: ${key}`);
  }, [key, draft, programEntryState]);

  const debouncedSave = useRef(
    debounce((k: string, d: WorkoutRecordDraft, p: WorkoutProgramExerciseEntryStateMap) => {
      saveWorkoutDraft(k, d, p);
      console.log(`[Persistence] Debounced draft saved for key: ${k}`);
    }, 1000)
  ).current;

  // Auto-save on change
  useEffect(() => {
    if (!key || !draft || isRestoringRef.current) return;
    debouncedSave(key, draft, programEntryState);
  }, [key, draft, programEntryState, debouncedSave]);

  // Lifecycle events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        forceSave();
      }
    };

    const handlePageHide = () => {
      forceSave();
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [forceSave]);

  // Restoration attempt
  const attemptRestore = useCallback(async (targetKey: string) => {
    if (isRestoringRef.current || lastSavedKeyRef.current === targetKey) return;
    isRestoringRef.current = true;

    try {
      const loaded = await loadWorkoutDraft(targetKey);
      if (loaded) {
        const isExpired = Date.now() - loaded.updatedAt > DRAFT_EXPIRATION_MS;
        if (!isExpired) {
          onRestore(loaded);
          lastSavedKeyRef.current = targetKey;
        }
      }
    } catch (e) {
      console.error("[Persistence] Restoration failed", e);
    } finally {
      isRestoringRef.current = false;
    }
  }, [onRestore]);

  useEffect(() => {
    if (key) {
      attemptRestore(key);
    }
  }, [key, attemptRestore]);

  return { forceSave };
}
