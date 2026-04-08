import { memo } from "react";
import { AppPlusMinusIcon, AppTextarea } from "@/shared/ui/form-controls";
import { useLocale } from "@/components/locale-provider";
import { computeBodyweightTotalLoadKg } from "@/lib/settings/workout-preferences";
import { computeExternalLoadFromTotalKg, formatKgValue, isBodyweightExerciseName } from "@/lib/bodyweight-load";
import { snapWeightToIncrementKg } from "@/lib/settings/workout-preferences";
import type { WorkoutProgramExerciseEntryState } from "@/entities/workout";
import type { WorkoutExerciseViewModel, ExerciseRowAction } from "@/entities/workout";
import { WorkoutRecordInlinePicker, type InlinePickerRequest } from "./inline-picker";
import { SwipeableSetRow } from "./swipeable-set-row";

function formatCompactWeightValue(value: number, step = 0.5) {
  if (!Number.isFinite(value)) return "0";
  const raw = String(step);
  const precision = raw.includes(".") ? Math.min(2, raw.split(".")[1]?.length ?? 0) : 0;
  const rounded = Number(value.toFixed(Math.max(precision, 1)));
  if (precision === 0 || Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(precision);
}

function CheckIcon() {
  return (
    <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "1.1rem", fontVariationSettings: "'FILL' 0, 'wght' 600", lineHeight: 1 }}>check</span>
  );
}

function FailureIcon() {
  return (
    <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "1.1rem", fontVariationSettings: "'FILL' 0, 'wght' 600", lineHeight: 1 }}>close</span>
  );
}

function workoutExerciseBadgeMeta(
  badge: WorkoutExerciseViewModel["badge"],
  copy: ReturnType<typeof useLocale>["copy"],
) {
  if (badge === "AUTO") return { label: copy.workoutLog.badgePlanned, className: "label label-program label-sm" };
  if (badge === "CUSTOM") return { label: copy.workoutLog.badgeCustom, className: "label label-note label-sm" };
  if (badge === "ADDED") return { label: copy.workoutLog.badgeAdded, className: "label label-exercise label-sm" };
  return null;
}

