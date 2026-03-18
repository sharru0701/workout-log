"use client";

import { useEffect, useCallback, useRef } from "react";
import { saveWorkoutDraft, loadWorkoutDraft, saveWorkoutDraftSync, type WorkoutDraftData } from "@/lib/storage/workoutDraftStore";
import type { WorkoutRecordDraft } from "@/lib/workout-record/model";
import { hasWorkoutEdits } from "@/lib/workout-record/model";
import type { WorkoutProgramExerciseEntryStateMap } from "@/lib/workout-record/entry-state";
import { debounce } from "@/lib/storage/workoutSession";

const DRAFT_EXPIRATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export function useWorkoutRecordPersistence(
  key: string | null,
  draft: WorkoutRecordDraft | null,
  programEntryState: WorkoutProgramExerciseEntryStateMap,
  onRestore: (data: WorkoutDraftData) => void,
  options: { enabled?: boolean } = { enabled: true }
) {
  const isRestoringRef = useRef(false);
  const lastSavedKeyRef = useRef<string | null>(null);

  // Refs to keep values stable in event listeners
  const keyRef = useRef(key);
  const draftRef = useRef(draft);
  const entryStateRef = useRef(programEntryState);
  const enabledRef = useRef(options.enabled);

  useEffect(() => {
    keyRef.current = key;
    draftRef.current = draft;
    entryStateRef.current = programEntryState;
    enabledRef.current = options.enabled;
  }, [key, draft, programEntryState, options.enabled]);

  const forceSave = useCallback(() => {
    if (!keyRef.current || !draftRef.current || !enabledRef.current) return;
    saveWorkoutDraft(keyRef.current, draftRef.current, entryStateRef.current);
    console.log(`[Persistence] Draft saved for key: ${keyRef.current}`);
  }, []);

  const forceSaveSync = useCallback(() => {
    if (!keyRef.current || !draftRef.current || !enabledRef.current) return;
    saveWorkoutDraftSync(keyRef.current, draftRef.current, entryStateRef.current);
    console.log(`[Persistence] Sync draft saved for key: ${keyRef.current}`);
  }, []);

  const debouncedSave = useRef(
    debounce((k: string, d: WorkoutRecordDraft, p: WorkoutProgramExerciseEntryStateMap) => {
      saveWorkoutDraft(k, d, p);
    }, 1000)
  ).current;

  // Auto-save on change
  useEffect(() => {
    if (!key || !draft || isRestoringRef.current) return;
    debouncedSave(key, draft, programEntryState);
  }, [key, draft, programEntryState, debouncedSave]);

  // Restoration attempt
  const attemptRestore = useCallback(async (targetKey: string) => {
    if (!enabledRef.current || isRestoringRef.current || lastSavedKeyRef.current === targetKey) return;
    isRestoringRef.current = true;

    try {
      console.log(`[Persistence] Attempting restore for key: ${targetKey}`);
      const loaded = await loadWorkoutDraft(targetKey);
      if (loaded) {
        const isExpired = Date.now() - loaded.updatedAt > DRAFT_EXPIRATION_MS;
        if (!isExpired) {
          if (!hasWorkoutEdits(loaded.draft)) {
            console.log(`[Persistence] Draft found but has no user edits, skipping restore`);
            lastSavedKeyRef.current = targetKey;
          } else {
            console.log(`[Persistence] Valid draft found (updatedAt: ${loaded.updatedAt}), calling onRestore`);
            onRestore(loaded);
            lastSavedKeyRef.current = targetKey;
            console.log(`[Persistence] onRestore completed for key: ${targetKey}`);
          }
        } else {
          console.log(`[Persistence] Expired draft found, ignoring`);
        }
      } else {
        console.log(`[Persistence] No draft found for key: ${targetKey}`);
      }
    } catch (e) {
      console.error("[Persistence] Restoration failed", e);
    } finally {
      isRestoringRef.current = false;
    }
  }, [onRestore]);

  // Lifecycle events - Keep listeners stable
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        forceSave();
      }
    };

    const handlePageHide = () => {
      // Use sync save on pagehide for maximum reliability - NO DYNAMIC IMPORTS
      if (keyRef.current && draftRef.current && enabledRef.current) {
        saveWorkoutDraftSync(keyRef.current, draftRef.current, entryStateRef.current);
      }
    };

    const handlePageShow = (event: any) => {
      console.log(`[Persistence] Page shown (persisted: ${event.persisted})`);
      if (keyRef.current && enabledRef.current && !isRestoringRef.current) {
        attemptRestore(keyRef.current);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow as EventListener);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow as EventListener);
    };
  }, [forceSave, attemptRestore]); // Only stable dependencies

  useEffect(() => {
    if (key && options.enabled && lastSavedKeyRef.current !== key) {
      attemptRestore(key);
    }
  }, [key, attemptRestore, options.enabled]);

  return { forceSave: forceSaveSync };
}
