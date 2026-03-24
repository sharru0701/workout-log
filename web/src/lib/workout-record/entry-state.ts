import type { WorkoutExerciseModel, WorkoutExerciseViewModel, WorkoutRecordDraft } from "./model";

export type WorkoutProgramExerciseEntryState = {
  repsInputs: string[];
  plannedRepsPerSet: number[]; // 세션 시작 시 캡처된 계획 reps (불변)
  memoInput: string;
  memoPlaceholder: string;
};

export type WorkoutProgramExerciseEntryStateMap = Record<string, WorkoutProgramExerciseEntryState>;

export function createWorkoutProgramExerciseEntryState(
  exercise: Pick<WorkoutExerciseModel, "set" | "note">,
): WorkoutProgramExerciseEntryState {
  return {
    repsInputs: exercise.set.repsPerSet.map(() => ""),
    plannedRepsPerSet: [...exercise.set.repsPerSet],
    memoInput: "",
    memoPlaceholder: exercise.note.memo,
  };
}

export function prepareWorkoutRecordDraftForEntry(draft: WorkoutRecordDraft): {
  draft: WorkoutRecordDraft;
  programEntryState: WorkoutProgramExerciseEntryStateMap;
} {
  const programEntryState: WorkoutProgramExerciseEntryStateMap = {};

  return {
    draft: {
      ...draft,
      seedExercises: draft.seedExercises.map((exercise) => {
        programEntryState[exercise.id] = createWorkoutProgramExerciseEntryState(exercise);
        return {
          ...exercise,
          note: {
            memo: "",
          },
        };
      }),
    },
    programEntryState,
  };
}

export function validateWorkoutRecordEntryState(
  exercises: WorkoutExerciseViewModel[],
  programEntryState: WorkoutProgramExerciseEntryStateMap,
): string[] {
  const errors: string[] = [];

  exercises.forEach((exercise) => {
    if (exercise.source !== "PROGRAM") return;

    const entryState = programEntryState[exercise.id];

    exercise.set.repsPerSet.forEach((_, setIndex) => {
      const rawValue = entryState?.repsInputs[setIndex]?.trim() ?? "";
      if (!rawValue) {
        errors.push(`${exercise.exerciseName} ${setIndex + 1}세트 횟수를 입력하세요.`);
        return;
      }

      const parsedValue = Number(rawValue);
      if (!Number.isFinite(parsedValue) || parsedValue < 1 || parsedValue > 100) {
        errors.push(`${exercise.exerciseName} ${setIndex + 1}세트 횟수는 1~100 범위여야 합니다.`);
      }
    });
  });

  return errors;
}
