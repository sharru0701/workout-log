"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PullToRefreshShell } from "@/components/pull-to-refresh-shell";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { FailureProtocolSheet, type FailureProtocolChoice } from "@/components/ui/failure-protocol-sheet";
import { Card, CardContent } from "@/components/ui/card";
import { SessionCard } from "@/components/ui/session-card";
import { PlanSelectorButton } from "@/components/ui/plan-selector-button";
import { AppPlusMinusIcon, AppTextarea } from "@/components/ui/form-controls";
import { NumberPickerSheet } from "@/components/ui/number-picker-sheet";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SearchSelectCombobox, SearchSelectSheet } from "@/components/ui/search-select-sheet";
import { EmptyStateRows, ErrorStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { computeExternalLoadFromTotalKg, formatKgValue, isBodyweightExerciseName } from "@/lib/bodyweight-load";
import { parseSessionKey } from "@/lib/session-key";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { useWorkoutRecordPersistence } from "@/lib/workout-record/useWorkoutRecordPersistence";
import { clearWorkoutDraft } from "@/lib/storage/workoutDraftStore";
import { fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import {
  computeBodyweightTotalLoadKg,
  readWorkoutPreferences,
  resolveMinimumPlateIncrement,
  resolveMinimumPlateIncrementKg,
  snapWeightToIncrementKg,
  toDefaultWorkoutPreferences,
  type WorkoutPreferences,
} from "@/lib/settings/workout-preferences";
import {
  prepareWorkoutRecordDraftForEntry,
  validateWorkoutRecordEntryState,
  type WorkoutProgramExerciseEntryState,
  type WorkoutProgramExerciseEntryStateMap,
} from "@/lib/workout-record/entry-state";
import {
  addUserExercise,
  createWorkoutRecordDraftFromLog,
  createWorkoutRecordDraft,
  materializeWorkoutExercises,
  patchSeedExercise,
  removeSeedExercise,
  removeUserExercise,
  toWorkoutLogPayload,
  updateUserExercise,
  validateWorkoutDraft,
  type ExistingWorkoutLogLike,
  type GeneratedSessionLike,
  type WorkoutExerciseViewModel,
  type WorkoutRecordDraft,
  type WorkoutWorkflowState,
} from "@/lib/workout-record/model";

type PlanItem = {
  id: string;
  name: string;
  params?: Record<string, unknown> | null;
  isArchived?: boolean;
};

type RecentLogItem = {
  id: string;
  performedAt: string;
  generatedSession?: {
    id: string;
    sessionKey: string;
  } | null;
  sets: Array<{
    exerciseName: string;
    reps: number | null;
    weightKg: number | null;
    meta?: unknown;
  }>;
};

type DetailedLogItem = ExistingWorkoutLogLike & {
  generatedSession: (ExistingWorkoutLogLike["generatedSession"] & { sessionKey: string; snapshot: any }) | null;
};

type ExerciseOption = {
  id: string;
  name: string;
  category: string | null;
  aliases: string[];
};

type GeneratedSessionResponse = {
  session: GeneratedSessionLike;
};

type PlansResponse = {
  items: PlanItem[];
};

type LogsResponse = {
  items: RecentLogItem[];
};

type LogDetailResponse = {
  item: DetailedLogItem;
};

type ExerciseResponse = {
  items: ExerciseOption[];
};

type QueryContext = {
  planId: string | null;
  date: string;
  hasExplicitDate: boolean;
  logId: string | null;
  openAdd: boolean;
};

type AddExerciseDraft = {
  exerciseId: string | null;
  exerciseName: string;
  weightKg: number;
  repsPerSet: number[];
  memo: string;
};

function createDefaultAddExerciseDraft(): AddExerciseDraft {
  return {
    exerciseId: null,
    exerciseName: "",
    weightKg: 0,
    repsPerSet: [5, 5, 5],
    memo: "",
  };
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readQueryContext(): QueryContext {
  if (typeof window === "undefined") {
    return {
      planId: null,
      date: toDateKey(new Date()),
      hasExplicitDate: false,
      logId: null,
      openAdd: false,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const planId = params.get("planId");
  const date = params.get("date");
  const logId = params.get("logId");
  return {
    planId: planId && planId.trim() ? planId : null,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toDateKey(new Date()),
    hasExplicitDate: Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date)),
    logId: logId && logId.trim() ? logId : null,
    openAdd: params.get("openAdd") === "1",
  };
}

function isDateOnlyString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysBetweenDateKeys(dateKey: string, startDateKey: string) {
  const dateMs = new Date(`${dateKey}T00:00:00Z`).getTime();
  const startMs = new Date(`${startDateKey}T00:00:00Z`).getTime();
  return Math.floor((dateMs - startMs) / 86_400_000);
}

function normalizeSchedule(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

function resolveLastSessionWeekAndType(
  log: RecentLogItem,
  planParams: Record<string, unknown> | null | undefined,
) {
  const parsedSession = log.generatedSession?.sessionKey
    ? parseSessionKey(log.generatedSession.sessionKey)
    : null;
  const schedule = normalizeSchedule(planParams?.schedule);
  const sessionsPerWeekRaw = Number(planParams?.sessionsPerWeek ?? 0);
  const sessionsPerWeek = Number.isFinite(sessionsPerWeekRaw) && sessionsPerWeekRaw > 0
    ? Math.max(1, Math.floor(sessionsPerWeekRaw))
    : Math.max(1, schedule.length || 1);

  let week = parsedSession?.week ?? null;
  let day = parsedSession?.day ?? null;

  if ((week === null || day === null) && isDateOnlyString(planParams?.startDate)) {
    const logDateKey = toDateKey(new Date(log.performedAt));
    const delta = daysBetweenDateKeys(logDateKey, planParams.startDate);
    if (delta >= 0) {
      week = Math.floor(delta / sessionsPerWeek) + 1;
      day = (delta % sessionsPerWeek) + 1;
    }
  }

  const weekLabel = week !== null ? `Week ${week}` : "-";
  let sessionLabel = "-";
  if (schedule.length > 0 && day !== null) {
    sessionLabel = schedule[(day - 1) % schedule.length] ?? schedule[0] ?? "-";
  } else if (day !== null) {
    sessionLabel = day <= 2 ? (["A", "B"][(day - 1) % 2] ?? "-") : `D${day}`;
  }

  return { weekLabel, sessionLabel };
}

function extractBodyweightKg(log: RecentLogItem, fallbackBodyweightKg: number | null): number | null {
  for (const set of log.sets) {
    const bodyweightKg = Number((set.meta as { bodyweightKg?: unknown } | null)?.bodyweightKg);
    if (Number.isFinite(bodyweightKg) && bodyweightKg > 0) {
      return bodyweightKg;
    }
  }
  return fallbackBodyweightKg;
}

function formatDateFriendly(isoOrDateKey: string) {
  const date = new Date(`${isoOrDateKey.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoOrDateKey;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function applyRecentWeightsToCustomExercises(
  draft: WorkoutRecordDraft,
  recentLogs: RecentLogItem[],
): WorkoutRecordDraft {
  const nextSeedExercises = draft.seedExercises.map((exercise) => {
    if (exercise.badge !== "CUSTOM" || exercise.set.weightKg > 0) return exercise;
    const name = exercise.exerciseName.toLowerCase();
    let foundWeight: number | null = null;
    outer: for (const log of recentLogs) {
      for (const set of log.sets) {
        if (
          set.exerciseName.toLowerCase() === name &&
          set.weightKg != null &&
          set.weightKg > 0
        ) {
          foundWeight = set.weightKg;
          break outer;
        }
      }
    }
    const weightKg = foundWeight ?? 50;
    return {
      ...exercise,
      set: {
        ...exercise.set,
        weightKg,
      },
    };
  });

  return {
    ...draft,
    seedExercises: nextSeedExercises,
  };
}

function buildLastSessionSummary(
  logs: RecentLogItem[],
  todayKey: string,
  planParams: Record<string, unknown> | null | undefined,
  fallbackBodyweightKg: number | null,
) {
  const selected = logs.find((entry) => toDateKey(new Date(entry.performedAt)) !== todayKey) ?? logs[0] ?? null;
  if (!selected) {
    return {
      dateLabel: null as string | null,
      weekLabel: "-",
      sessionLabel: "-",
      bodyweightKg: null as number | null,
      totalSets: 0,
      totalVolume: 0,
      exercises: [] as Array<{ name: string; sets: number; bestSet: string }>,
    };
  }

  const { weekLabel, sessionLabel } = resolveLastSessionWeekAndType(selected, planParams);

  let totalVolume = 0;
  const exerciseMap = new Map<string, { sets: number; bestWeight: number; bestReps: number }>();
  for (const set of selected.sets) {
    const w = set.weightKg ?? 0;
    const r = set.reps ?? 0;
    totalVolume += w * r;
    const name = set.exerciseName;
    const existing = exerciseMap.get(name);
    if (!existing) {
      exerciseMap.set(name, { sets: 1, bestWeight: w, bestReps: r });
    } else {
      existing.sets += 1;
      if (w > existing.bestWeight || (w === existing.bestWeight && r > existing.bestReps)) {
        existing.bestWeight = w;
        existing.bestReps = r;
      }
    }
  }

  const exercises = Array.from(exerciseMap.entries()).map(([name, data]) => ({
    name,
    sets: data.sets,
    bestSet:
      data.bestWeight > 0
        ? `${data.sets}x${data.bestReps} @ ${data.bestWeight}kg`
        : `${data.sets}x${data.bestReps}`,
  }));

  return {
    dateLabel: formatDateFriendly(toDateKey(new Date(selected.performedAt))),
    weekLabel,
    sessionLabel,
    bodyweightKg: extractBodyweightKg(selected, fallbackBodyweightKg),
    totalSets: selected.sets.length,
    totalVolume: Math.round(totalVolume),
    exercises,
  };
}

function workoutExerciseBadgeMeta(badge: WorkoutExerciseViewModel["badge"]) {
  if (badge === "AUTO") return { label: "계획", className: "label label-program label-sm" };
  if (badge === "CUSTOM") return { label: "사용자", className: "label label-note label-sm" };
  if (badge === "ADDED") return { label: "추가", className: "label label-exercise label-sm" };
  return null;
}

function clampReps(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeRepsPerSet(value: number[], fallback = 5) {
  if (!Array.isArray(value) || value.length === 0) {
    return [clampReps(fallback)];
  }
  return value.map((entry) => clampReps(entry)).slice(0, 50);
}

function patchSetRepsAtIndex(values: number[], index: number, nextReps: number) {
  const next = normalizeRepsPerSet(values);
  if (index < 0 || index >= next.length) return next;
  next[index] = clampReps(nextReps);
  return next;
}

function appendSetReps(values: number[]) {
  const next = normalizeRepsPerSet(values);
  const last = next[next.length - 1] ?? 5;
  if (next.length >= 50) return next;
  return [...next, last];
}


function removeSetRepsAtIndex(values: number[], index: number) {
  const next = normalizeRepsPerSet(values);
  if (next.length <= 1) return next;
  if (index < 0 || index >= next.length) return next;
  return [...next.slice(0, index), ...next.slice(index + 1)];
}


function createFallbackProgramEntryState(
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: "1.1rem", height: "1.1rem" }}
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function FailureIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: "1.1rem", height: "1.1rem" }}
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function WorkoutRecordInlinePicker({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  sheetTitle,
  complete = false,
  failed = false,
  color,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  sheetTitle?: string;
  complete?: boolean;
  failed?: boolean;
  color?: string;
}) {
  const [open, setOpen] = useState(false);
  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <div style={{ display: "flex", width: "100%", justifyContent: "center" }}>
      <button
        type="button"
        className="workout-record-picker-btn"
        style={{
          width: "100%",
          padding: "6px 4px",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          backgroundColor: failed
            ? "color-mix(in srgb, var(--color-danger) 25%, var(--color-surface))"
            : complete
              ? color === "var(--text-metric-reps)"
                ? "var(--color-success-weak)"
                : "color-mix(in srgb, var(--color-success) 18%, var(--color-surface))"
              : "transparent",
          color: failed
            ? "var(--color-danger-strong)"
            : complete
              ? color === "var(--text-metric-reps)"
                ? "var(--color-success-strong)"
                : "var(--color-text)"
              : color || "var(--color-text-muted)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "22px",
          fontWeight: 700,
          letterSpacing: "-0.5px",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          minHeight: "44px",
        }}
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${displayValue}`}
      >
        <span>{displayValue}</span>
      </button>
      <NumberPickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={sheetTitle ?? label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        formatValue={formatValue}
      />
    </div>
  );
}

function SwipeableSetRow({
  children,
  onDelete,
  disabled
}: {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const currentXRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !isDragging || startXRef.current === null) return;
    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;
    if (diff < 0) {
      setOffsetX(Math.max(diff, -44));
    } else if (offsetX < 0) {
      setOffsetX(Math.min(0, offsetX + diff));
      startXRef.current = currentXRef.current;
    } else {
      setOffsetX(0);
    }
  };

  const handleTouchEnd = () => {
    if (disabled) return;
    setIsDragging(false);
    if (offsetX < -22) {
      setOffsetX(-44);
    } else {
      setOffsetX(0);
    }
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: "6px", marginBottom: "var(--space-xs)" }}>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setOffsetX(0);
            onDelete();
          }}
          style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-danger)", backgroundColor: "transparent", border: "none", boxShadow: "none", cursor: "pointer" }}
          aria-label="세트 삭제"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "22px", height: "22px" }}>
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)",
          backgroundColor: "var(--color-surface)",
          borderRadius: "6px",
          position: "relative",
          zIndex: 1,
          touchAction: "pan-y",
          padding: "2px 0",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ExerciseRow({
  exercise,
  minimumPlateIncrementKg,
  showMinimumPlateInfo,
  bodyweightKg,
  programEntryState,
  prevPerformance,
  onChangeWeight,
  onChangeSetReps,
  onAddSet,
  onRemoveSet,
  onChangeMemo,
  onDelete,
}: {
  exercise: WorkoutExerciseViewModel;
  minimumPlateIncrementKg: number;
  showMinimumPlateInfo: boolean;
  bodyweightKg: number | null;
  programEntryState?: WorkoutProgramExerciseEntryState;
  prevPerformance?: string;
  onChangeWeight: (value: number) => void;
  onChangeSetReps: (setIndex: number, value: number) => void;
  onAddSet: () => void;
  onRemoveSet: (index: number) => void;
  onChangeMemo: (value: string) => void;
  onDelete: () => void;
}) {
  const totalLoadKg = computeBodyweightTotalLoadKg(exercise.exerciseName, exercise.set.weightKg, bodyweightKg);
  const isBodyweightExercise = isBodyweightExerciseName(exercise.exerciseName);
  const badgeMeta = workoutExerciseBadgeMeta(exercise.badge);
  const usesProgramPlaceholders = Boolean(programEntryState);
  const weightStepMeta = `${formatKgValue(minimumPlateIncrementKg)} 단위`;
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
    <article className="exercise-card" aria-label={`운동종목 ${exercise.exerciseName}`}>
      {/* ── Exercise Header ── */}
      <div className="exercise-card__header">
        <div className="exercise-card__name-row">
          <strong className="exercise-card__name">{exercise.exerciseName}</strong>
          {badgeMeta ? (
            <span className={badgeMeta.className}>{badgeMeta.label}</span>
          ) : null}
        </div>
        <div className="exercise-card__header-actions">
          {prevPerformance ? (
            <span className="exercise-card__prev-ref" title="이전 최고 기록">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "10px", height: "10px" }}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              {prevPerformance}
            </span>
          ) : null}
          {exercise.badge !== "AUTO" ? (
            <button
              type="button"
              className="btn btn-icon btn-icon-danger"
              aria-label="운동 삭제"
              title="운동 삭제"
              onClick={onDelete}
            >
              <AppPlusMinusIcon kind="minus" />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Set Table ── */}
      <div className="set-table">
        <div className="set-table__header" aria-hidden="true">
          <span className="set-table__h-set">Set</span>
          <span className="set-table__h-weight">Weight</span>
          <span className="set-table__h-reps">Reps</span>
          <span className="set-table__h-done">✓</span>
        </div>

        <div role="list" aria-label={`${exercise.exerciseName} 세트 편집`}>
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
                disabled={usesProgramPlaceholders
                  ? index < (programEntryState?.plannedRepsPerSet?.length ?? exercise.set.repsPerSet.length)
                  : exercise.set.repsPerSet.length <= 1}
                onDelete={() => onRemoveSet(index)}
              >
                <div role="listitem" className={rowClass}>
                  <span className="set-row__number">{index + 1}</span>
                  <WorkoutRecordInlinePicker
                    label={`${index + 1}세트 무게`}
                    value={resolvedRowWeightKg}
                    min={0}
                    max={1000}
                    step={minimumPlateIncrementKg}
                    formatValue={(value) => formatCompactWeightValue(value, minimumPlateIncrementKg)}
                    color="var(--text-metric-weight)"
                    complete={isSetComplete}
                    failed={isFailure}
                    onChange={onChangeWeight}
                  />
                  <WorkoutRecordInlinePicker
                    label={`${index + 1}세트 횟수`}
                    value={setReps}
                    min={0}
                    max={100}
                    step={1}
                    complete={isSetComplete}
                    failed={isFailure}
                    formatValue={(value) => String(Math.round(value))}
                    color="var(--text-metric-reps)"
                    onChange={(value) => onChangeSetReps(index, value)}
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

      {/* ── Add Set ── */}
      <button
        type="button"
        className="set-add-btn"
        onClick={onAddSet}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        세트 추가
      </button>

      {/* ── Hint Footer ── */}
      {(showMinimumPlateInfo || (isBodyweightExercise && bodyweightKg)) ? (
        <div className="set-hint">
          {showMinimumPlateInfo ? (
            <span className="set-hint__item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              {weightStepMeta}로 입력됩니다.
            </span>
          ) : null}
          {isBodyweightExercise && bodyweightKg ? (
            <span className="set-hint__item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              총하중 기준: {formatKgValue(totalLoadKg)}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* ── Memo ── */}
      <label style={{ display: "block", padding: "0 var(--space-md) var(--space-md)" }}>
        <AppTextarea
          variant="workout"
          value={usesProgramPlaceholders ? (programEntryState?.memoInput ?? "") : exercise.note.memo}
          onChange={(event) => onChangeMemo(event.target.value)}
          placeholder={usesProgramPlaceholders ? programEntryState?.memoPlaceholder || "세트 메모를 입력하세요." : "세트 메모를 입력하세요."}
        />
      </label>
    </article>
  );
}

// --- 프로그레션 프로토콜 헬퍼 ---

type ProgressionTargetStateSnapshot = {
  workKg: number;
  failureStreak: number;
  successStreak: number;
};

type ProgressionRuntimeStateSnapshot = {
  cycle: number;
  week: number;
  day: number;
  targets: Record<string, ProgressionTargetStateSnapshot>;
};

type FailedProgressionExercise = {
  exerciseName: string;
  target: string;
};

function mapExerciseNameToProgressionTarget(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (n.includes("squat")) return "SQUAT";
  if (n.includes("bench")) return "BENCH";
  if (n.includes("deadlift")) return "DEADLIFT";
  if (n.includes("overhead press") || n === "ohp" || n.includes("shoulder press")) return "OHP";
  if (n.includes("row") || n.includes("pull-up") || n.includes("pull up") || n.includes("pulldown")) return "PULL";
  return null;
}

function detectFailedProgressionExercises(
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

// Operator 블록 완료 모달 메시지 (6주 사이클)
function buildOperatorBlockCompletionMessage(state: ProgressionRuntimeStateSnapshot | null): string {
  const lines: string[] = ["6주 블록을 완료했습니다.", "다음 사이클에 적용할 무게를 선택하세요.", ""];
  if (state) {
    const hadFailure = Object.values(state.targets).some((t) => t.failureStreak > 0);
    if (hadFailure) {
      lines.push("이번 블록에서 실패가 있었습니다.");
      lines.push("");
    }
    const targetLabels: Record<string, string> = {
      SQUAT: "스쿼트", BENCH: "벤치프레스", DEADLIFT: "데드리프트", OHP: "오버헤드프레스", PULL: "풀",
    };
    for (const [key, t] of Object.entries(state.targets)) {
      if (t.workKg <= 0) continue;
      const label = targetLabels[key] ?? key;
      const increaseKg = key === "DEADLIFT" ? 5 : 2.5;
      const resetKg = Math.round((t.workKg * 0.95) / 2.5) * 2.5;
      lines.push(`• ${label}: ${t.workKg}kg`);
      lines.push(`  증량 → ${t.workKg + increaseKg}kg / 유지 → ${t.workKg}kg / 감소 → ${resetKg}kg`);
    }
  }
  return lines.join("\n");
}

// 5/3/1 블록 완료 모달 메시지 (4주 사이클)
function build531BlockCompletionMessage(state: ProgressionRuntimeStateSnapshot | null): string {
  const lines: string[] = ["4주 사이클을 완료했습니다.", "다음 사이클에 적용할 트레이닝 맥스를 선택하세요.", ""];
  if (state) {
    const hadFailure = Object.values(state.targets).some((t) => t.failureStreak > 0);
    if (hadFailure) {
      lines.push("이번 사이클에서 실패한 세트가 있었습니다.");
      lines.push("");
    }
    const targetLabels: Record<string, string> = {
      SQUAT: "스쿼트", BENCH: "벤치프레스", DEADLIFT: "데드리프트", OHP: "오버헤드프레스",
    };
    for (const [key, t] of Object.entries(state.targets)) {
      if (t.workKg <= 0) continue;
      const label = targetLabels[key] ?? key;
      // 5/3/1: 하체(스쿼트·데드리프트) +5kg, 상체(벤치·오버헤드) +2.5kg
      const increaseKg = key === "DEADLIFT" || key === "SQUAT" ? 5 : 2.5;
      const resetKg = Math.round((t.workKg * 0.9) / 2.5) * 2.5;
      lines.push(`• ${label}: ${t.workKg}kg`);
      lines.push(`  증량(+${increaseKg}kg) → ${t.workKg + increaseKg}kg / 유지 → ${t.workKg}kg / 감소(10%) → ${resetKg}kg`);
    }
  }
  return lines.join("\n");
}

// 연속 실패 리셋 모달 메시지 (Greyskull, Starting Strength, StrongLifts, GZCLP 등)
function buildResetProtocolMessage(
  failures: FailedProgressionExercise[],
  state: ProgressionRuntimeStateSnapshot | null,
  resetFactor: number,
): string {
  const pct = Math.round((1 - resetFactor) * 100);
  const lines: string[] = [`3회 연속 실패 기준에 도달했습니다.`, ""];
  for (const f of failures) {
    const workKg = state?.targets[f.target]?.workKg ?? null;
    if (workKg !== null) {
      const resetKg = Math.round((workKg * resetFactor) / 2.5) * 2.5;
      const increaseKg = f.target === "DEADLIFT" ? 5 : 2.5;
      lines.push(`• ${f.exerciseName}: ${workKg}kg`);
      lines.push(`  감소(${pct}%) → ${resetKg}kg / 유지 → ${workKg}kg / 증량 → ${workKg + increaseKg}kg`);
    } else {
      lines.push(`• ${f.exerciseName}`);
    }
  }
  return lines.join("\n");
}

export default function WorkoutRecordPage() {
  const router = useRouter();
  const { alert, confirm } = useAppDialog();
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const [query, setQuery] = useState<QueryContext>(() => readQueryContext());
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState(() => {
    const q = readQueryContext();
    return q.planId || "";
  });
  const isRestoredRef = useRef(false);
  const isRestoringRef = useRef(false);
  const persistenceKeyRef = useRef<string | null>(null);
  const reloadDraftContextRef = useRef<(() => Promise<void>) | null>(null);
  const [draft, setDraft] = useState<WorkoutRecordDraft | null>(null);
  const [recentLogItems, setRecentLogItems] = useState<RecentLogItem[]>([]);
  const [lastSession, setLastSession] = useState<{
    dateLabel: string | null;
    weekLabel: string;
    sessionLabel: string;
    bodyweightKg: number | null;
    totalSets: number;
    totalVolume: number;
    exercises: Array<{ name: string; sets: number; bestSet: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [plansLoadKey, setPlansLoadKey] = useState("workout-record:init");
  const [error, setError] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkoutWorkflowState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [planQuery, setPlanQuery] = useState("");

  const [failureProtocolSheet, setFailureProtocolSheet] = useState<{
    title: string;
    message: string;
    mode: "block-completion" | "greyskull-reset";
  } | null>(null);
  const failureProtocolResolveRef = useRef<((choice: FailureProtocolChoice) => void) | null>(null);

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [exerciseOptionsLoading, setExerciseOptionsLoading] = useState(false);
  const [exerciseOptionsError, setExerciseOptionsError] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState<AddExerciseDraft>(createDefaultAddExerciseDraft);
  const [programEntryState, setProgramEntryState] = useState<WorkoutProgramExerciseEntryStateMap>({});
  const [workoutPreferences, setWorkoutPreferences] = useState<WorkoutPreferences>(toDefaultWorkoutPreferences);

  const persistenceKey = selectedPlanId && query.date ? `${selectedPlanId}:${query.date}` : null;
  useEffect(() => {
    persistenceKeyRef.current = persistenceKey;
    // 플랜이나 날짜가 바뀌면 이전 복구 상태는 더 이상 유효하지 않음
    isRestoredRef.current = false;
  }, [persistenceKey]);

  const { cancelPendingSave, resetRestoreState } = useWorkoutRecordPersistence(
    persistenceKey,
    draft,
    programEntryState,
    useCallback(async (data) => {
      console.log("[WorkoutRecordPage] onRestore called", data);
      // loadWorkoutContext가 복구 데이터를 덮어쓰지 못하도록 먼저 플래그 설정
      // setDraft는 확인 후에만 호출 → 자동저장 디바운스 누수 방지
      isRestoredRef.current = true;
      isRestoringRef.current = true;

      const capturedKey = persistenceKeyRef.current;

      try {
        await new Promise((resolve) => setTimeout(resolve, 150));
        console.log("[WorkoutRecordPage] Showing restore confirm");
        const shouldKeep = await confirm({
          title: "기록 복구",
          message: "이전에 입력 중이던 기록을 불러왔습니다.",
          confirmText: "복구",
          cancelText: "삭제",
          closeAsConfirm: true,
        });

        if (shouldKeep) {
          setDraft(data.draft);
          setProgramEntryState(data.programEntryState);
          setWorkflowState("editing"); // 복구 후 PTR 시 확인 모달이 뜨도록
          return true;
        }

        isRestoredRef.current = false;
        if (capturedKey) await clearWorkoutDraft(capturedKey);
        await reloadDraftContextRef.current?.();
        return false;
      } finally {
        isRestoringRef.current = false;
      }
    }, [confirm]),
    { enabled: true } // 즉시 복구 시도
  );

  const selectedPlan = useMemo(
    () => plans.find((entry) => entry.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );
  const orderedPlans = useMemo(() => {
    if (!selectedPlan) return plans;
    return [selectedPlan, ...plans.filter((entry) => entry.id !== selectedPlan.id)];
  }, [plans, selectedPlan]);
  const filteredPlans = useMemo(() => {
    const normalizedQuery = planQuery.trim().toLowerCase();
    if (!normalizedQuery) return orderedPlans;
    return orderedPlans.filter((plan) => plan.name.toLowerCase().includes(normalizedQuery));
  }, [orderedPlans, planQuery]);

  const resolveWeightWithPreferences = useCallback(
    (
      weightKg: number,
      exerciseId: string | null | undefined,
      exerciseName: string,
      preferences: WorkoutPreferences,
    ) => {
      const increment = resolveMinimumPlateIncrementKg(preferences, {
        exerciseId: exerciseId ?? null,
        exerciseName,
      });
      return snapWeightToIncrementKg(Math.max(0, weightKg), increment);
    },
    [],
  );

  const resolveWeightWithCurrentPreferences = useCallback(
    (weightKg: number, exerciseId: string | null | undefined, exerciseName: string) =>
      resolveWeightWithPreferences(weightKg, exerciseId, exerciseName, workoutPreferences),
    [resolveWeightWithPreferences, workoutPreferences],
  );

  const applyWeightRulesToDraft = useCallback(
    (
      sourceDraft: WorkoutRecordDraft,
      preferences: WorkoutPreferences,
    ) => {
      return {
        ...sourceDraft,
        seedExercises: sourceDraft.seedExercises.map((exercise) => ({
          ...exercise,
          set: {
            ...exercise.set,
            weightKg: resolveWeightWithPreferences(
              computeExternalLoadFromTotalKg(
                exercise.exerciseName,
                typeof exercise.prescribedWeightKg === "number"
                  ? exercise.prescribedWeightKg
                  : exercise.set.weightKg,
                preferences.bodyweightKg,
              ) ??
                (typeof exercise.prescribedWeightKg === "number"
                  ? exercise.prescribedWeightKg
                  : exercise.set.weightKg),
              exercise.exerciseId,
              exercise.exerciseName,
              preferences,
            ),
          },
        })),
        userExercises: sourceDraft.userExercises.map((exercise) => ({
          ...exercise,
          set: {
            ...exercise.set,
            weightKg: resolveWeightWithPreferences(
              exercise.set.weightKg,
              exercise.exerciseId,
              exercise.exerciseName,
              preferences,
            ),
          },
        })),
      };
    },
    [resolveWeightWithPreferences],
  );

  const visibleExercises = useMemo(() => (draft ? materializeWorkoutExercises(draft) : []), [draft]);

  // Previous performance map: exercise name → "Xkg × Y" best set from most recent log
  const prevPerformanceMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const log of recentLogItems) {
      const best = new Map<string, { weight: number; reps: number }>();
      for (const set of log.sets) {
        const w = set.weightKg ?? 0;
        const r = set.reps ?? 0;
        const existing = best.get(set.exerciseName);
        if (!existing || w > existing.weight || (w === existing.weight && r > existing.reps)) {
          best.set(set.exerciseName, { weight: w, reps: r });
        }
      }
      for (const [name, data] of best.entries()) {
        if (!map[name]) {
          map[name] = data.weight > 0
            ? `${formatKgValue(data.weight)} × ${data.reps}`
            : `${data.reps}회`;
        }
      }
    }
    return map;
  }, [recentLogItems]);

  // Count exercises with at least one completed set for the progress chip
  const completedExercisesCount = useMemo(() => {
    return visibleExercises.filter((exercise) => {
      return exercise.set.repsPerSet.some((setReps, i) => {
        const entryState = programEntryState[exercise.id];
        const rawVal = entryState?.repsInputs[i]?.trim() ?? "";
        const actual = exercise.source === "PROGRAM" ? Number(rawVal) : setReps;
        return Number.isFinite(actual) && actual > 0;
      });
    }).length;
  }, [visibleExercises, programEntryState]);
  const addDraftIncrementKg = useMemo(
    () =>
      resolveMinimumPlateIncrementKg(workoutPreferences, {
        exerciseId: addDraft.exerciseId,
        exerciseName: addDraft.exerciseName,
      }),
    [addDraft.exerciseId, addDraft.exerciseName, workoutPreferences],
  );
  const addDraftIncrementInfo = useMemo(
    () =>
      resolveMinimumPlateIncrement(workoutPreferences, {
        exerciseId: addDraft.exerciseId,
        exerciseName: addDraft.exerciseName,
      }),
    [addDraft.exerciseId, addDraft.exerciseName, workoutPreferences],
  );
  const filteredExerciseOptions = useMemo(() => {
    const queryLower = exerciseQuery.trim().toLowerCase();
    if (!queryLower) return exerciseOptions;
    return exerciseOptions.filter((option) => {
      const aliasMatched = option.aliases.some((alias) => alias.toLowerCase().includes(queryLower));
      return (
        option.name.toLowerCase().includes(queryLower) ||
        (option.category ?? "").toLowerCase().includes(queryLower) ||
        aliasMatched
      );
    });
  }, [exerciseOptions, exerciseQuery]);
  const selectedExerciseOption = useMemo(
    () =>
      addDraft.exerciseId
        ? exerciseOptions.find((option) => option.id === addDraft.exerciseId) ?? null
        : null,
    [addDraft.exerciseId, exerciseOptions],
  );
  const addDraftTotalLoadKg = useMemo(
    () =>
      computeBodyweightTotalLoadKg(
        addDraft.exerciseName,
        addDraft.weightKg,
        workoutPreferences.bodyweightKg,
      ),
    [addDraft.exerciseName, addDraft.weightKg, workoutPreferences.bodyweightKg],
  );

  const applyEditing = useCallback((updater: (prev: WorkoutRecordDraft) => WorkoutRecordDraft) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
    setWorkflowState((prev) => (prev === "saving" ? prev : "editing"));
  }, []);

  const loadExerciseOptions = useCallback(async (queryValue: string) => {
    try {
      setExerciseOptionsLoading(true);
      setExerciseOptionsError(null);
      const params = new URLSearchParams({ limit: "40" });
      if (queryValue.trim()) {
        params.set("query", queryValue.trim());
      }
      const res = await apiGet<ExerciseResponse>(`/api/exercises?${params.toString()}`);
      setExerciseOptions(res.items ?? []);
    } catch (e: any) {
      setExerciseOptionsError(e?.message ?? "운동종목 목록을 불러오지 못했습니다.");
    } finally {
      setExerciseOptionsLoading(false);
    }
  }, []);

  type LoadWorkoutContextInput = {
    planId: string;
    planName: string;
    dateKey: string;
    preferences: WorkoutPreferences;
    planAutoProgression?: boolean;
    planSchedule?: unknown;
    planParams?: Record<string, unknown> | null;
    logId?: string | null;
    initialLog?: DetailedLogItem | null;
    isRefresh?: boolean;
  };

  const contextHasLoadedRef = useRef(false);

  const loadWorkoutContext = useCallback(
    async (
      input: LoadWorkoutContextInput,
    ) => {
      try {
        if (!contextHasLoadedRef.current && !input.isRefresh) setLoading(true);
        setError(null);
        setSaveError(null);
        const recentLogsPath = input.planId
          ? `/api/logs?planId=${encodeURIComponent(input.planId)}&limit=6`
          : "/api/logs?limit=6";

        if (input.logId) {
          const [logRes, logsRes] = await Promise.all([
            input.initialLog
              ? Promise.resolve({ item: input.initialLog })
              : apiGet<LogDetailResponse>(`/api/logs/${encodeURIComponent(input.logId)}`),
            apiGet<LogsResponse>(recentLogsPath),
          ]);

          const resolvedPlanId =
            typeof logRes.item.planId === "string" && logRes.item.planId.trim()
              ? logRes.item.planId
              : input.planId;
          const nextDraft = applyWeightRulesToDraft(
            createWorkoutRecordDraftFromLog(logRes.item, input.planName, {
              sessionDate: input.dateKey || undefined,
              timezone: browserTimezone,
              planSchedule: input.planSchedule,
            }),
            input.preferences,
          );
          const summaryDateKey = input.dateKey || nextDraft.session.sessionDate;
          setSelectedPlanId(resolvedPlanId);
          
          if (!isRestoredRef.current) {
            console.log("[WorkoutRecordPage] No restored data, applying log data to draft");
            setDraft(nextDraft);
            setProgramEntryState({});
          } else {
            console.log("[WorkoutRecordPage] Restored data present, skipping log data setDraft");
          }

          setRecentLogItems(logsRes.items ?? []);
          setLastSession(
            buildLastSessionSummary(
              logsRes.items ?? [],
              summaryDateKey,
              input.planParams,
              input.preferences.bodyweightKg,
            ),
          );
          setWorkflowState((prev) => (isRestoredRef.current ? prev : "idle"));
          contextHasLoadedRef.current = true;
          return;
        }

        if (input.planId && input.dateKey) {
          const existingLogLookup = await apiGet<LogsResponse>(
            `/api/logs?planId=${encodeURIComponent(input.planId)}&date=${encodeURIComponent(input.dateKey)}&timezone=${encodeURIComponent(browserTimezone)}&limit=1`,
          );
          const existingLogId = existingLogLookup.items[0]?.id ?? null;
          if (existingLogId) {
            await loadWorkoutContext({
              ...input,
              logId: existingLogId,
            });
            return;
          }
        }

        const isPastAutoPlan =
          input.planAutoProgression === true &&
          Boolean(input.dateKey) &&
          input.dateKey < toDateKey(new Date());
        if (isPastAutoPlan) {
          setDraft(null);
          setProgramEntryState({});
          setLastSession(null);
          setError("자동 진행 플랜은 오늘 이전 날짜에 새 운동기록을 추가할 수 없습니다. 기존 기록만 수정할 수 있습니다.");
          setWorkflowState("idle");
          return;
        }

        const [sessionRes, logsRes] = await Promise.all([
          apiPost<GeneratedSessionResponse>(`/api/plans/${encodeURIComponent(input.planId)}/generate`, {
            sessionDate: input.dateKey,
            timezone: browserTimezone,
          }),
          apiGet<LogsResponse>(recentLogsPath),
        ]);

        const prepared = prepareWorkoutRecordDraftForEntry(
          applyRecentWeightsToCustomExercises(
            applyWeightRulesToDraft(
              createWorkoutRecordDraft(sessionRes.session, input.planName, {
                sessionDate: input.dateKey,
                timezone: browserTimezone,
                planSchedule: input.planSchedule,
              }),
              input.preferences,
            ),
            logsRes.items ?? [],
          ),
        );
        setSelectedPlanId(input.planId);
        
        if (!isRestoredRef.current) {
          console.log("[WorkoutRecordPage] No restored data, applying generated session to draft");
          setDraft(prepared.draft);
          setProgramEntryState(prepared.programEntryState);
        } else {
          console.log("[WorkoutRecordPage] Restored data present, skipping generated session setDraft");
        }

        setRecentLogItems(logsRes.items ?? []);
        setLastSession(
          buildLastSessionSummary(
            logsRes.items ?? [],
            input.dateKey,
            input.planParams,
            input.preferences.bodyweightKg,
          ),
        );
        setWorkflowState((prev) => (isRestoredRef.current ? prev : "idle"));
        contextHasLoadedRef.current = true;
      } catch (e: any) {
        setDraft(null);
        setProgramEntryState({});
        setLastSession(null);
        setError(e?.message ?? "운동기록 화면 데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [applyWeightRulesToDraft, browserTimezone],
  );

  useEffect(() => {
    reloadDraftContextRef.current = async () => {
      const plan = selectedPlan;
      const prefs = workoutPreferences;
      const currentQuery = query;
      const resolvedPlanId = plan?.id ?? currentQuery.planId ?? "";
      const resolvedPlanName = plan?.name ?? "프로그램 미선택";
      if (!resolvedPlanId) return;
      await loadWorkoutContext({
        planId: resolvedPlanId,
        planName: resolvedPlanName,
        dateKey: currentQuery.date,
        preferences: prefs,
        planAutoProgression: plan?.params?.autoProgression === true,
        planSchedule: plan?.params?.schedule,
        planParams: plan?.params ?? null,
      });
    };
  }, [selectedPlan, workoutPreferences, query, loadWorkoutContext]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nextQuery = readQueryContext();
      setQuery(nextQuery);
      setPlansLoadKey(
        `workout-record:${nextQuery.date}:${nextQuery.planId ?? ""}:${nextQuery.logId ?? ""}:${Date.now()}`,
      );
      setLoading(true);
      setError(null);

      try {
        const [planRes, settingsSnapshot] = await Promise.all([
          apiGet<PlansResponse>("/api/plans"),
          fetchSettingsSnapshot().catch(() => null),
        ]);
        if (cancelled) return;

        const nextPreferences = settingsSnapshot ? readWorkoutPreferences(settingsSnapshot) : toDefaultWorkoutPreferences();
        setWorkoutPreferences(nextPreferences);

        const items = planRes.items ?? [];
        if (nextQuery.logId) {
          const logRes = await apiGet<LogDetailResponse>(`/api/logs/${encodeURIComponent(nextQuery.logId)}`);
          if (cancelled) return;

          const editablePlans = items.filter(
            (entry) => !entry.isArchived || entry.id === logRes.item.planId,
          );
          setPlans(editablePlans);

          const matchedPlan =
            editablePlans.find((entry) => entry.id === logRes.item.planId) ??
            editablePlans.find((entry) => entry.id === nextQuery.planId) ??
            editablePlans[0] ??
            null;
          const resolvedPlanId =
            matchedPlan?.id ??
            (typeof logRes.item.planId === "string" ? logRes.item.planId : "");
          const resolvedPlanName = matchedPlan?.name ?? "프로그램 미선택";

          setSelectedPlanId(resolvedPlanId);
          await loadWorkoutContext({
            planId: resolvedPlanId,
            planName: resolvedPlanName,
            dateKey: nextQuery.hasExplicitDate ? nextQuery.date : "",
            preferences: nextPreferences,
            planAutoProgression: matchedPlan?.params?.autoProgression === true,
            planSchedule: matchedPlan?.params?.schedule,
            planParams: matchedPlan?.params ?? null,
            logId: nextQuery.logId,
            initialLog: logRes.item,
          });

          if (nextQuery.openAdd) {
            setAddSheetOpen(true);
          }
          return;
        }

        const activePlans = items.filter((entry) => !entry.isArchived);
        setPlans(activePlans);

        if (activePlans.length === 0) {
          setSelectedPlanId("");
          setDraft(null);
          setProgramEntryState({});
          setLastSession(null);
          setWorkflowState("idle");
          setSaveError(null);
          setLoading(false);
          await alert({
            title: "프로그램 선택 필요",
            message: "선택된 플랜이 없습니다.\n프로그램 스토어로 이동합니다.",
            buttonText: "이동",
          });
          if (cancelled) return;
          router.replace("/program-store");
          return;
        }

        const fallbackPlan = activePlans[0];
        const plan = activePlans.find((entry) => entry.id === nextQuery.planId) ?? fallbackPlan;
        setSelectedPlanId(plan.id);
        await loadWorkoutContext({
          planId: plan.id,
          planName: plan.name,
          dateKey: nextQuery.date,
          preferences: nextPreferences,
          planAutoProgression: plan.params?.autoProgression === true,
          planSchedule: plan.params?.schedule,
          planParams: plan.params ?? null,
        });

        if (nextQuery.openAdd) {
          setAddSheetOpen(true);
        }
      } catch (e: any) {
        if (!cancelled) {
          setDraft(null);
          setProgramEntryState({});
          setError(e?.message ?? "플랜 목록을 불러오지 못했습니다.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [alert, loadWorkoutContext, router]);

  useEffect(() => {
    if (!addSheetOpen) return;
    const timer = window.setTimeout(() => {
      void loadExerciseOptions(exerciseQuery);
    }, 160);
    return () => {
      window.clearTimeout(timer);
    };
  }, [addSheetOpen, exerciseQuery, loadExerciseOptions]);

  useEffect(() => {
    setDraft((prev) => (prev ? applyWeightRulesToDraft(prev, workoutPreferences) : prev));
  }, [applyWeightRulesToDraft, workoutPreferences]);

  useEffect(() => {
    const isEditable = (element: Element | null) =>
      Boolean(element && (element.matches("input, textarea, select") || element.closest("input, textarea, select")));

    const onFocusIn = (event: FocusEvent) => {
      if (isEditable(event.target as Element)) {
        document.body.classList.add("workout-record-keyboard-open");
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!isEditable(document.activeElement)) {
          document.body.classList.remove("workout-record-keyboard-open");
        }
      }, 0);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.body.classList.remove("workout-record-keyboard-open");
    };
  }, []);

  const handlePlanChange = useCallback(
    async (planId: string) => {
      if (query.logId) return;
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) return;
      setSelectedPlanId(plan.id);
      await loadWorkoutContext({
        planId: plan.id,
        planName: plan.name,
        dateKey: query.date,
        preferences: workoutPreferences,
        planAutoProgression: plan.params?.autoProgression === true,
        planSchedule: plan.params?.schedule,
        planParams: plan.params ?? null,
      });
    },
    [plans, loadWorkoutContext, query.date, query.logId, workoutPreferences],
  );
  const openPlanSheet = useCallback(() => {
    setPlanQuery("");
    setPlanSheetOpen(true);
  }, []);
  const closePlanSheet = useCallback(() => {
    setPlanSheetOpen(false);
    setPlanQuery("");
  }, []);
  const handlePlanSheetSelect = useCallback(
    (planId: string) => {
      closePlanSheet();
      if (planId === selectedPlanId) return;
      void handlePlanChange(planId);
    },
    [closePlanSheet, handlePlanChange, selectedPlanId],
  );

  const resetAddExerciseSheetState = useCallback(() => {
    setExerciseQuery("");
    setExerciseOptionsError(null);
    setAddDraft(createDefaultAddExerciseDraft());
  }, []);

  const closeAddExerciseSheet = useCallback(() => {
    setAddSheetOpen(false);
    resetAddExerciseSheetState();
  }, [resetAddExerciseSheetState]);

  const selectExerciseOption = useCallback(
    (option: ExerciseOption | null) => {
      const name = option?.name ?? "";
      let baseWeight = 50;
      if (name) {
        const normalizedName = name.toLowerCase();
        for (const log of recentLogItems) {
          for (const set of log.sets) {
            if (
              set.exerciseName.toLowerCase() === normalizedName &&
              set.weightKg != null &&
              set.weightKg > 0
            ) {
              baseWeight = set.weightKg;
              break;
            }
          }
          if (baseWeight !== 50) break;
        }
      }
      setAddDraft((prev) => ({
        ...prev,
        exerciseId: option?.id ?? null,
        exerciseName: name,
        weightKg: resolveWeightWithCurrentPreferences(
          baseWeight,
          option?.id ?? null,
          name,
        ),
      }));
      setExerciseOptionsError(null);
      setExerciseQuery("");
    },
    [resolveWeightWithCurrentPreferences, recentLogItems],
  );
  const planSheetOptions = useMemo(
    () =>
      filteredPlans.map((plan) => ({
        key: plan.id,
        label: plan.name,
        active: selectedPlanId === plan.id,
        ariaCurrent: selectedPlanId === plan.id,
        onSelect: () => {
          handlePlanSheetSelect(plan.id);
        },
      })),
    [filteredPlans, handlePlanSheetSelect, selectedPlanId],
  );
  const exerciseSearchOptions = useMemo(
    () =>
      filteredExerciseOptions.map((option) => ({
        key: option.id,
        label: option.category ? `${option.name} · ${option.category}` : option.name,
        active: addDraft.exerciseId === option.id,
        onSelect: () => {
          selectExerciseOption(option);
        },
      })),
    [addDraft.exerciseId, filteredExerciseOptions, selectExerciseOption],
  );

  const handleAddExercise = useCallback(() => {
    if (!draft) return;
    if (!addDraft.exerciseId) {
      setExerciseOptionsError("드롭다운에서 운동종목을 선택하세요.");
      return;
    }
    const exerciseName = addDraft.exerciseName.trim();
    if (!exerciseName) {
      setExerciseOptionsError("선택한 운동종목 이름을 확인하세요.");
      return;
    }
    const snappedWeightKg = resolveWeightWithCurrentPreferences(
      addDraft.weightKg,
      addDraft.exerciseId,
      exerciseName,
    );

    setDraft((prev) => {
      if (!prev) return prev;
      return addUserExercise(prev, {
        exerciseId: addDraft.exerciseId,
        exerciseName,
        weightKg: snappedWeightKg,
        repsPerSet: addDraft.repsPerSet,
        memo: addDraft.memo,
      });
    });
    setWorkflowState("editing");
    closeAddExerciseSheet();
  }, [addDraft, closeAddExerciseSheet, draft, resolveWeightWithCurrentPreferences]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    const entryErrors = validateWorkoutRecordEntryState(visibleExercises, programEntryState);
    if (entryErrors.length > 0) {
      setSaveError(entryErrors[0] ?? "입력값을 확인해 주세요.");
      setWorkflowState("editing");
      return;
    }
    const validation = validateWorkoutDraft(draft);
    if (!validation.valid) {
      setSaveError(validation.errors[0] ?? "입력값을 확인해 주세요.");
      setWorkflowState("editing");
      return;
    }

    // Auto-progression 프로토콜 확인
    let progressionOverride: "hold" | "increase" | "reset" | null = null;
    if (selectedPlan?.params?.autoProgression === true && selectedPlan.id) {
      const isOperatorBlockEnd = draft.session.week === 6 && draft.session.day === 3;
      const is531BlockEnd = draft.session.week === 4 && draft.session.day === 4;
      const failures = detectFailedProgressionExercises(visibleExercises, programEntryState);
      const shouldCheck = isOperatorBlockEnd || is531BlockEnd || failures.length > 0;

      if (shouldCheck) {
        try {
          const progressionData = await apiGet<{
            program: "operator" | "greyskull-lp" | "starting-strength-lp" | "stronglifts-5x5" | "texas-method" | "gzclp" | "wendler-531" | null;
            state: ProgressionRuntimeStateSnapshot | null;
          }>(`/api/plans/${encodeURIComponent(selectedPlan.id)}/progression-state`);

          const showSheet = (title: string, message: string, mode: "block-completion" | "greyskull-reset") =>
            new Promise<FailureProtocolChoice>((resolve) => {
              failureProtocolResolveRef.current = resolve;
              setFailureProtocolSheet({ title, message, mode });
            });

          if (progressionData.program === "operator" && isOperatorBlockEnd) {
            // Operator: 6주 블록 완료 → 다음 사이클 무게 사용자가 결정
            const message = buildOperatorBlockCompletionMessage(progressionData.state);
            const choice = await showSheet("블록 완료 — 무게 설정", message, "block-completion");
            setFailureProtocolSheet(null);
            failureProtocolResolveRef.current = null;
            if (choice === "cancel") return;
            progressionOverride = choice === "increase" ? "increase" : choice === "hold" ? "hold" : choice === "reset" ? "reset" : null;

          } else if (progressionData.program === "wendler-531" && is531BlockEnd) {
            // 5/3/1: 4주 사이클 완료 → 다음 사이클 TM 사용자가 결정
            const message = build531BlockCompletionMessage(progressionData.state);
            const choice = await showSheet("4주 사이클 완료 — TM 설정", message, "block-completion");
            setFailureProtocolSheet(null);
            failureProtocolResolveRef.current = null;
            if (choice === "cancel") return;
            progressionOverride = choice === "increase" ? "increase" : choice === "hold" ? "hold" : choice === "reset" ? "reset" : null;

          } else if (
            progressionData.program !== null &&
            progressionData.program !== "operator" &&
            failures.length > 0
          ) {
            // LP/텍사스/GZCLP: 3회 연속 실패 기준 도달 시 모달
            const resetFactor = progressionData.program === "gzclp" ? 0.85 : 0.9;
            const resetFailures = failures.filter(
              (f) => (progressionData.state?.targets[f.target]?.failureStreak ?? 0) >= 2,
            );
            if (resetFailures.length > 0) {
              const message = buildResetProtocolMessage(resetFailures, progressionData.state, resetFactor);
              const choice = await showSheet("연속 실패 기준 도달", message, "greyskull-reset");
              setFailureProtocolSheet(null);
              failureProtocolResolveRef.current = null;
              if (choice === "cancel") return;
              // "reset" = 기본 알고리즘 적용 (override 없음)
              progressionOverride = choice === "hold" ? "hold" : choice === "increase" ? "increase" : null;
            }
          }
        } catch {
          // 프로그레션 상태 조회 실패 시 그냥 저장 진행
        }
      }
    }

    try {
      setWorkflowState("saving");
      setSaveError(null);
      const payload = toWorkoutLogPayload(draft, {
        bodyweightKg: workoutPreferences.bodyweightKg,
        isBodyweightExercise: isBodyweightExerciseName,
      });
      const payloadWithOverride = progressionOverride ? { ...payload, progressionOverride } : payload;
      if (draft.session.logId) {
        await apiPatch(`/api/logs/${encodeURIComponent(draft.session.logId)}`, payloadWithOverride);
      } else {
        await apiPost("/api/logs", payloadWithOverride);
      }
      
      // 저장 성공 시 드래프트 삭제
      if (persistenceKey) {
        await clearWorkoutDraft(persistenceKey);
      }

      setWorkflowState("done");
      router.push("/");
    } catch (e: any) {
      setSaveError(e?.message ?? "운동기록 저장에 실패했습니다.");
      setWorkflowState("editing");
    }
  }, [draft, persistenceKey, programEntryState, router, selectedPlan, visibleExercises, workoutPreferences.bodyweightKg]);

  const refreshRecordPage = useCallback(async () => {
    if (workflowState === "saving") return;
    // 복구 모달이 열려 있는 동안 PTR을 차단 — loadWorkoutContext 중복 호출 및 UI 깨짐 방지
    if (isRestoringRef.current) return;

    if (workflowState === "editing") {
      const result = await confirm({
        title: "화면 새로고침",
        message: "저장하지 않은 변경사항이 사라지고 다시 불러옵니다.\n계속할까요?",
        confirmText: "새로고침",
        cancelText: "취소",
        closeAsNull: true, // X 버튼은 아무 동작 없이 닫기
      });
      if (result === null) return; // X 닫기 — 아무것도 하지 않음
      if (!result) {
        // "취소" 선택 — 화면 상태와 드래프트를 모두 유지한 채 PTR 종료
        return;
      }
      // "새로고침" 선택 — debounce 취소 후 드래프트 삭제, 재로드
      cancelPendingSave();
      if (persistenceKey) await clearWorkoutDraft(persistenceKey);
    }

    // 이전 복구 시도가 화면 반영 전에 끝난 경우, 같은 키에 대한 복구 확인을 다시 허용한다.
    resetRestoreState(persistenceKey);

    // isRestoredRef 초기화: 이전 복구 상태가 남아있으면 loadWorkoutContext가 setDraft를 건너뜀
    isRestoredRef.current = false;

    const resolvedPlanId = selectedPlan?.id ?? draft?.session.planId ?? query.planId ?? "";
    const resolvedPlanName = selectedPlan?.name ?? draft?.session.planName ?? "프로그램 미선택";
    if (query.logId) {
      await loadWorkoutContext({
        planId: resolvedPlanId,
        planName: resolvedPlanName,
        dateKey: query.hasExplicitDate ? query.date : "",
        preferences: workoutPreferences,
        planAutoProgression: selectedPlan?.params?.autoProgression === true,
        planSchedule: selectedPlan?.params?.schedule,
        planParams: selectedPlan?.params ?? null,
        logId: query.logId,
        isRefresh: true,
      });
      return;
    }

    if (!resolvedPlanId) return;
    await loadWorkoutContext({
      planId: resolvedPlanId,
      planName: resolvedPlanName,
      dateKey: query.date,
      preferences: workoutPreferences,
      planAutoProgression: selectedPlan?.params?.autoProgression === true,
      planSchedule: selectedPlan?.params?.schedule,
      planParams: selectedPlan?.params ?? null,
      isRefresh: true,
    });
  }, [cancelPendingSave, confirm, draft, loadWorkoutContext, persistenceKey, query, resetRestoreState, selectedPlan, workoutPreferences, workflowState]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: refreshRecordPage,
  });

  const isPlansSettled = useQuerySettled(plansLoadKey, loading);
  const noPlan = isPlansSettled && !error && plans.length === 0 && !query.logId;
  const isEditingExistingLog = Boolean(draft?.session.logId);

  return (
    <>
    <PullToRefreshShell pullToRefresh={pullToRefresh}>
      {loading && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* 선택된 플랜 카드 */}
          <div>
            <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 16, width: "40%", marginBottom: 12 }} />
            <div className="card" style={{ padding: "var(--space-md)" }}>
              <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 4, height: 11, width: "35%", marginBottom: 6 }} />
              <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 20, width: "60%" }} />
            </div>
          </div>
          {/* 지난 세션 */}
          <div>
            <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 16, width: "30%", marginBottom: 12 }} />
            <div className="card" style={{ padding: "var(--space-md)" }}>
              <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 4, height: 13, width: "50%", marginBottom: 8 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-sm)" }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 4, height: 11, width: "70%", marginBottom: 4 }} />
                    <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 18, width: "90%" }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* 오늘 세션 */}
          <div>
            <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 16, width: "35%", marginBottom: 12 }} />
            <div className="card" style={{ padding: "var(--space-md)" }}>
              <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 4, height: 13, width: "40%", marginBottom: 12 }} />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ paddingBlock: 10, borderBottom: i < 2 ? "1px solid var(--color-border)" : "none" }}>
                  <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 14, width: "55%", marginBottom: 6 }} />
                  <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                    <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 6, height: 32, flex: 2 }} />
                    <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 6, height: 32, flex: 1 }} />
                    <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 6, height: 32, flex: 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* 기록 저장 버튼 */}
          <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 10, height: 48 }} />
        </div>
      )}
      <ErrorStateRows
        message={error}
        title="기록 화면 데이터를 불러오지 못했습니다"
        onRetry={() => {
          const resolvedPlanId = selectedPlan?.id ?? draft?.session.planId ?? query.planId ?? "";
          const resolvedPlanName = selectedPlan?.name ?? draft?.session.planName ?? "프로그램 미선택";
          if (query.logId) {
            void loadWorkoutContext({
              planId: resolvedPlanId,
              planName: resolvedPlanName,
              dateKey: query.hasExplicitDate ? query.date : "",
              preferences: workoutPreferences,
              planAutoProgression: selectedPlan?.params?.autoProgression === true,
              planSchedule: selectedPlan?.params?.schedule,
              planParams: selectedPlan?.params ?? null,
              logId: query.logId,
            });
            return;
          }
          if (resolvedPlanId) {
            void loadWorkoutContext({
              planId: resolvedPlanId,
              planName: resolvedPlanName,
              dateKey: query.date,
              preferences: workoutPreferences,
              planAutoProgression: selectedPlan?.params?.autoProgression === true,
              planSchedule: selectedPlan?.params?.schedule,
              planParams: selectedPlan?.params ?? null,
            });
          }
        }}
      />
      <NoticeStateRows
        message={saveError}
        tone="warning"
        label="입력 확인 필요"
        ariaLabel="Save validation error"
      />
      <EmptyStateRows
        when={noPlan}
        label="선택 가능한 플랜이 없습니다"
      />

      {!noPlan && draft && (
        <>
          {/* ── Plan Selector ── */}
          <section className="plan-selector-strip" data-pull-refresh-trigger="true">
            <div className="plan-selector-strip__label">선택 플랜</div>
            <PlanSelectorButton
              planName={selectedPlan?.name ?? draft.session.planName}
              aria-expanded={isEditingExistingLog ? false : planSheetOpen}
              onClick={isEditingExistingLog ? undefined : openPlanSheet}
              disabled={isEditingExistingLog}
            />
            {isEditingExistingLog ? (
              <p style={{ marginTop: "var(--space-xs)", fontSize: "12px", color: "var(--text-hint)" }}>기존 기록 수정 중에는 플랜을 변경할 수 없습니다.</p>
            ) : null}
          </section>

          {/* ── Today Session ── */}
          <section>
            {/* Session Progress Header — finish quick-action at top right */}
            <div className="session-progress-header">
              <div className="session-progress-header__top-row">
                <div className="session-progress-header__title-group">
                  <div className="session-progress-header__eyebrow">
                    {isEditingExistingLog ? "기록 수정" : "Active Session"}
                  </div>
                  <h2 className="session-progress-header__title">
                    Week {draft.session.week} · {draft.session.sessionType}
                  </h2>
                </div>
                <button
                  type="button"
                  className="btn-finish-quick"
                  onClick={() => { void handleSave(); }}
                  disabled={workflowState === "saving"}
                >
                  {workflowState === "saving" ? "저장 중…" : isEditingExistingLog ? "수정 완료" : "운동 완료"}
                </button>
              </div>
              <div className="session-progress-header__chips">
                <span className={`session-chip ${completedExercisesCount > 0 ? "session-chip--active" : ""}`}>
                  {completedExercisesCount}/{visibleExercises.length} 운동
                </span>
                <span className="session-chip session-chip--date">
                  {formatDateFriendly(draft.session.sessionDate)}
                </span>
                {workoutPreferences.bodyweightKg ? (
                  <span className="session-chip">BW {workoutPreferences.bodyweightKg.toFixed(1)}kg</span>
                ) : null}
              </div>
            </div>

            {/* ── Compact Last Session Banner ── */}
            {lastSession && (
              <div className="last-session-banner">
                <div className="last-session-banner__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                </div>
                <div className="last-session-banner__body">
                  <div className="last-session-banner__label">지난 세션</div>
                  <div className="last-session-banner__title">
                    {lastSession.weekLabel} · {lastSession.sessionLabel}
                  </div>
                  <div className="last-session-banner__meta">{lastSession.dateLabel}</div>
                </div>
                {lastSession.totalSets != null && (
                  <div className="last-session-banner__stat">
                    <div className="last-session-banner__stat-value">{lastSession.totalSets}</div>
                    <div className="last-session-banner__stat-label">세트</div>
                  </div>
                )}
              </div>
            )}

            <div>
              {visibleExercises.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {visibleExercises.map((exercise) => (
                    <div key={exercise.id}>
                      <ExerciseRow
                          exercise={exercise}
                          minimumPlateIncrementKg={resolveMinimumPlateIncrementKg(workoutPreferences, {
                            exerciseId: exercise.exerciseId,
                            exerciseName: exercise.exerciseName,
                          })}
                          showMinimumPlateInfo={
                            resolveMinimumPlateIncrement(workoutPreferences, {
                              exerciseId: exercise.exerciseId,
                              exerciseName: exercise.exerciseName,
                            }).source === "RULE"
                          }
                          bodyweightKg={workoutPreferences.bodyweightKg}
                          prevPerformance={prevPerformanceMap[exercise.exerciseName]}
                          programEntryState={
                            exercise.source === "PROGRAM"
                              ? createFallbackProgramEntryState(exercise, programEntryState[exercise.id])
                              : undefined
                          }
                          onChangeWeight={(value) => {
                            if (!Number.isFinite(value)) return;
                            const snapped = resolveWeightWithCurrentPreferences(
                              value,
                              exercise.exerciseId,
                              exercise.exerciseName,
                            );
                            if (exercise.source === "PROGRAM") {
                              applyEditing((prev) => patchSeedExercise(prev, exercise.id, { set: { weightKg: snapped } }));
                              return;
                            }
                            applyEditing((prev) => updateUserExercise(prev, exercise.id, { set: { weightKg: snapped } }));
                          }}
                          onChangeSetReps={(setIndex, value) => {
                            const repsPerSet = patchSetRepsAtIndex(exercise.set.repsPerSet, setIndex, value);
                            if (exercise.source === "PROGRAM") {
                              setProgramEntryState((prev) => {
                                const current = createFallbackProgramEntryState(exercise, prev[exercise.id]);
                                const repsInputs = current.repsInputs.slice();
                                repsInputs[setIndex] = String(value);
                                return {
                                  ...prev,
                                  [exercise.id]: {
                                    ...current,
                                    repsInputs,
                                  },
                                };
                              });
                              applyEditing((prev) => patchSeedExercise(prev, exercise.id, { set: { repsPerSet } }));
                              return;
                            }
                            applyEditing((prev) => updateUserExercise(prev, exercise.id, { set: { repsPerSet } }));
                          }}
                          onAddSet={() => {
                            const repsPerSet = appendSetReps(exercise.set.repsPerSet);
                            if (exercise.source === "PROGRAM") {
                              setProgramEntryState((prev) => {
                                const current = createFallbackProgramEntryState(exercise, prev[exercise.id]);
                                return {
                                  ...prev,
                                  [exercise.id]: {
                                    ...current,
                                    repsInputs: [...current.repsInputs, ""],
                                  },
                                };
                              });
                              applyEditing((prev) => patchSeedExercise(prev, exercise.id, { set: { repsPerSet } }));
                              return;
                            }
                            applyEditing((prev) => updateUserExercise(prev, exercise.id, { set: { repsPerSet } }));
                          }}
                          onRemoveSet={(index) => {
                            const repsPerSet = removeSetRepsAtIndex(exercise.set.repsPerSet, index);
                            if (exercise.source === "PROGRAM") {
                              setProgramEntryState((prev) => {
                                const current = createFallbackProgramEntryState(exercise, prev[exercise.id]);
                                return {
                                  ...prev,
                                  [exercise.id]: {
                                    ...current,
                                    repsInputs: [
                                      ...current.repsInputs.slice(0, index),
                                      ...current.repsInputs.slice(index + 1)
                                    ],
                                  },
                                };
                              });
                              applyEditing((prev) => patchSeedExercise(prev, exercise.id, { set: { repsPerSet } }));
                              return;
                            }
                            applyEditing((prev) => updateUserExercise(prev, exercise.id, { set: { repsPerSet } }));
                          }}
                          onChangeMemo={(value) => {
                            if (exercise.source === "PROGRAM") {
                              setProgramEntryState((prev) => {
                                const current = createFallbackProgramEntryState(exercise, prev[exercise.id]);
                                return {
                                  ...prev,
                                  [exercise.id]: {
                                    ...current,
                                    memoInput: value,
                                  },
                                };
                              });
                              applyEditing((prev) => patchSeedExercise(prev, exercise.id, { note: { memo: value } }));
                              return;
                            }
                            applyEditing((prev) => updateUserExercise(prev, exercise.id, { note: { memo: value } }));
                          }}
                          onDelete={() => {
                            if (exercise.source === "PROGRAM") {
                              applyEditing((prev) => removeSeedExercise(prev, exercise.id));
                              return;
                            }
                            applyEditing((prev) => removeUserExercise(prev, exercise.id));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {visibleExercises.length === 0 && (
                  <div style={{ padding: "var(--space-md) 0", color: "var(--text-hint)", fontSize: "14px" }}>
                    기록할 운동이 없습니다.
                  </div>
                )}
              </div>

              {/* ── Add Exercise Button ── */}
              <div style={{ marginBottom: "var(--space-md)" }}>
                <button
                  type="button"
                  className="btn-add-exercise"
                  onClick={() => {
                    resetAddExerciseSheetState();
                    setAddSheetOpen(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ width: "28px", height: "28px" }}>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>운동 추가</span>
                </button>
              </div>

              {/* ── Session Memo ── */}
              <label style={{ display: "block", marginBottom: "var(--space-md)" }}>
                <AppTextarea
                  variant="workout"
                  value={draft.session.note.memo}
                  onChange={(event) => {
                    const next = event.target.value;
                    applyEditing((prev) => ({
                      ...prev,
                      session: {
                        ...prev.session,
                        note: {
                          memo: next,
                        },
                      },
                    }));
                  }}
                  placeholder="오늘 세션 전체 메모"
                />
              </label>

              {/* ── Finish Workout CTA (bottom — also reachable from top header btn) ── */}
              <div className="finish-workout-cta">
                <PrimaryButton
                  type="button"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={workflowState === "saving"}
                >
                  {workflowState === "saving"
                    ? "저장 중..."
                    : isEditingExistingLog
                      ? "운동기록 수정 완료"
                      : "운동기록 완료 및 저장"}
                </PrimaryButton>
              </div>
          </section>
        </>
      )}

      <SearchSelectSheet
        open={planSheetOpen}
        title="플랜 선택"
        description="보유 플랜을 검색해 오늘 기록에 사용할 플랜으로 전환합니다."
        onClose={closePlanSheet}
        closeLabel="닫기"
        query={planQuery}
        placeholder="플랜 검색"
        onQueryChange={setPlanQuery}
        onQuerySubmit={() => {
          const first = filteredPlans[0] ?? null;
          if (!first) return;
          handlePlanSheetSelect(first.id);
        }}
        resultsAriaLabel="플랜 검색 결과"
        emptyText="검색 조건에 맞는 플랜이 없습니다."
        options={planSheetOptions}
      >
      </SearchSelectSheet>

      <BottomSheet
        open={addSheetOpen}
        title="운동 추가"
        description="기존 DB 종목 선택 또는 검색 후 기록 영역에 추가합니다."
        onClose={closeAddExerciseSheet}
        closeLabel="닫기"
        primaryAction={{
          ariaLabel: "기록 영역에 추가",
          onPress: handleAddExercise,
          disabled: !addDraft.exerciseId,
        }}
        footer={null}
      >
        <div>
          <Card padding="md" elevated={false}>
            <CardContent>
              <SearchSelectCombobox
                query={exerciseQuery}
                placeholder="예: Squat"
                onQueryChange={(nextQuery) => {
                  setExerciseQuery(nextQuery);
                  setExerciseOptionsError(null);
                  setAddDraft((prev) => {
                    if (!prev.exerciseId) return prev;
                    if (nextQuery.trim().toLowerCase() === prev.exerciseName.trim().toLowerCase()) return prev;
                    return { ...prev, exerciseId: null, exerciseName: "" };
                  });
                }}
                onQuerySubmit={() => {
                  const first = filteredExerciseOptions[0] ?? null;
                  if (!first) return;
                  selectExerciseOption(first);
                }}
                onClearQuery={() => {
                  setExerciseQuery("");
                  setExerciseOptionsError(null);
                }}
                resultsAriaLabel="운동종목 검색 결과"
                options={exerciseSearchOptions}
                emptyText="검색 조건에 맞는 운동종목이 없습니다."
                loading={exerciseOptionsLoading}
                loadingText="검색 중..."
                selectionSummary={
                  selectedExerciseOption ? (
                    <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                      <span style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>선택됨</span>
                      <strong>
                        {selectedExerciseOption.category
                          ? `${selectedExerciseOption.name} · ${selectedExerciseOption.category}`
                          : selectedExerciseOption.name}
                      </strong>
                      <button
                        type="button"
                        className="btn btn-inline-action"
                        onClick={() => selectExerciseOption(null)}
                      >
                        선택 변경
                      </button>
                    </div>
                  ) : null
                }
                hideOptions={Boolean(selectedExerciseOption)}
              />
            </CardContent>
          </Card>

          {exerciseOptionsError ? <p>{exerciseOptionsError}</p> : null}

          <Card padding="md" elevated={false}>
            <section style={{ padding: "var(--space-md)" }}>
              <div style={{ marginBottom: "var(--space-md)" }}>
                <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "0.7fr 1.8fr 1.2fr", gap: "var(--space-xs)", marginBottom: "var(--space-sm)", color: "var(--color-text-muted)", fontSize: "12px", textAlign: "center" }}>
                  <span>Sets</span>
                  <span style={{ color: "var(--text-metric-weight)" }}>Weight</span>
                  <span style={{ color: "var(--text-metric-reps)" }}>Reps</span>
                </div>

                <div role="list" aria-label="세트 편집">
                  {addDraft.repsPerSet.map((setReps, index) => (
                    <SwipeableSetRow
                      key={`add-set-${index}`}
                      disabled={addDraft.repsPerSet.length <= 1}
                      onDelete={() =>
                        setAddDraft((prev) => ({
                          ...prev,
                          repsPerSet: prev.repsPerSet.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <div role="listitem" style={{ display: "grid", gridTemplateColumns: "0.7fr 1.8fr 1.2fr", gap: "var(--space-xs)", alignItems: "center", textAlign: "center" }}>
                        <span style={{ color: "var(--text-metric-sets)", font: "var(--font-secondary)", fontWeight: 600 }}>{index + 1}</span>
                        <WorkoutRecordInlinePicker
                          label={`${index + 1}세트 무게`}
                          value={addDraft.weightKg}
                          min={0}
                          max={1000}
                          step={addDraftIncrementKg}
                          formatValue={(value) => formatCompactWeightValue(value, addDraftIncrementKg)}
                          color="var(--text-metric-weight)"
                          onChange={(value) =>
                            setAddDraft((prev) => ({
                              ...prev,
                              weightKg: resolveWeightWithCurrentPreferences(value, prev.exerciseId, prev.exerciseName),
                            }))
                          }
                        />
                        <WorkoutRecordInlinePicker
                          label={`${index + 1}세트 횟수`}
                          value={setReps}
                          min={1}
                          max={100}
                          step={1}
                          formatValue={(value) => String(Math.round(value))}
                          color="var(--text-metric-reps)"
                          onChange={(value) =>
                            setAddDraft((prev) => ({
                              ...prev,
                              repsPerSet: patchSetRepsAtIndex(prev.repsPerSet, index, value),
                            }))
                          }
                        />
                      </div>
                    </SwipeableSetRow>
                  ))}
                </div>
              </div>

              <button
                type="button"
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "transparent",
                  border: "2px dashed var(--color-border)",
                  borderRadius: "12px",
                  color: "var(--color-text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-xs)",
                  font: "var(--font-secondary)",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                onClick={() =>
                  setAddDraft((prev) => ({
                    ...prev,
                    repsPerSet: appendSetReps(prev.repsPerSet),
                  }))
                }
              >
                <AppPlusMinusIcon kind="plus" size={16} />
                <span>세트 추가</span>
              </button>
            </section>
          </Card>

          {addDraftIncrementInfo.source === "RULE" || (isBodyweightExerciseName(addDraft.exerciseName) && workoutPreferences.bodyweightKg) ? (
            <Card tone="subtle" padding="sm" elevated={false}>
              {addDraftIncrementInfo.source === "RULE" ? <span>적용 Increment: {addDraftIncrementKg.toFixed(2)}kg</span> : null}
              {isBodyweightExerciseName(addDraft.exerciseName) && workoutPreferences.bodyweightKg ? (
                <span>{`총 부하(외부중량 + 체중): ${addDraftTotalLoadKg?.toFixed(2) ?? "-"}kg`}</span>
              ) : null}
            </Card>
          ) : null}

          <label>
            <span>메모</span>
            <AppTextarea
              variant="workout"
              value={addDraft.memo}
              onChange={(event) => setAddDraft((prev) => ({ ...prev, memo: event.target.value }))}
            />
          </label>

          <Link
            href="/workout/log/exercise-catalog"
            className="btn btn-secondary btn-full"
            onClick={() => setAddSheetOpen(false)}
          >
            운동종목 관리
          </Link>
        </div>
      </BottomSheet>
    </PullToRefreshShell>
    <FailureProtocolSheet
      open={failureProtocolSheet !== null}
      title={failureProtocolSheet?.title ?? ""}
      message={failureProtocolSheet?.message ?? ""}
      mode={failureProtocolSheet?.mode ?? "block-completion"}
      onSelect={(choice) => {
        failureProtocolResolveRef.current?.(choice);
      }}
    />
    </>
  );
}
