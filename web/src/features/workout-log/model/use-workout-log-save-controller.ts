import { useCallback, useRef, useState } from "react";
import type { FailureProtocolChoice } from "@/components/ui/failure-protocol-sheet";
import {
  validateWorkoutDraft,
  validateWorkoutRecordEntryState,
  type WorkoutExerciseViewModel,
  type WorkoutProgramExerciseEntryStateMap,
  type WorkoutRecordDraft,
  type WorkoutWorkflowState,
} from "@/entities/workout-record";
import {
  resolveWorkoutLogProgressionOverride,
  type ProgressionProtocolMode,
} from "./progression";
import { submitWorkoutLogDraft } from "./save";

type FailureProtocolSheetState = {
  title: string;
  message: string;
  mode: ProgressionProtocolMode;
} | null;

import { useStore, useSetAtom } from "jotai";
import { draftAtom, visibleExercisesAtom, programEntryStateAtom, saveErrorAtom, workflowStateAtom } from "../store/workout-log-atoms";

type UseWorkoutLogSaveControllerInput = {
  locale: "ko" | "en";
  selectedPlan: {
    id: string;
    params?: Record<string, unknown> | null;
  } | null;
  bodyweightKg: number | null;
  persistenceKey: string | null;
  onSaved: () => void;
};

export function useWorkoutLogSaveController({
  locale,
  selectedPlan,
  bodyweightKg,
  persistenceKey,
  onSaved,
}: UseWorkoutLogSaveControllerInput) {
  const store = useStore();
  const setSaveError = useSetAtom(saveErrorAtom);
  const setWorkflowState = useSetAtom(workflowStateAtom);
  const [failureProtocolSheet, setFailureProtocolSheet] =
    useState<FailureProtocolSheetState>(null);
  const failureProtocolResolveRef =
    useRef<((choice: FailureProtocolChoice) => void) | null>(null);

  const requestFailureProtocolChoice = useCallback(
    (input: NonNullable<FailureProtocolSheetState>) =>
      new Promise<FailureProtocolChoice>((resolve) => {
        failureProtocolResolveRef.current = (choice) => {
          setFailureProtocolSheet(null);
          failureProtocolResolveRef.current = null;
          resolve(choice);
        };
        setFailureProtocolSheet(input);
      }),
    [],
  );

  const handleFailureProtocolSelect = useCallback(
    (choice: FailureProtocolChoice) => {
      failureProtocolResolveRef.current?.(choice);
    },
    [],
  );

  const requestSave = useCallback(async () => {
    const draft = store.get(draftAtom);
    const visibleExercises = store.get(visibleExercisesAtom);
    const programEntryState = store.get(programEntryStateAtom);

    if (!draft) return;

    const entryErrors = validateWorkoutRecordEntryState(
      visibleExercises,
      programEntryState,
      locale,
    );
    if (entryErrors.length > 0) {
      setSaveError(
        entryErrors[0] ??
          (locale === "ko" ? "입력값을 확인해 주세요." : "Check your inputs."),
      );
      setWorkflowState("editing");
      return;
    }

    const validation = validateWorkoutDraft(draft, locale);
    if (!validation.valid) {
      setSaveError(
        validation.errors[0] ??
          (locale === "ko" ? "입력값을 확인해 주세요." : "Check your inputs."),
      );
      setWorkflowState("editing");
      return;
    }

    try {
      const progression = await resolveWorkoutLogProgressionOverride({
        selectedPlanId: selectedPlan?.id,
        autoProgressionEnabled: selectedPlan?.params?.autoProgression === true,
        sessionWeek: draft.session.week,
        sessionDay: draft.session.day,
        visibleExercises,
        programEntryState,
        locale,
        requestChoice: requestFailureProtocolChoice,
      });
      if (progression.cancelled) {
        return;
      }

      setWorkflowState("saving");
      setSaveError(null);
      await submitWorkoutLogDraft({
        draft,
        bodyweightKg,
        progressionOverride: progression.override,
        persistenceKey,
      });

      setWorkflowState("done");
      onSaved();
    } catch (error: any) {
      setSaveError(
        error?.message ??
          (locale === "ko"
            ? "운동기록 저장에 실패했습니다."
            : "Failed to save the workout log."),
      );
      setWorkflowState("editing");
    }
  }, [
    bodyweightKg,
    locale,
    onSaved,
    persistenceKey,
    requestFailureProtocolChoice,
    selectedPlan,
    setSaveError,
    setWorkflowState,
    store,
  ]);

  return {
    failureProtocolSheet,
    handleFailureProtocolSelect,
    requestSave,
  };
}
