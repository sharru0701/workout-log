import type { WorkoutExerciseViewModel } from "@/entities/workout";
import type { WorkoutProgramExerciseEntryState } from "@/entities/workout";

export function clampReps(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeRepsPerSet(value: number[], fallback = 5) {
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
    // 우선순위: 저장된 불변값 > plannedSetMeta(안정적) > set.repsPerSet(편집 전이면 정확)
    plannedRepsPerSet: current?.plannedRepsPerSet
      ?? exercise.set.repsPerSet.map((fallback, i) => {
           const fromMeta = exercise.plannedSetMeta?.repsPerSet?.[i];
           return typeof fromMeta === "number" && fromMeta > 0 ? fromMeta : fallback;
         }),
    memoInput: current?.memoInput ?? "",
    memoPlaceholder: current?.memoPlaceholder ?? "",
  };
}

export function formatCompactWeightValue(value: number, step = 0.5) {
  if (!Number.isFinite(value)) return "0";
  const raw = String(step);
  const precision = raw.includes(".") ? Math.min(2, raw.split(".")[1]?.length ?? 0) : 0;
  const rounded = Number(value.toFixed(Math.max(precision, 1)));
  if (precision === 0 || Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(precision);
}
