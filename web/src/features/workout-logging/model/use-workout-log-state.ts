import { useState, useCallback } from "react";
import { produce } from "immer";
import {
  WorkoutRecordDraft,
  WorkoutProgramExerciseEntryStateMap,
  WorkoutWorkflowState,
  ExerciseRowAction,
  WorkoutExerciseViewModel,
  patchSeedExercise,
  updateUserExercise,
  removeSeedExercise,
  removeUserExercise,
  resolveWeightWithPreferences,
} from "@/entities/workout";
import { WorkoutPreferences } from "@/lib/settings/workout-preferences";

export function useWorkoutLogState(
  initialDraft: WorkoutRecordDraft,
  initialEntryState: WorkoutProgramExerciseEntryStateMap,
) {
  const [draft, setDraft] = useState<WorkoutRecordDraft>(initialDraft);
  const [programEntryState, setProgramEntryState] = useState<WorkoutProgramExerciseEntryStateMap>(initialEntryState);
  const [workflowState, setWorkflowState] = useState<WorkoutWorkflowState>("idle");

  const updateExerciseAction = useCallback(
    (exercise: WorkoutExerciseViewModel, action: ExerciseRowAction, preferences: WorkoutPreferences) => {
      const exerciseId = exercise.id;

      setWorkflowState((prev) => (prev === "saving" ? prev : "editing"));

      switch (action.type) {
        case "CHANGE_WEIGHT": {
          const { value } = action;
          if (!Number.isFinite(value)) return;
          const snapped = resolveWeightWithPreferences(value, exercise.exerciseId, exercise.exerciseName, preferences);

          setDraft((prev) => {
            if (exercise.source === "PROGRAM") {
              return patchSeedExercise(prev, exerciseId, { set: { weightKg: snapped } });
            } else {
              return updateUserExercise(prev, exerciseId, { set: { weightKg: snapped } });
            }
          });
          break;
        }

        case "CHANGE_SET_REPS": {
          const { setIndex, value } = action;
          setDraft((prev) => {
            const repsPerSet = [...exercise.set.repsPerSet];
            repsPerSet[setIndex] = value;
            if (exercise.source === "PROGRAM") {
              return patchSeedExercise(prev, exerciseId, { set: { repsPerSet } });
            } else {
              return updateUserExercise(prev, exerciseId, { set: { repsPerSet } });
            }
          });

          if (exercise.source === "PROGRAM") {
            setProgramEntryState(
              produce((state) => {
                if (state[exerciseId]) {
                  state[exerciseId].repsInputs[setIndex] = String(value);
                }
              }),
            );
          }
          break;
        }

        case "ADD_SET": {
          setDraft((prev) => {
            const last = exercise.set.repsPerSet[exercise.set.repsPerSet.length - 1] ?? 5;
            const repsPerSet = [...exercise.set.repsPerSet, last];
            if (exercise.source === "PROGRAM") {
              return patchSeedExercise(prev, exerciseId, { set: { repsPerSet } });
            } else {
              return updateUserExercise(prev, exerciseId, { set: { repsPerSet } });
            }
          });

          if (exercise.source === "PROGRAM") {
            setProgramEntryState(
              produce((state) => {
                if (state[exerciseId]) {
                  state[exerciseId].repsInputs.push("");
                }
              }),
            );
          }
          break;
        }

        case "REMOVE_SET": {
          const { index } = action;
          setDraft((prev) => {
            const repsPerSet = exercise.set.repsPerSet.filter((_, i) => i !== index);
            if (exercise.source === "PROGRAM") {
              return patchSeedExercise(prev, exerciseId, { set: { repsPerSet } });
            } else {
              return updateUserExercise(prev, exerciseId, { set: { repsPerSet } });
            }
          });

          if (exercise.source === "PROGRAM") {
            setProgramEntryState(
              produce((state) => {
                if (state[exerciseId]) {
                  state[exerciseId].repsInputs.splice(index, 1);
                }
              }),
            );
          }
          break;
        }

        case "CHANGE_MEMO": {
          const { value } = action;
          setDraft((prev) => {
            if (exercise.source === "PROGRAM") {
              return patchSeedExercise(prev, exerciseId, { note: { memo: value } });
            } else {
              return updateUserExercise(prev, exerciseId, { note: { memo: value } });
            }
          });

          if (exercise.source === "PROGRAM") {
            setProgramEntryState(
              produce((state) => {
                if (state[exerciseId]) {
                  state[exerciseId].memoInput = value;
                }
              }),
            );
          }
          break;
        }

        case "DELETE": {
          setDraft((prev) => {
            if (exercise.source === "PROGRAM") {
              return removeSeedExercise(prev, exerciseId);
            } else {
              return removeUserExercise(prev, exerciseId);
            }
          });
          break;
        }
      }
    },
    [],
  );

  return {
    draft,
    setDraft,
    programEntryState,
    setProgramEntryState,
    workflowState,
    setWorkflowState,
    updateExerciseAction,
  };
}
