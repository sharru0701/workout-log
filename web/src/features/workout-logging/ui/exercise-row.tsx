import { memo } from "react";
import { AppPlusMinusIcon, AppTextarea } from "@/shared/ui/form-controls";
import { useLocale } from "@/components/locale-provider";
import { isBodyweightExerciseName } from "@/lib/bodyweight-load";
import { 
  computeBodyweightTotalLoadKg,
  formatKgValue,
} from "@/lib/settings/workout-preferences";
import type { WorkoutProgramExerciseEntryState } from "@/entities/workout";
import type { WorkoutExerciseViewModel, ExerciseRowAction } from "@/entities/workout";
import { WorkoutRecordInlinePicker, type InlinePickerRequest } from "./inline-picker";
import { SwipeableSetRow } from "./swipeable-set-row";

function formatCompactWeightValue(value: number, step = 0.5) {
  if (!Number.isFinite(value)) return "0";
  const raw = String(step);
  const precision = raw.includes(".") ? Math.min(2, raw.split(".")[1]?.length ?? 0) : 0;
  const rounded = Number(value.toFixed(Math.max(precision, 1)));
  if (rounded === 0) return "0";
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(Math.max(precision, 1));
}

export const ExerciseRow = memo(function ExerciseRow({
  exerciseId,
  exercise,
  minimumPlateIncrementKg,
  showMinimumPlateInfo,
  bodyweightKg,
  onAction,
  onOpenInlinePicker,
}: {
  exerciseId: string;
  exercise: WorkoutExerciseViewModel;
  minimumPlateIncrementKg: number;
  showMinimumPlateInfo: boolean;
  bodyweightKg: number | null;
  programEntryState?: WorkoutProgramExerciseEntryState;
  onAction: (exerciseId: string, action: ExerciseRowAction) => void;
  onOpenInlinePicker: (request: InlinePickerRequest) => void;
}) {
  const { locale } = useLocale();
  const isBodyweight = isBodyweightExerciseName(exercise.exerciseName);
  const totalLoadKg = computeBodyweightTotalLoadKg(exercise.exerciseName, exercise.set.weightKg, bodyweightKg);

  return (
    <article className="exercise-row">
      <div className="exercise-row__header">
        <div className="exercise-row__title-group">
          <h3 className="exercise-row__title">{exercise.exerciseName}</h3>
          {exercise.badge && (
            <span className={`exercise-badge exercise-badge--${exercise.badge.toLowerCase()}`}>
              {exercise.badge}
            </span>
          )}
        </div>
        <button
          type="button"
          className="exercise-row__delete-btn"
          onClick={() => onAction(exerciseId, { type: "DELETE" })}
        >
          <span className="material-symbols-outlined">delete</span>
        </button>
      </div>

      <div className="exercise-row__stats">
        <div className="exercise-row__stat">
          <span className="exercise-row__stat-label">Sets</span>
          <span className="exercise-row__stat-value">{exercise.set.repsPerSet.length}</span>
        </div>
        <div className="exercise-row__stat">
          <span className="exercise-row__stat-label">Weight</span>
          <span className="exercise-row__stat-value">{formatKgValue(exercise.set.weightKg)}kg</span>
        </div>
        {isBodyweight && bodyweightKg && (
          <div className="exercise-row__stat">
            <span className="exercise-row__stat-label">Total Load</span>
            <span className="exercise-row__stat-value">{formatKgValue(totalLoadKg)}kg</span>
          </div>
        )}
      </div>

      <div className="set-list">
        {exercise.set.repsPerSet.map((setReps, index) => {
          const isSetComplete = setReps > 0;
          const isFailure = false; // Implement failure logic if needed

          return (
            <SwipeableSetRow
              key={`${exerciseId}-set-${index}`}
              deleteLabel="Delete Set"
              onDelete={() => onAction(exerciseId, { type: "REMOVE_SET", index })}
              disabled={exercise.set.repsPerSet.length <= 1}
            >
              <div className="set-row">
                <span className="set-row__number">{index + 1}</span>
                <div className="set-row__inputs">
                  <WorkoutRecordInlinePicker
                    label={locale === "ko" ? `${exercise.exerciseName} 무게` : `${exercise.exerciseName} Weight`}
                    value={exercise.set.weightKg}
                    complete={isSetComplete}
                    failed={isFailure}
                    formatValue={(value) => formatCompactWeightValue(value, minimumPlateIncrementKg)}
                    color="var(--text-metric-weight)"
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
                </div>
              </div>
            </SwipeableSetRow>
          );
        })}
      </div>

      <button
        type="button"
        className="btn-add-set"
        onClick={() => onAction(exerciseId, { type: "ADD_SET" })}
      >
        <AppPlusMinusIcon kind="plus" size={14} />
        <span>Add Set</span>
      </button>

      {showMinimumPlateInfo && (
        <div className="minimum-plate-info">
          Increment: {minimumPlateIncrementKg}kg
        </div>
      )}

      <div className="exercise-memo">
        <label>
          <span className="exercise-memo__label">Memo</span>
          <AppTextarea
            variant="workout"
            value={exercise.note.memo}
            onChange={(e) => onAction(exerciseId, { type: "CHANGE_MEMO", value: e.target.value })}
            placeholder="Add note..."
            style={{
              marginTop: "4px",
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
