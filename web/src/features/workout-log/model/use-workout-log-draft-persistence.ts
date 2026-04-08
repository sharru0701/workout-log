"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { clearWorkoutDraft, type WorkoutDraftData } from "@/lib/storage/workoutDraftStore";
import { useWorkoutRecordPersistence } from "@/lib/workout-record/useWorkoutRecordPersistence";
import type {
  PendingRestorePrompt,
} from "@/features/workout-log/model/editor-actions";
import type {
  WorkoutRecordDraft,
  WorkoutProgramExerciseEntryStateMap,
} from "@/entities/workout-record";

type UseWorkoutLogDraftPersistenceInput = {
  persistenceKey: string | null;
  draft: WorkoutRecordDraft | null;
  programEntryState: WorkoutProgramExerciseEntryStateMap;
  onRestoreAccepted: (data: WorkoutDraftData) => void;
};

export function useWorkoutLogDraftPersistence({
  persistenceKey,
  draft,
  programEntryState,
  onRestoreAccepted,
}: UseWorkoutLogDraftPersistenceInput) {
  const isRestoredRef = useRef(false);
  const isRestoringRef = useRef(false);
  const persistenceKeyRef = useRef<string | null>(null);
  const reloadDraftContextRef = useRef<(() => Promise<void>) | null>(null);
  const [pendingRestorePrompt, setPendingRestorePrompt] = useState<PendingRestorePrompt | null>(null);
  const restorePromptResolveRef = useRef<((keep: boolean) => void) | null>(null);

  useEffect(() => {
    persistenceKeyRef.current = persistenceKey;
    isRestoredRef.current = false;
  }, [persistenceKey]);

  useWorkoutRecordPersistence(
    persistenceKey,
    draft,
    programEntryState,
    useCallback(async (data) => {
      isRestoredRef.current = true;
      isRestoringRef.current = true;

      const capturedKey = persistenceKeyRef.current;

      try {
        await new Promise((resolve) => setTimeout(resolve, 150));
        const shouldKeep = await new Promise<boolean>((resolve) => {
          restorePromptResolveRef.current = resolve;
          setPendingRestorePrompt({
            capturedKey,
            data,
          });
        });

        if (shouldKeep) {
          startTransition(() => {
            onRestoreAccepted(data);
          });
          return true;
        }

        isRestoredRef.current = false;
        if (capturedKey) {
          await clearWorkoutDraft(capturedKey);
        }
        await reloadDraftContextRef.current?.();
        return false;
      } finally {
        restorePromptResolveRef.current = null;
        isRestoringRef.current = false;
      }
    }, [onRestoreAccepted]),
    { enabled: true },
  );

  const resolveRestorePrompt = useCallback((keep: boolean) => {
    restorePromptResolveRef.current?.(keep);
    restorePromptResolveRef.current = null;
    setPendingRestorePrompt(null);
  }, []);

  const registerReloadDraftContext = useCallback((fn: (() => Promise<void>) | null) => {
    reloadDraftContextRef.current = fn;
  }, []);

  const hasRestoredDraft = useCallback(() => isRestoredRef.current, []);

  return {
    pendingRestorePrompt,
    resolveRestorePrompt,
    isRestoreFlowActive: pendingRestorePrompt !== null || isRestoringRef.current,
    registerReloadDraftContext,
    hasRestoredDraft,
  };
}
