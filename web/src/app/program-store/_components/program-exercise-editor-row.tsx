"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AppNumberStepper, AppPlusMinusIcon, AppSelect, AppTextInput } from "@/components/ui/form-controls";
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
  if (rowType === "AUTO") return "label label-program label-sm";
  if (rowType === "CUSTOM") return "label label-note label-sm";
  return "label label-note label-sm";
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
      draggable
      onDragStart={() => onDragStart(sessionId, exercise.id)}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(sessionId, exercise.id);
      }}
      style={{
        border: highlighted ? "1px solid var(--color-selected-border)" : "1px solid var(--color-border)",
        borderRadius: "10px",
        padding: "var(--space-sm)",
        background: highlighted ? "var(--color-selected-bg)" : "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        transition: "border-color 200ms ease, background-color 200ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-sm)" }}>
        <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
          {operatorStyle ? (
            <>
              <span className={operatorRowTypeTone(exercise.rowType)}>
                {operatorRowTypeLabel(exercise.rowType)}
              </span>
              {operatorAutoRow && exercise.progressionTarget ? (
                <span className="label label-program label-sm">{progressionTargetLabel(exercise.progressionTarget)}</span>
              ) : null}
            </>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: "var(--space-xs)" }}>
          <button
            type="button"
            className="btn btn-icon"
            aria-label="운동 위로 이동"
            title="운동 위로 이동"
            onClick={() => onMove(sessionId, exercise.id, "up")}
            disabled={!canMoveUp}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="m6.75 14.25 5.25-5.25 5.25 5.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-icon"
            aria-label="운동 아래로 이동"
            title="운동 아래로 이동"
            onClick={() => onMove(sessionId, exercise.id, "down")}
            disabled={!canMoveDown}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="m6.75 9.75 5.25 5.25 5.25-5.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-icon btn-icon-danger"
            aria-label="운동 삭제"
            title="운동 삭제"
            onClick={() => onDelete(sessionId, exercise.id)}
          >
            <AppPlusMinusIcon kind="minus" />
          </button>
        </div>
      </div>

      <div>
        <span style={{ display: "block", marginBottom: "var(--space-sm)", color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>운동종목</span>
        <div data-no-swipe="true">
          {selectedExerciseOption && !exercisePickerOpen ? (
            <button
              type="button"
              className="btn btn-secondary btn-full"
              style={{ justifyContent: "space-between" }}
              onClick={() => {
                setExerciseQuery(selectedExerciseOption.name);
                setExercisePickerOpen(true);
              }}
            >
              <strong>
                {formatExerciseOptionLabel(selectedExerciseOption)}
              </strong>
              <span>
                변경
              </span>
            </button>
          ) : (
            <>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    insetInlineStart: "0.82rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "0.9rem",
                    height: "0.9rem",
                    color: "var(--color-text-subtle)",
                    pointerEvents: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    focusable="false"
                    style={{ width: "100%", height: "100%", fill: "none", stroke: "currentColor", strokeWidth: "2" }}
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.8-3.8" />
                  </svg>
                </span>
                <AppTextInput
                  ref={exerciseInputRef}
                  variant="compact"
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  value={exerciseQuery}
                  style={{ paddingInlineStart: "2.15rem", paddingInlineEnd: exerciseQuery.trim().length > 0 ? "2.25rem" : "var(--space-md)" }}
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
                    aria-label="검색어 지우기"
                    style={{
                      position: "absolute",
                      insetInlineEnd: "0.55rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "24px",
                      height: "24px",
                      minHeight: "24px",
                      borderRadius: "999px",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface-secondary)",
                      color: "var(--color-text-muted)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      lineHeight: 0,
                    }}
                    onClick={() => {
                      setExerciseQuery("");
                      onPatch(sessionId, exercise.id, { exerciseName: "" });
                      setExercisePickerOpen(true);
                    }}
                  >
                    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                      <path d="M2 2 10 10" />
                      <path d="M10 2 2 10" />
                    </svg>
                  </button>
                ) : null}
              </div>

              <div
                role="listbox"
                aria-label="운동종목 검색 결과"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-xs)",
                  maxHeight: "200px",
                  overflowY: "auto",
                  paddingTop: "var(--space-sm)",
                }}
              >
                {exerciseOptionsLoading ? (
                  <span style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>검색 중...</span>
                ) : filteredExerciseOptions.length === 0 ? (
                  <span style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>검색 조건에 맞는 운동종목이 없습니다.</span>
                ) : (
                  filteredExerciseOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="btn btn-secondary btn-full"
                      style={{ justifyContent: "flex-start", minHeight: "40px" }}
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
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <span style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>수행 방식</span>
            <AppSelect
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
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <span style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>기반 프로그램</span>
              <AppSelect
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
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <span style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>행 타입</span>
            <AppSelect
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
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <span style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>진행 타겟</span>
              <AppSelect
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
          <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>
            {operatorRowTypeHelp(exercise.rowType)}
          </div>
          {operatorAutoDefaults ? (
            <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>
              Operator 자동 설정: <strong>{operatorAutoDefaults.sets}세트 x {operatorAutoDefaults.reps}회</strong>
            </div>
          ) : null}
        </div>
      )}

      {!operatorAutoRow ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <AppNumberStepper label="세트" value={exercise.sets} min={1} max={50} step={1} onChange={(next) => onPatch(sessionId, exercise.id, { sets: next })} />
          <AppNumberStepper label="횟수" value={exercise.reps} min={1} max={100} step={1} onChange={(next) => onPatch(sessionId, exercise.id, { reps: next })} />
        </div>
      ) : null}

      <label>
        <span style={{ display: "block", marginBottom: "var(--space-sm)", color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>메모</span>
        <AppTextInput variant="workout" value={exercise.note} onChange={(event) => onPatch(sessionId, exercise.id, { note: event.target.value })} placeholder="세션 메모" />
      </label>
    </article>
  );
});

export default ProgramExerciseEditorRow;
