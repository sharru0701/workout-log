"use client";

import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AppTextInput } from "@/components/ui/form-controls";
import { NumberPickerField } from "@/components/ui/number-picker-sheet";
import {
  computeBodyweightTotalLoadKg,
  formatExerciseLoadLabel,
  formatKgValue,
  isBodyweightExerciseName,
} from "@/lib/bodyweight-load";

type WorkoutSetRowData = {
  id: string;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe: number;
  isExtra: boolean;
  isPlanned: boolean;
  completed: boolean;
  plannedRef?: {
    exerciseName: string;
    setNumber: number;
    rowType?: string;
    progressionTarget?: string;
    progressionKey?: string;
    progressionLabel?: string;
    reps?: number;
    targetWeightKg?: number;
    totalTargetWeightKg?: number;
    rpe?: number;
    percent?: number;
    note?: string;
  } | null;
};

type WorkoutSetRowProps = {
  idx: number;
  row: WorkoutSetRowData;
  bodyweightKg: number | null;
  setCellKey: (row: number, col: number) => string;
  registerSetInputRef: (key: string, element: HTMLInputElement | null) => void;
  handleSetGridKeyDown: (event: KeyboardEvent<HTMLInputElement>, row: number, col: number) => void;
  updateRow: (idx: number, updater: (row: WorkoutSetRowData) => WorkoutSetRowData) => void;
  onCompleteAndNext: (idx: number) => void;
  onCopyPrevious: (idx: number) => void;
  onInsertBelow: (idx: number, focusCol?: number) => void;
  onRemove: (idx: number) => void;
  canCopyPrevious: boolean;
};

const MOTION_DURATION_FAST_MS = 160;

function formatPlannedRef(ref: WorkoutSetRowData["plannedRef"], bodyweightKg: number | null) {
  if (!ref) return "";
  const reps = ref.reps ?? "-";
  const displayWeight = formatExerciseLoadLabel({
    exerciseName: ref.exerciseName,
    weightKg: ref.totalTargetWeightKg ?? ref.targetWeightKg ?? 0,
    bodyweightKg,
    source: ref.totalTargetWeightKg !== undefined ? "total" : "external",
  });
  const percent =
    typeof ref.percent === "number" && Number.isFinite(ref.percent) && ref.percent > 0
      ? `${Math.round(ref.percent * 100)}%`
      : null;
  const note = typeof ref.note === "string" && ref.note.trim() ? ref.note.trim() : null;
  const meta = [percent, note].filter(Boolean).join(" · ");
  return `${reps}회 @ ${displayWeight}${meta ? ` (${meta})` : ""}`;
}

