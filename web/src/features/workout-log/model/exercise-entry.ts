import type {
  WorkoutExerciseViewModel,
  WorkoutProgramExerciseEntryState,
} from "@/entities/workout-record";

function clampReps(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeRepsPerSet(value: number[], fallback = 5) {
  if (!Array.isArray(value) || value.length === 0) {
    return [clampReps(fallback)];
  }
  return value.map((entry) => clampReps(entry)).slice(0, 50);
}

export function patchSetRepsAtIndex(values: number[], index: number, nextReps: number) {
  const next = normalizeRepsPerSet(values);
  if (index < 0 || index >= next.length) return next;
  next[index] = clampReps(nextReps);
  return next;
}

export function appendSetReps(values: number[]) {
  const next = normalizeRepsPerSet(values);
  const last = next[next.length - 1] ?? 5;
  if (next.length >= 50) return next;
  return [...next, last];
}

export function removeSetRepsAtIndex(values: number[], index: number) {
  const next = normalizeRepsPerSet(values);
  if (next.length <= 1) return next;
  if (index < 0 || index >= next.length) return next;
  return [...next.slice(0, index), ...next.slice(index + 1)];
}

export function createFallbackProgramEntryState(
  exercise: WorkoutExerciseViewModel,
  current?: WorkoutProgramExerciseEntryState,
): WorkoutProgramExerciseEntryState {
  return {
    repsInputs: Array.from({ length: exercise.set.repsPerSet.length }, (_, index) => current?.repsInputs[index] ?? ""),
    plannedRepsPerSet: current?.plannedRepsPerSet
      ?? exercise.set.repsPerSet.map((fallback, index) => {
           const fromMeta = exercise.plannedSetMeta?.repsPerSet?.[index];
           return typeof fromMeta === "number" && fromMeta > 0 ? fromMeta : fallback;
         }),
    memoInput: current?.memoInput ?? "",
    memoPlaceholder: current?.memoPlaceholder ?? "",
  };
}
