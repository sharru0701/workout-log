import type { WorkoutExerciseViewModel } from "@/entities/workout";
import type { WorkoutProgramExerciseEntryStateMap } from "@/entities/workout";

export type ProgressionTargetStateSnapshot = {
  workKg: number;
  failureStreak: number;
  successStreak: number;
};

export type ProgressionRuntimeStateSnapshot = {
  cycle: number;
  week: number;
  day: number;
  targets: Record<string, ProgressionTargetStateSnapshot>;
};

export type FailedProgressionExercise = {
  exerciseName: string;
  target: string;
};

export function mapExerciseNameToProgressionTarget(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (n.includes("squat")) return "SQUAT";
  if (n.includes("bench")) return "BENCH";
  if (n.includes("deadlift")) return "DEADLIFT";
  if (n.includes("overhead press") || n === "ohp" || n.includes("shoulder press")) return "OHP";
  if (n.includes("row") || n.includes("pull-up") || n.includes("pull up") || n.includes("pulldown")) return "PULL";
  return null;
}

export function detectFailedProgressionExercises(
  visibleExercises: WorkoutExerciseViewModel[],
  programEntryState: WorkoutProgramExerciseEntryStateMap,
): FailedProgressionExercise[] {
  const seen = new Set<string>();
  const failed: FailedProgressionExercise[] = [];
  for (const exercise of visibleExercises) {
    if (exercise.source !== "PROGRAM") continue;
    const entryState = programEntryState[exercise.id];
    if (!entryState) continue;
    const hasFail = exercise.set.repsPerSet.some((_, i) => {
      const actual = Number(entryState.repsInputs[i]?.trim() ?? "");
      const planned = entryState.plannedRepsPerSet[i];
      return Number.isFinite(actual) && actual > 0 && typeof planned === "number" && planned > 0 && actual < planned;
    });
    if (!hasFail) continue;
    const target = mapExerciseNameToProgressionTarget(exercise.exerciseName);
    if (!target || seen.has(target)) continue;
    seen.add(target);
    failed.push({ exerciseName: exercise.exerciseName, target });
  }
  return failed;
}

export function progressionTargetLabel(target: string, locale: "ko" | "en"): string {
  const labels =
    locale === "ko"
      ? { SQUAT: "스쿼트", BENCH: "벤치프레스", DEADLIFT: "데드리프트", OHP: "오버헤드프레스", PULL: "풀" }
      : { SQUAT: "Squat", BENCH: "Bench Press", DEADLIFT: "Deadlift", OHP: "Overhead Press", PULL: "Pull" };
  return labels[target as keyof typeof labels] ?? target;
}

// Operator 블록 완료 모달 메시지 (6주 사이클)
export function buildOperatorBlockCompletionMessage(
  state: ProgressionRuntimeStateSnapshot | null,
  locale: "ko" | "en",
): string {
  const lines: string[] =
    locale === "ko"
      ? ["6주 블록을 완료했습니다.", "다음 사이클에 적용할 무게를 선택하세요.", ""]
      : ["You completed the 6-week block.", "Choose the working weights to apply to the next cycle.", ""];
  if (state) {
    const hadFailure = Object.values(state.targets).some((t) => t.failureStreak > 0);
    if (hadFailure) {
      lines.push(locale === "ko" ? "이번 블록에서 실패가 있었습니다." : "There were failed sets in this block.");
      lines.push("");
    }
    for (const [key, t] of Object.entries(state.targets)) {
      if (t.workKg <= 0) continue;
      const label = progressionTargetLabel(key, locale);
      const increaseKg = key === "DEADLIFT" ? 5 : 2.5;
      const resetKg = Math.round((t.workKg * 0.95) / 2.5) * 2.5;
      lines.push(`• ${label}: ${t.workKg}kg`);
      lines.push(
        locale === "ko"
          ? `  증량 → ${t.workKg + increaseKg}kg / 유지 → ${t.workKg}kg / 감소 → ${resetKg}kg`
          : `  Increase -> ${t.workKg + increaseKg}kg / Keep -> ${t.workKg}kg / Reduce -> ${resetKg}kg`,
      );
    }
  }
  return lines.join("\n");
}

// 5/3/1 블록 완료 모달 메시지 (4주 사이클)
export function build531BlockCompletionMessage(
  state: ProgressionRuntimeStateSnapshot | null,
  locale: "ko" | "en",
): string {
  const lines: string[] =
    locale === "ko"
      ? ["4주 사이클을 완료했습니다.", "다음 사이클에 적용할 트레이닝 맥스를 선택하세요.", ""]
      : ["You completed the 4-week cycle.", "Choose the training max to apply to the next cycle.", ""];
  if (state) {
    const hadFailure = Object.values(state.targets).some((t) => t.failureStreak > 0);
    if (hadFailure) {
      lines.push(locale === "ko" ? "이번 사이클에서 실패한 세트가 있었습니다." : "There were failed sets in this cycle.");
      lines.push("");
    }
    for (const [key, t] of Object.entries(state.targets)) {
      if (t.workKg <= 0) continue;
      const label = progressionTargetLabel(key, locale);
      // 5/3/1: 하체(스쿼트·데드리프트) +5kg, 상체(벤치·오버헤드) +2.5kg
      const increaseKg = key === "DEADLIFT" || key === "SQUAT" ? 5 : 2.5;
      const resetKg = Math.round((t.workKg * 0.9) / 2.5) * 2.5;
      lines.push(`• ${label}: ${t.workKg}kg`);
      lines.push(
        locale === "ko"
          ? `  증량(+${increaseKg}kg) → ${t.workKg + increaseKg}kg / 유지 → ${t.workKg}kg / 감소(10%) → ${resetKg}kg`
          : `  Increase (+${increaseKg}kg) -> ${t.workKg + increaseKg}kg / Keep -> ${t.workKg}kg / Reduce (10%) -> ${resetKg}kg`,
      );
    }
  }
  return lines.join("\n");
}

// 연속 실패 리셋 모달 메시지 (Greyskull, Starting Strength, StrongLifts, GZCLP 등)
export function buildResetProtocolMessage(
  failures: FailedProgressionExercise[],
  state: ProgressionRuntimeStateSnapshot | null,
  resetFactor: number,
  locale: "ko" | "en",
): string {
  const pct = Math.round((1 - resetFactor) * 100);
  const lines: string[] = [locale === "ko" ? "3회 연속 실패 기준에 도달했습니다." : "Three consecutive failures were reached.", ""];
  for (const f of failures) {
    const workKg = state?.targets[f.target]?.workKg ?? null;
    if (workKg !== null) {
      const resetKg = Math.round((workKg * resetFactor) / 2.5) * 2.5;
      const increaseKg = f.target === "DEADLIFT" ? 5 : 2.5;
      lines.push(`• ${f.exerciseName}: ${workKg}kg`);
      lines.push(
        locale === "ko"
          ? `  감소(${pct}%) → ${resetKg}kg / 유지 → ${workKg}kg / 증량 → ${workKg + increaseKg}kg`
          : `  Reduce (${pct}%) -> ${resetKg}kg / Keep -> ${workKg}kg / Increase -> ${workKg + increaseKg}kg`,
      );
    } else {
      lines.push(`• ${f.exerciseName}`);
    }
  }
  return lines.join("\n");
}