const WorkoutSetRow = memo(function WorkoutSetRow({
  idx,
  row,
  bodyweightKg,
  setCellKey,
  registerSetInputRef,
  handleSetGridKeyDown,
  updateRow,
  onCompleteAndNext,
  onCopyPrevious,
  onInsertBelow,
  onRemove,
  canCopyPrevious,
}: WorkoutSetRowProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const removeTimerRef = useRef<number | null>(null);
  const isBodyweightExercise = isBodyweightExerciseName(row.exerciseName);
  const totalLoadKg = computeBodyweightTotalLoadKg(row.exerciseName, row.weightKg, bodyweightKg);

  useEffect(() => {
    return () => {
      if (removeTimerRef.current !== null) {
        window.clearTimeout(removeTimerRef.current);
      }
    };
  }, []);

  function handleRemoveWithMotion() {
    if (isRemoving) return;
    setIsRemoving(true);
    removeTimerRef.current = window.setTimeout(() => {
      onRemove(idx);
    }, MOTION_DURATION_FAST_MS);
  }

  return (
    <div className={`workout-swipe-shell ui-list-item motion-list-item ${isRemoving ? "is-removing" : ""}`}>
      <button className="workout-swipe-delete haptic-tap" type="button" onClick={handleRemoveWithMotion}>
        삭제
      </button>

      <article className="workout-set-card">
        <label className="flex flex-col gap-1">
          <span className="ui-card-label">운동</span>
          <AppTextInput
            variant="workout"
            list="exercise-options"
            value={row.exerciseName}
            ref={(element) => registerSetInputRef(setCellKey(idx, 0), element)}
            onKeyDown={(event) => handleSetGridKeyDown(event, idx, 0)}
            onChange={(event) => updateRow(idx, (prev) => ({ ...prev, exerciseName: event.target.value }))}
          />
        </label>

        <div className="mt-2 grid grid-cols-4 gap-2">
          <div className="flex flex-col gap-1">
            <span className="ui-card-label">세트</span>
            <NumberPickerField
              label="세트"
              value={row.setNumber}
              min={1}
              max={30}
              step={1}
              variant="workout-number"
              onChange={(v) => updateRow(idx, (prev) => ({ ...prev, setNumber: v }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="ui-card-label">반복</span>
            <NumberPickerField
              label="반복"
              value={row.reps}
              min={0}
              max={100}
              step={1}
              variant="workout-number"
              onChange={(v) => updateRow(idx, (prev) => ({ ...prev, reps: v }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="ui-card-label">
              {isBodyweightExercise && bodyweightKg ? "추가중량(kg)" : "중량(kg)"}
            </span>
            <NumberPickerField
              label={isBodyweightExercise && bodyweightKg ? "추가중량" : "중량"}
              value={row.weightKg}
              min={0}
              max={500}
              step={0.5}
              unit="kg"
              variant="workout-number"
              formatValue={(v) => v.toFixed(1)}
              onChange={(v) => updateRow(idx, (prev) => ({ ...prev, weightKg: v }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="ui-card-label">RPE</span>
            <NumberPickerField
              label="RPE"
              value={row.rpe}
              min={0}
              max={10}
              step={0.5}
              variant="workout-number"
              formatValue={(v) => v.toFixed(1)}
              onChange={(v) => updateRow(idx, (prev) => ({ ...prev, rpe: v }))}
            />
          </div>
        </div>

        {isBodyweightExercise && bodyweightKg ? (
          <div className="mt-2 text-xs text-[var(--text-secondary)]">총하중 기준: {formatKgValue(totalLoadKg)}</div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="workout-toggle">
            <input
              type="checkbox"
              checked={row.isExtra}
              onChange={(event) =>
                updateRow(idx, (prev) => ({
                  ...prev,
                  isExtra: event.target.checked,
                  isPlanned: event.target.checked ? false : prev.isPlanned,
                }))
              }
            />
            <span>추가</span>
          </label>

          <label className="workout-toggle">
            <input
              type="checkbox"
              checked={row.completed}
              onChange={(event) => updateRow(idx, (prev) => ({ ...prev, completed: event.target.checked }))}
            />
            <span>완료</span>
          </label>

          <span className="ui-card-label">{row.isExtra ? "추가" : row.isPlanned ? "계획" : "사용자"}</span>
        </div>

        {row.plannedRef ? (
          <div className="mt-2 rounded-lg border px-2 py-1 text-xs text-[var(--text-secondary)]">
            처방: {formatPlannedRef(row.plannedRef, bodyweightKg)}
            {isBodyweightExercise && bodyweightKg ? (
              <div className="pt-1">현재 입력 총하중: {totalLoadKg?.toFixed(2) ?? "-"}kg</div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button className="haptic-tap workout-action-pill rounded-xl border px-3 py-2 text-sm" type="button" onClick={() => onCompleteAndNext(idx)}>
            완료 후 다음
          </button>
          <button
            className="haptic-tap workout-action-pill rounded-xl border px-3 py-2 text-sm"
            type="button"
            onClick={() => onCopyPrevious(idx)}
            disabled={!canCopyPrevious}
          >
            이전 복사
          </button>
          <button className="haptic-tap workout-action-pill rounded-xl border px-3 py-2 text-sm" type="button" onClick={() => onInsertBelow(idx, 0)}>
            아래에 삽입
          </button>
        </div>
      </article>
    </div>
  );
});

export default WorkoutSetRow;
