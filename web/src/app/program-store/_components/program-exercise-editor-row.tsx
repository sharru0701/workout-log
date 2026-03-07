"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AppNumberStepper, AppSelect, AppTextInput } from "@/components/ui/form-controls";
import {
  inferProgressionTargetFromExerciseName,
  isOperatorAutoRowType,
  resolveOperatorExerciseDefaults,
  type ProgramExerciseDraft,
  type ProgramProgressionTarget,
  type ProgramRowType,
  type ProgramTemplate,
} from "@/lib/program-store/model";

type ExerciseOption = {
  id: string;
  name: string;
  category: string | null;
};

type ProgramExerciseEditorRowProps = {
  sessionId: string;
  exercise: ProgramExerciseDraft;
  publicTemplates: ProgramTemplate[];
  exerciseOptions: ExerciseOption[];
  exerciseOptionsLoading: boolean;
  operatorStyle?: boolean;
  highlighted?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onPatch: (sessionId: string, exerciseId: string, patch: Partial<ProgramExerciseDraft>) => void;
  onMove: (sessionId: string, exerciseId: string, direction: "up" | "down") => void;
  onDelete: (sessionId: string, exerciseId: string) => void;
  onDragStart: (sessionId: string, exerciseId: string) => void;
  onDrop: (sessionId: string, exerciseId: string) => void;
};

