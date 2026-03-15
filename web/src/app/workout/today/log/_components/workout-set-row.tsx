"use client";

import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Card } from "@/components/ui/card";
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

function resolveSetStateLabel({
  isExtra,
  plannedPercent,
  rpe,
}: {
  isExtra: boolean;
  plannedPercent: number | null;
  rpe: number;
}) {
  if (isExtra) {
    return { className: "label set-backoff label-sm", text: "백오프" };
  }
  if (typeof plannedPercent === "number" && Number.isFinite(plannedPercent) && plannedPercent > 0) {
    if (plannedPercent < 0.65) return { className: "label set-warmup label-sm", text: "워밍업" };
    if (plannedPercent >= 0.88) return { className: "label set-top label-sm", text: "탑 세트" };
    return { className: "label set-work label-sm", text: "작업 세트" };
  }
  if (rpe > 0 && rpe <= 6.5) {
    return { className: "label set-deload label-sm", text: "디로드" };
  }
  return { className: "label set-work label-sm", text: "작업 세트" };
}

function progressLabelClass(rpe: number) {
  if (rpe >= 9.25) return "progress-peak";
  if (rpe >= 8) return "progress-high";
  if (rpe >= 6.5) return "progress-medium";
  return "progress-low";
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

  const sourceLabel = row.isExtra
    ? { className: "label label-set-type label-sm", text: "추가" }
    : row.isPlanned
      ? { className: "label label-program label-sm", text: "계획" }
      : { className: "label label-note label-sm", text: "직접 입력" };
  const plannedPercent = row.plannedRef?.percent ?? null;
  const setStateLabel = resolveSetStateLabel({
    isExtra: row.isExtra,
    plannedPercent,
    rpe: row.rpe,
  });
  const progressLabel =
    row.rpe > 0
      ? {
          className: `label ${progressLabelClass(row.rpe)} label-sm`,
          text: `RPE ${row.rpe.toFixed(1)}`,
        }
      : null;

  return (
    <div>
      <button type="button" onClick={handleRemoveWithMotion}>
        삭제
      </button>

      <Card as="article" padding="none">
        <label>
          <span>운동</span>
          <AppTextInput
            variant="workout"
            list="exercise-options"
            value={row.exerciseName}
            ref={(element) => registerSetInputRef(setCellKey(idx, 0), element)}
            onKeyDown={(event) => handleSetGridKeyDown(event, idx, 0)}
            onChange={(event) => updateRow(idx, (prev) => ({ ...prev, exerciseName: event.target.value }))}
          />
        </label>

        <div>
          <div>
            <span>세트</span>
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

          <div>
            <span>반복</span>
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

          <div>
            <span>
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

          <div>
            <span>RPE</span>
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
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <span className="label label-metric label-sm">총하중</span>
            <span className="metric-value metric-weight" style={{ fontSize: "1rem" }}>{formatKgValue(totalLoadKg)}</span>
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-sm)" }}>
          <span className={sourceLabel.className}>{sourceLabel.text}</span>
          {setStateLabel ? <span className={setStateLabel.className}>{setStateLabel.text}</span> : null}
          {progressLabel ? <span className={progressLabel.className}>{progressLabel.text}</span> : null}
          {row.completed ? <span className="label label-complete label-sm">완료</span> : null}
          <label>
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

          <label>
            <input
              type="checkbox"
              checked={row.completed}
              onChange={(event) => updateRow(idx, (prev) => ({ ...prev, completed: event.target.checked }))}
            />
            <span>완료</span>
          </label>
        </div>

        {row.plannedRef ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-sm)" }}>
            <span className="label label-program label-sm">처방</span>
            <span>{formatPlannedRef(row.plannedRef, bodyweightKg)}</span>
            {isBodyweightExercise && bodyweightKg ? (
              <div>현재 입력 총하중: {totalLoadKg?.toFixed(2) ?? "-"}kg</div>
            ) : null}
          </div>
        ) : null}

        <div>
          <button type="button" onClick={() => onCompleteAndNext(idx)}>
            완료 후 다음
          </button>
          <button
            type="button"
            onClick={() => onCopyPrevious(idx)}
            disabled={!canCopyPrevious}
          >
            이전 복사
          </button>
          <button type="button" onClick={() => onInsertBelow(idx, 0)}>
            아래에 삽입
          </button>
        </div>
      </Card>
    </div>
  );
});

export default WorkoutSetRow;
