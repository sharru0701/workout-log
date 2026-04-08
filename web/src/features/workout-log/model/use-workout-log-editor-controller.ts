import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef } from "react";
import {
  buildExerciseActionUpdate,
  type ExerciseRowAction,
} from "./editor-actions";
import type { WorkoutPreferences } from "@/lib/settings/workout-preferences";
import type {
  WorkoutExerciseViewModel,
  WorkoutProgramExerciseEntryStateMap,
  WorkoutRecordDraft,
  WorkoutWorkflowState,
} from "@/entities/workout-record";
import {
  applyWorkoutLogWeightRulesToDraft,
  resolveWorkoutWeightWithPreferences,
} from "./weight-rules";

type UseWorkoutLogEditorControllerInput = {
  visibleExercises: WorkoutExerciseViewModel[];
  workoutPreferences: WorkoutPreferences;
  setDraft: Dispatch<SetStateAction<WorkoutRecordDraft | null>>;
  setProgramEntryState: Dispatch<SetStateAction<WorkoutProgramExerciseEntryStateMap>>;
  setWorkflowState: Dispatch<SetStateAction<WorkoutWorkflowState>>;
};

export function useWorkoutLogEditorController({
  visibleExercises,
  workoutPreferences,
  setDraft,
  setProgramEntryState,
  setWorkflowState,
}: UseWorkoutLogEditorControllerInput) {
  const visibleExercisesRef = useRef<WorkoutExerciseViewModel[]>(visibleExercises);
  const workoutPreferencesRef = useRef<WorkoutPreferences>(workoutPreferences);

  useEffect(() => {
    visibleExercisesRef.current = visibleExercises;
    workoutPreferencesRef.current = workoutPreferences;
  }, [visibleExercises, workoutPreferences]);

  const resolveWeightWithCurrentPreferences = useCallback(
    (weightKg: number, exerciseId: string | null | undefined, exerciseName: string) =>
      resolveWorkoutWeightWithPreferences(
        weightKg,
        exerciseId,
        exerciseName,
        workoutPreferences,
      ),
    [workoutPreferences],
  );

  const applyEditing = useCallback(
    (updater: (prev: WorkoutRecordDraft) => WorkoutRecordDraft) => {
      setDraft((prev) => {
        if (!prev) return prev;
        return updater(prev);
      });
      setWorkflowState((prev) => (prev === "saving" ? prev : "editing"));
    },
    [setDraft, setWorkflowState],
  );

  const handleExerciseAction = useCallback(
    (exerciseId: string, action: ExerciseRowAction) => {
      const exercise = visibleExercisesRef.current.find((entry) => entry.id === exerciseId);
      if (!exercise) return;
      const update = buildExerciseActionUpdate(
        exerciseId,
        exercise,
        action,
        workoutPreferencesRef.current,
        resolveWorkoutWeightWithPreferences,
      );
      if (!update) return;
      if (update.programEntryStateUpdater) {
        setProgramEntryState(update.programEntryStateUpdater);
      }
      applyEditing(update.draftUpdater);
    },
    [applyEditing, setProgramEntryState],
  );

  const handleSessionMemoChange = useCallback(
    (nextMemo: string) => {
      applyEditing((prev) => ({
        ...prev,
        session: {
          ...prev.session,
          note: {
            memo: nextMemo,
          },
        },
      }));
    },
    [applyEditing],
  );

  useEffect(() => {
    setDraft((prev) =>
      prev ? applyWorkoutLogWeightRulesToDraft(prev, workoutPreferences) : prev,
    );
  }, [setDraft, workoutPreferences]);

  return {
    resolveWeightWithCurrentPreferences,
    handleExerciseAction,
    handleSessionMemoChange,
  };
}
