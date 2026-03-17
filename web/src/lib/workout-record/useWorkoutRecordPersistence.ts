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
  onRestore: (data: WorkoutDraftData) => void,
  options: { enabled?: boolean } = { enabled: true }
) {
  const isRestoringRef = useRef(false);
  const lastSavedKeyRef = useRef<string | null>(null);

  const forceSave = useCallback(() => {
    if (!key || !draft || !options.enabled) return;
    saveWorkoutDraft(key, draft, programEntryState);
    console.log(`[Persistence] Draft saved for key: ${key}`);
  }, [key, draft, programEntryState, options.enabled]);

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

  // Restoration attempt
  const attemptRestore = useCallback(async (targetKey: string) => {
    if (!options.enabled || isRestoringRef.current || lastSavedKeyRef.current === targetKey) return;
    isRestoringRef.current = true;

    try {
      console.log(`[Persistence] Attempting restore for key: ${targetKey}`);
      const loaded = await loadWorkoutDraft(targetKey);
      if (loaded) {
        const isExpired = Date.now() - loaded.updatedAt > DRAFT_EXPIRATION_MS;
        if (!isExpired) {
          console.log(`[Persistence] Valid draft found (updatedAt: ${loaded.updatedAt}), calling onRestore`);
          onRestore(loaded);
          lastSavedKeyRef.current = targetKey;
          console.log(`[Persistence] onRestore completed for key: ${targetKey}`);
        } else {
          console.log(`[Persistence] Expired draft found (updatedAt: ${loaded.updatedAt}), ignoring`);
        }
      } else {
        console.log(`[Persistence] No draft found for key: ${targetKey} in any storage`);
      }
    } catch (e) {
      console.error("[Persistence] Restoration failed", e);
    } finally {
      isRestoringRef.current = false;
    }
  }, [onRestore, options.enabled]);

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
    
    // bfcache 대응
    const handlePageShow = (event: any) => {
      console.log(`[Persistence] Page shown (persisted: ${event.persisted})`);
      // bfcache(event.persisted === true)인 경우 상태가 유지되어 있을 수 있지만, 
      // 혹시 모를 소실에 대비해 다시 체크합니다.
      if (key && options.enabled && !isRestoringRef.current) {
        attemptRestore(key);
      }
    };
    window.addEventListener("pageshow", handlePageShow as EventListener);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow as EventListener);
    };
  }, [forceSave, key, options.enabled, attemptRestore]);

  useEffect(() => {
    // 이미 해당 키로 복구가 완료된 경우(lastSavedKeyRef.current === key)는 건너뜁니다.
    if (key && options.enabled && lastSavedKeyRef.current !== key) {
      attemptRestore(key);
    }
  }, [key, attemptRestore, options.enabled]);

  return { forceSave };
}