function formatProgramDisplayName(name: string) {
  return String(name)
    .replace(/\s*\(base[^)]*\)\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatExerciseOptionLabel(option: ExerciseOption) {
  return option.category ? `${option.name} · ${option.category}` : option.name;
}

function progressionTargetLabel(target: ProgramProgressionTarget | null | undefined) {
  if (target === "SQUAT") return "Squat";
  if (target === "BENCH") return "Bench";
  if (target === "DEADLIFT") return "Deadlift";
  if (target === "PULL") return "Pull";
  if (target === "OHP") return "OHP";
  return "Target";
}

function operatorRowTypeLabel(rowType: ProgramRowType | null | undefined) {
  if (rowType === "AUTO") return "Auto";
  if (rowType === "CUSTOM") return "Custom";
  return "Custom";
}

function operatorRowTypeHelp(rowType: ProgramRowType | null | undefined) {
  if (rowType === "AUTO") return "Operator 자동 행입니다. 선택한 운동과 진행 타겟 기준으로 중량/반복수/세트가 자동 적용됩니다.";
  if (rowType === "CUSTOM") return "Operator 자동 로직을 따르지 않는 자유 행입니다. 이 경우만 세트/횟수를 직접 입력합니다.";
  return "행 타입을 선택하세요.";
}

function operatorRowTypeTone(rowType: ProgramRowType | null | undefined) {
  if (rowType === "AUTO") return "ui-badge-info";
  if (rowType === "CUSTOM") return "ui-badge-neutral";
  return "ui-badge-neutral";
}

const ProgramExerciseEditorRow = memo(function ProgramExerciseEditorRow({
  sessionId,
  exercise,
  publicTemplates,
  exerciseOptions,
  exerciseOptionsLoading,
  operatorStyle = false,
  highlighted = false,
  canMoveUp = false,
  canMoveDown = false,
  onPatch,
  onMove,
  onDelete,
  onDragStart,
  onDrop,
}: ProgramExerciseEditorRowProps) {
  const [exerciseQuery, setExerciseQuery] = useState(exercise.exerciseName);
  const deferredExerciseQuery = useDeferredValue(exerciseQuery);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(() => exercise.exerciseName.trim().length === 0);
  const exerciseInputRef = useRef<HTMLInputElement | null>(null);
  const lastResolvedExerciseNameRef = useRef(exercise.exerciseName.trim().toLowerCase());
  const circleActionButtonStyle = {
    width: "var(--touch-target)",
    height: "var(--touch-target)",
    minWidth: "var(--touch-target)",
    minHeight: "var(--touch-target)",
    padding: 0,
    aspectRatio: "1 / 1",
  } as const;

  useEffect(() => {
    const normalizedSelectedName = exercise.exerciseName.trim().toLowerCase();
    if (!normalizedSelectedName) return;
    const normalizedQuery = exerciseQuery.trim().toLowerCase();
    if (normalizedQuery === normalizedSelectedName) return;
    setExerciseQuery(exercise.exerciseName);
  }, [exercise.exerciseName, exerciseQuery]);

  const selectedExerciseOption = useMemo(() => {
    const normalizedSelectedName = exercise.exerciseName.trim().toLowerCase();
    if (!normalizedSelectedName) return null;
    const match = exerciseOptions.find((option) => option.name.trim().toLowerCase() === normalizedSelectedName);
    if (match) return match;
    return {
      id: `legacy:${exercise.exerciseName}`,
      name: exercise.exerciseName,
      category: null,
    } satisfies ExerciseOption;
  }, [exercise.exerciseName, exerciseOptions]);

  const filteredExerciseOptions = useMemo(() => {
    const normalizedQuery = deferredExerciseQuery.trim().toLowerCase();
    if (!normalizedQuery) return exerciseOptions.slice(0, 40);
    const filtered: ExerciseOption[] = [];
    for (const option of exerciseOptions) {
      const haystack = [option.name, option.category ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(normalizedQuery)) continue;
      filtered.push(option);
      if (filtered.length >= 40) break;
    }
    return filtered;
  }, [deferredExerciseQuery, exerciseOptions]);

  const operatorAutoRow = operatorStyle && isOperatorAutoRowType(exercise.rowType ?? null);
  const operatorAutoDefaults = useMemo(() => {
    if (!operatorAutoRow) return null;
    return resolveOperatorExerciseDefaults(exercise.exerciseName, exercise.rowType ?? "AUTO");
  }, [exercise.exerciseName, exercise.rowType, operatorAutoRow]);

  const selectExerciseOption = useCallback(
    (option: ExerciseOption | null) => {
      const nextExerciseName = option?.name ?? "";
      const inferredTarget = inferProgressionTargetFromExerciseName(nextExerciseName);
      onPatch(
        sessionId,
        exercise.id,
        operatorStyle && isOperatorAutoRowType(exercise.rowType ?? null)
          ? {
              exerciseName: nextExerciseName,
              progressionTarget: inferredTarget ?? exercise.progressionTarget ?? null,
              ...resolveOperatorExerciseDefaults(nextExerciseName, exercise.rowType ?? "AUTO"),
            }
          : { exerciseName: nextExerciseName },
      );
      setExerciseQuery(option?.name ?? "");
      exerciseInputRef.current?.blur();
      setExercisePickerOpen(!option);
    },
    [exercise.id, exercise.progressionTarget, exercise.rowType, onPatch, operatorStyle, sessionId],
  );

  useEffect(() => {
    const normalizedExerciseName = exercise.exerciseName.trim().toLowerCase();
    if (!normalizedExerciseName) {
      lastResolvedExerciseNameRef.current = "";
      setExercisePickerOpen(true);
      return;
    }
    if (lastResolvedExerciseNameRef.current !== normalizedExerciseName) {
      lastResolvedExerciseNameRef.current = normalizedExerciseName;
      setExercisePickerOpen(false);
    }
  }, [exercise.exerciseName]);

  useEffect(() => {
    if (!exercisePickerOpen) return;
    const frame = window.requestAnimationFrame(() => {
      exerciseInputRef.current?.focus();
      exerciseInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [exercisePickerOpen]);

  return (
    <article
      className={`workout-set-card grid gap-2 transition-[box-shadow,border-color,background-color] duration-300 ${
        highlighted
          ? "border-[var(--accent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--bg-elevated))] shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
          : ""
      }`}
      draggable
      onDragStart={() => onDragStart(sessionId, exercise.id)}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(sessionId, exercise.id);
      }}
    >
      <div className="program-store-row-head">
        <div className="flex items-center gap-2">
          {operatorStyle ? (
            <>
              <span className={`ui-badge ${operatorRowTypeTone(exercise.rowType)}`}>
                {operatorRowTypeLabel(exercise.rowType)}
              </span>
              {operatorAutoRow && exercise.progressionTarget ? (
                <span className="ui-badge ui-badge-neutral">{progressionTargetLabel(exercise.progressionTarget)}</span>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="haptic-tap flex shrink-0 items-center justify-center rounded-full border bg-[color:color-mix(in_srgb,var(--bg-surface)_74%,transparent)] text-[var(--text-secondary)] shadow-[0_8px_18px_-16px_color-mix(in_srgb,#000000_45%,transparent)] disabled:cursor-default disabled:opacity-35"
            style={circleActionButtonStyle}
            aria-label="운동 위로 이동"
            title="운동 위로 이동"
            onClick={() => onMove(sessionId, exercise.id, "up")}
            disabled={!canMoveUp}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-5.5 w-5.5" aria-hidden="true">
              <path d="m6.75 14.25 5.25-5.25 5.25 5.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="haptic-tap flex shrink-0 items-center justify-center rounded-full border bg-[color:color-mix(in_srgb,var(--bg-surface)_74%,transparent)] text-[var(--text-secondary)] shadow-[0_8px_18px_-16px_color-mix(in_srgb,#000000_45%,transparent)] disabled:cursor-default disabled:opacity-35"
            style={circleActionButtonStyle}
            aria-label="운동 아래로 이동"
            title="운동 아래로 이동"
            onClick={() => onMove(sessionId, exercise.id, "down")}
            disabled={!canMoveDown}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-5.5 w-5.5" aria-hidden="true">
              <path d="m6.75 9.75 5.25 5.25 5.25-5.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="haptic-tap flex shrink-0 items-center justify-center rounded-full border bg-[color:color-mix(in_srgb,var(--bg-surface)_74%,transparent)] text-[var(--color-warning)] shadow-[0_8px_18px_-16px_color-mix(in_srgb,#000000_45%,transparent)]"
            style={circleActionButtonStyle}
            aria-label="운동 삭제"
            title="운동 삭제"
            onClick={() => onDelete(sessionId, exercise.id)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" className="h-6 w-6" aria-hidden="true">
              <path d="M4.5 7.5h15" strokeLinecap="round" />
              <path d="M9.75 3.75h4.5" strokeLinecap="round" />
              <path d="M7.5 7.5v10.5A1.5 1.5 0 0 0 9 19.5h6a1.5 1.5 0 0 0 1.5-1.5V7.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.5 10.5v5.25" strokeLinecap="round" />
              <path d="M13.5 10.5v5.25" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid gap-1">
        <span className="ui-card-label">운동종목</span>
        <div className="workout-combobox" data-no-swipe="true">
          {selectedExerciseOption && !exercisePickerOpen ? (
            <button
              type="button"
              className="haptic-tap flex items-center justify-between gap-3 rounded-[0.9rem] border border-[color:color-mix(in_srgb,var(--accent-primary)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-primary)_13%,transparent)] px-3 py-3 text-left"
              onClick={() => {
                setExerciseQuery(selectedExerciseOption.name);
                setExercisePickerOpen(true);
              }}
            >
              <strong className="min-w-0 truncate text-[0.96rem] text-[var(--text-primary)]">
                {formatExerciseOptionLabel(selectedExerciseOption)}
              </strong>
              <span className="rounded-full border border-[color:color-mix(in_srgb,var(--accent-primary)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--bg-surface)_68%,transparent)] px-3 py-1 text-[0.78rem] font-semibold text-[color:color-mix(in_srgb,var(--accent-primary)_88%,var(--text-primary))]">
                변경
              </span>
            </button>
          ) : (
            <>
              <div className="app-search-shell">
                <span className="app-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.8-3.8" />
                  </svg>
                </span>
                <input
                  ref={exerciseInputRef}
                  type="search"
                  inputMode="search"
                  className="app-search-input"
                  value={exerciseQuery}
                  placeholder={exerciseOptionsLoading && exerciseOptions.length === 0 ? "운동종목 로딩 중..." : "운동종목 검색"}
                  onChange={(event) => {
                    const nextQuery = event.target.value;
                    setExerciseQuery(nextQuery);
                    const normalizedQuery = nextQuery.trim().toLowerCase();
                    const normalizedSelectedName = exercise.exerciseName.trim().toLowerCase();
                    if (!normalizedSelectedName) return;
                    if (normalizedQuery === normalizedSelectedName) return;
                    onPatch(sessionId, exercise.id, { exerciseName: "" });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    const first = filteredExerciseOptions[0] ?? null;
                    if (!first) return;
                    selectExerciseOption(first);
                  }}
                />
                {exerciseQuery.trim().length > 0 ? (
                  <button
                    type="button"
                    className="app-search-clear"
                    aria-label="검색어 지우기"
                    onClick={() => {
                      setExerciseQuery("");
                      onPatch(sessionId, exercise.id, { exerciseName: "" });
                      setExercisePickerOpen(true);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>

              <div className="workout-combobox-panel" role="listbox" aria-label="운동종목 검색 결과">
                {exerciseOptionsLoading ? (
                  <span className="workout-combobox-empty">검색 중...</span>
                ) : filteredExerciseOptions.length === 0 ? (
                  <span className="workout-combobox-empty">검색 조건에 맞는 운동종목이 없습니다.</span>
                ) : (
                  filteredExerciseOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`haptic-tap workout-combobox-option${
                        exercise.exerciseName.trim().toLowerCase() === option.name.trim().toLowerCase() ? " is-active" : ""
                      }`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => {
                        selectExerciseOption(option);
                      }}
                    >
                      {formatExerciseOptionLabel(option)}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {!operatorStyle ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="ui-card-label">수행 방식</span>
            <AppSelect
              variant="workout"
              value={exercise.mode}
              onChange={(event) =>
                onPatch(sessionId, exercise.id, {
                  mode: event.target.value === "MARKET" ? "MARKET" : "MANUAL",
                  marketTemplateSlug: event.target.value === "MARKET" ? exercise.marketTemplateSlug : null,
                })
              }
            >
              <option value="MARKET">시중 프로그램 기반</option>
              <option value="MANUAL">완전 수동</option>
            </AppSelect>
          </label>

          {exercise.mode === "MARKET" && (
            <label className="grid gap-1">
              <span className="ui-card-label">기반 프로그램</span>
              <AppSelect
                variant="workout"
                value={exercise.marketTemplateSlug ?? ""}
                onChange={(event) => onPatch(sessionId, exercise.id, { marketTemplateSlug: event.target.value || null })}
              >
                <option value="">선택</option>
                {publicTemplates.map((template) => (
                  <option key={template.id} value={template.slug}>
                    {formatProgramDisplayName(template.name)}
                  </option>
                ))}
              </AppSelect>
            </label>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          <label className="grid gap-1">
            <span className="ui-card-label">행 타입</span>
            <AppSelect
              variant="workout"
              value={exercise.rowType ?? "CUSTOM"}
              onChange={(event) => {
                const nextValue = String(event.target.value ?? "").trim().toUpperCase();
                const nextRowType: ProgramRowType = nextValue === "AUTO" ? "AUTO" : "CUSTOM";
                const inferredTarget =
                  nextRowType === "AUTO" ? inferProgressionTargetFromExerciseName(exercise.exerciseName) : null;
                onPatch(
                  sessionId,
                  exercise.id,
                  isOperatorAutoRowType(nextRowType)
                    ? {
                        rowType: nextRowType,
                        progressionTarget: inferredTarget ?? exercise.progressionTarget ?? null,
                        ...resolveOperatorExerciseDefaults(exercise.exerciseName, nextRowType),
                      }
                    : { rowType: nextRowType, progressionTarget: null },
                );
              }}
            >
              <option value="AUTO">Auto</option>
              <option value="CUSTOM">Custom</option>
            </AppSelect>
          </label>
          {operatorAutoRow ? (
            <label className="grid gap-1">
              <span className="ui-card-label">진행 타겟</span>
              <AppSelect
                variant="workout"
                value={exercise.progressionTarget ?? ""}
                onChange={(event) =>
                  onPatch(sessionId, exercise.id, {
                    progressionTarget: (String(event.target.value ?? "").trim().toUpperCase() || null) as ProgramProgressionTarget | null,
                  })
                }
              >
                <option value="">선택</option>
                <option value="SQUAT">Squat</option>
                <option value="BENCH">Bench</option>
                <option value="DEADLIFT">Deadlift</option>
                <option value="PULL">Pull</option>
                <option value="OHP">OHP</option>
              </AppSelect>
            </label>
          ) : null}
          <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-[var(--text-secondary)]">
            {operatorRowTypeHelp(exercise.rowType)}
          </div>
          {operatorAutoDefaults ? (
            <div className="rounded-lg border px-3 py-2 text-sm text-[var(--text-secondary)]">
              Operator 자동 설정: <strong className="text-[var(--text-primary)]">{operatorAutoDefaults.sets}세트 x {operatorAutoDefaults.reps}회</strong>
            </div>
          ) : null}
        </div>
      )}

      {!operatorAutoRow ? (
        <div className="grid grid-cols-2 gap-2">
          <AppNumberStepper label="세트" value={exercise.sets} min={1} max={50} step={1} onChange={(next) => onPatch(sessionId, exercise.id, { sets: next })} />
          <AppNumberStepper label="횟수" value={exercise.reps} min={1} max={100} step={1} onChange={(next) => onPatch(sessionId, exercise.id, { reps: next })} />
        </div>
      ) : null}

      <label className="grid gap-1">
        <span className="ui-card-label">메모</span>
        <AppTextInput variant="workout" value={exercise.note} onChange={(event) => onPatch(sessionId, exercise.id, { note: event.target.value })} placeholder="세션 메모" />
      </label>
    </article>
  );
});

export default ProgramExerciseEditorRow;