export const ExerciseRow = memo(function ExerciseRow({
  exerciseId,
  exercise,
  minimumPlateIncrementKg,
  showMinimumPlateInfo,
  bodyweightKg,
  programEntryState,
  prevPerformance,
  onAction,
  onOpenInlinePicker,
}: {
  exerciseId: string;
  exercise: WorkoutExerciseViewModel;
  minimumPlateIncrementKg: number;
  showMinimumPlateInfo: boolean;
  bodyweightKg: number | null;
  programEntryState?: WorkoutProgramExerciseEntryState;
  prevPerformance?: string;
  onAction: (exerciseId: string, action: ExerciseRowAction) => void;
  onOpenInlinePicker: (request: InlinePickerRequest) => void;
}) {
  const { copy, locale } = useLocale();
  const totalLoadKg = computeBodyweightTotalLoadKg(exercise.exerciseName, exercise.set.weightKg, bodyweightKg);
  const isBodyweightExercise = isBodyweightExerciseName(exercise.exerciseName);
  const badgeMeta = workoutExerciseBadgeMeta(exercise.badge, copy);
  const usesProgramPlaceholders = Boolean(programEntryState);
  const weightStepMeta = locale === "ko" ? `${formatKgValue(minimumPlateIncrementKg)} 단위` : `${formatKgValue(minimumPlateIncrementKg)} increments`;
  const plannedWeightKgPerSet = exercise.plannedSetMeta?.targetWeightKgPerSet ?? [];
  const firstPlannedWeightKg =
    plannedWeightKgPerSet.find((value) => typeof value === "number" && Number.isFinite(value) && value >= 0) ?? null;
  const resolvedFirstPlannedWeightKg =
    typeof firstPlannedWeightKg === "number"
      ? snapWeightToIncrementKg(
          computeExternalLoadFromTotalKg(
            exercise.exerciseName,
            firstPlannedWeightKg,
            bodyweightKg,
          ) ?? firstPlannedWeightKg,
          minimumPlateIncrementKg,
        )
      : null;
  const usesPlannedRowWeights =
    typeof resolvedFirstPlannedWeightKg === "number" &&
    Math.abs(exercise.set.weightKg - resolvedFirstPlannedWeightKg) < 0.01;

  // Determine the first incomplete set index for "active" state highlight
  const firstIncompleteIndex = exercise.set.repsPerSet.findIndex((setReps, i) => {
    const rawVal = programEntryState?.repsInputs[i]?.trim() ?? "";
    const actual = usesProgramPlaceholders ? Number(rawVal) : setReps;
    return !Number.isFinite(actual) || actual <= 0;
  });

  return (
    <article className="exercise-card" aria-label={locale === "ko" ? `운동종목 ${exercise.exerciseName}` : `Exercise ${exercise.exerciseName}`}>
      <div className="exercise-card__header">
        <div className="exercise-card__name-row">
          <strong className="exercise-card__name">{exercise.exerciseName}</strong>
          {badgeMeta ? (
            <span className={badgeMeta.className}>{badgeMeta.label}</span>
          ) : null}
        </div>
        <div className="exercise-card__header-actions">
          {prevPerformance ? (
            <span className="exercise-card__prev-ref" title={locale === "ko" ? "이전 최고 기록" : "Previous best"}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'wght' 400", lineHeight: 1 }}>history</span>
              {prevPerformance}
            </span>
          ) : null}
          {exercise.badge !== "AUTO" ? (
            <button
              type="button"
              className="btn btn-icon btn-icon-danger"
              aria-label={locale === "ko" ? "운동 삭제" : "Remove exercise"}
              title={locale === "ko" ? "운동 삭제" : "Remove exercise"}
              onClick={() => onAction(exerciseId, { type: "DELETE" })}
            >
              <AppPlusMinusIcon kind="minus" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="set-table">
        <div className="set-table__header" aria-hidden="true">
          <span className="set-table__h-set">Set</span>
          <span className="set-table__h-weight">Weight</span>
          <span className="set-table__h-reps">Reps</span>
          <span className="set-table__h-done">✓</span>
        </div>

        <div role="list" aria-label={locale === "ko" ? `${exercise.exerciseName} 세트 편집` : `Edit sets for ${exercise.exerciseName}`}>
          {exercise.set.repsPerSet.map((setReps, index) => {
            const rawSetValue = programEntryState?.repsInputs[index]?.trim() ?? "";
            const parsedSetValue = Number(rawSetValue);
            const actualRepsValue = usesProgramPlaceholders ? parsedSetValue : setReps;
            const hasReps = Number.isFinite(actualRepsValue) && actualRepsValue > 0;
            const isAutoExercise = exercise.badge === "AUTO";
            const plannedReps: number | undefined = isAutoExercise
              ? (programEntryState?.plannedRepsPerSet?.[index] ?? undefined)
              : undefined;

            const isFailure = isAutoExercise && hasReps && typeof plannedReps === "number" && plannedReps > 0 && actualRepsValue < plannedReps;
            const isSetComplete = isAutoExercise
              ? hasReps && (typeof plannedReps !== "number" || plannedReps <= 0 || actualRepsValue >= plannedReps)
              : hasReps;
            const isActive = !isSetComplete && !isFailure && index === firstIncompleteIndex;
            const isPending = !isSetComplete && !isFailure && index !== firstIncompleteIndex;

            const rowClass = [
              "set-row",
              isFailure    ? "set-row--failure"  : "",
              isSetComplete ? "set-row--complete" : "",
              isActive      ? "set-row--active"   : "",
              isPending     ? "set-row--pending"   : "",
            ].filter(Boolean).join(" ");

            const plannedWeightKg = plannedWeightKgPerSet[index];
            const resolvedPlannedWeightKg =
              typeof plannedWeightKg === "number" && Number.isFinite(plannedWeightKg) && plannedWeightKg >= 0
                ? snapWeightToIncrementKg(
                    computeExternalLoadFromTotalKg(
                      exercise.exerciseName,
                      plannedWeightKg,
                      bodyweightKg,
                    ) ?? plannedWeightKg,
                    minimumPlateIncrementKg,
                  )
                : null;
            const resolvedRowWeightKg =
              usesPlannedRowWeights &&
              typeof resolvedPlannedWeightKg === "number" &&
              Number.isFinite(resolvedPlannedWeightKg) &&
              resolvedPlannedWeightKg >= 0
                ? resolvedPlannedWeightKg
                : exercise.set.weightKg;

            return (
              <SwipeableSetRow
                key={`${exercise.id}-set-${index}`}
                deleteLabel={locale === "ko" ? "세트 삭제" : "Delete set"}
                disabled={
                  usesProgramPlaceholders
                    ? index < (programEntryState?.plannedRepsPerSet?.length ?? exercise.set.repsPerSet.length)
                    : exercise.set.repsPerSet.length <= 1
                }
                onDelete={() => onAction(exerciseId, { type: "REMOVE_SET", index })}
              >
                <div role="listitem" className={rowClass}>
                  <span className="set-row__number">{index + 1}</span>
                  <WorkoutRecordInlinePicker
                    label={locale === "ko" ? `${index + 1}세트 무게` : `Set ${index + 1} Weight`}
                    value={resolvedRowWeightKg}
                    formatValue={(value) => formatCompactWeightValue(value, minimumPlateIncrementKg)}
                    color="var(--text-metric-weight)"
                    complete={isSetComplete}
                    failed={isFailure}
                    onChange={(value) =>
                      onOpenInlinePicker({
                        type: "CHANGE_WEIGHT",
                        title: locale === "ko" ? `${exercise.exerciseName} 무게` : `${exercise.exerciseName} Weight`,
                        value,
                        min: 0,
                        max: 1000,
                        step: minimumPlateIncrementKg,
                        formatValue: (nextValue) => formatCompactWeightValue(nextValue, minimumPlateIncrementKg),
                        onChange: (nextValue) => onAction(exerciseId, { type: "CHANGE_WEIGHT", value: nextValue }),
                      })
                    }
                  />
                  <WorkoutRecordInlinePicker
                    label={locale === "ko" ? `${index + 1}세트 횟수` : `Set ${index + 1} Reps`}
                    value={setReps}
                    complete={isSetComplete}
                    failed={isFailure}
                    formatValue={(value) => String(Math.round(value))}
                    color="var(--text-metric-reps)"
                    onChange={(value) =>
                      onOpenInlinePicker({
                        type: "CHANGE_SET_REPS",
                        title: locale === "ko" ? `${exercise.exerciseName} ${index + 1}세트 횟수` : `${exercise.exerciseName} Set ${index + 1} Reps`,
                        value,
                        min: 0,
                        max: 100,
                        step: 1,
                        formatValue: (nextValue) => String(Math.round(nextValue)),
                        onChange: (nextValue) => onAction(exerciseId, { type: "CHANGE_SET_REPS", setIndex: index, value: nextValue }),
                      })
                    }
                  />
                  <div className="set-row__done">
                    {isFailure ? <FailureIcon /> : isSetComplete ? <CheckIcon /> : null}
                  </div>
                </div>
              </SwipeableSetRow>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="set-add-btn"
        onClick={() => onAction(exerciseId, { type: "ADD_SET" })}
      >
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 18, fontVariationSettings: "'wght' 400" }}>add</span>
        {copy.workoutLog.addSet}
      </button>

      {(showMinimumPlateInfo || (isBodyweightExercise && bodyweightKg)) ? (
        <div className="set-hint">
          {showMinimumPlateInfo ? (
            <span className="set-hint__item">
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, fontVariationSettings: "'wght' 400", lineHeight: 1 }}>info</span>
              {locale === "ko" ? `${weightStepMeta}로 입력됩니다.` : `Entered in ${weightStepMeta}.`}
            </span>
          ) : null}
          {isBodyweightExercise && bodyweightKg ? (
            <span className="set-hint__item">
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, fontVariationSettings: "'wght' 400", lineHeight: 1 }}>info</span>
              {locale === "ko" ? `총하중 기준: ${formatKgValue(totalLoadKg)}` : `Total load basis: ${formatKgValue(totalLoadKg)}`}
            </span>
          ) : null}
        </div>
      ) : null}

      <div style={{ padding: "0 var(--space-md) var(--space-md)" }}>
        <label>
          <AppTextarea
            variant="workout"
            value={usesProgramPlaceholders ? (programEntryState?.memoInput ?? "") : exercise.note.memo}
            onChange={(event) => onAction(exerciseId, { type: "CHANGE_MEMO", value: event.target.value })}
            placeholder={usesProgramPlaceholders ? programEntryState?.memoPlaceholder || (locale === "ko" ? "메모" : "Memo") : (locale === "ko" ? "메모" : "Memo")}
            style={{
              border: "none",
              borderRadius: "14px",
              background: "var(--color-surface-container)",
              fontSize: "13px",
              minHeight: "48px",
            }}
          />
        </label>
      </div>
    </article>
  );
});
