"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { Card, CardContent } from "@/components/ui/card";
import { SessionCard } from "@/components/ui/session-card";
import { SessionSummaryCard } from "@/components/ui/session-summary-card";
import { AppNumberStepper, AppPlusMinusIcon, AppTextarea } from "@/components/ui/form-controls";
import { NumberPickerSheet } from "@/components/ui/number-picker-sheet";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SearchSelectCombobox, SearchSelectSheet } from "@/components/ui/search-select-sheet";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { computeExternalLoadFromTotalKg, formatKgValue, isBodyweightExerciseName } from "@/lib/bodyweight-load";
import { parseSessionKey } from "@/lib/session-key";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
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
  return Math.min(100, Math.max(1, Math.round(value)));
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

function removeLastSetReps(values: number[]) {
  const next = normalizeRepsPerSet(values);
  if (next.length <= 1) return next;
  return next.slice(0, next.length - 1);
}

function createFallbackProgramEntryState(
  exercise: WorkoutExerciseViewModel,
  current?: WorkoutProgramExerciseEntryState,
): WorkoutProgramExerciseEntryState {
  return {
    repsInputs: Array.from({ length: exercise.set.repsPerSet.length }, (_, index) => current?.repsInputs[index] ?? ""),
    memoInput: current?.memoInput ?? "",
    memoPlaceholder: current?.memoPlaceholder ?? "",
  };
}

function formatPercentLabel(percent: number | null | undefined) {
  if (typeof percent !== "number" || !Number.isFinite(percent) || percent <= 0) return "-";
  return `${Math.round(percent * 100)}%`;
}

function formatCompactWeightValue(value: number, step = 0.5) {
  if (!Number.isFinite(value)) return "0";
  const raw = String(step);
  const precision = raw.includes(".") ? Math.min(2, raw.split(".")[1]?.length ?? 0) : 0;
  const rounded = Number(value.toFixed(Math.max(precision, 1)));
  if (precision === 0 || Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(precision);
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
}) {
  const [open, setOpen] = useState(false);
  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <div style={{ display: "flex", width: "100%", justifyContent: "center" }}>
      <button
        type="button"
        style={{
          width: "100%",
          padding: "var(--space-xs)",
          border: "1px solid var(--color-border)",
          borderRadius: "6px",
          backgroundColor: complete ? "var(--color-surface-hover)" : "transparent",
          color: complete ? "var(--color-text)" : "var(--color-text-muted)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          font: "var(--font-primary)",
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

function ExerciseRow({
  exercise,
  minimumPlateIncrementKg,
  showMinimumPlateInfo,
  bodyweightKg,
  programEntryState,
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
  onChangeWeight: (value: number) => void;
  onChangeSetReps: (setIndex: number, value: number) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onChangeMemo: (value: string) => void;
  onDelete: () => void;
}) {
  const totalLoadKg = computeBodyweightTotalLoadKg(exercise.exerciseName, exercise.set.weightKg, bodyweightKg);
  const isBodyweightExercise = isBodyweightExerciseName(exercise.exerciseName);
  const badgeMeta = workoutExerciseBadgeMeta(exercise.badge);
  const showBadgeAfterName = exercise.badge === "AUTO";
  const usesProgramPlaceholders = Boolean(programEntryState);
  const weightStepMeta = `${formatKgValue(minimumPlateIncrementKg)} 단위`;
  const plannedPercentPerSet = exercise.plannedSetMeta?.percentPerSet ?? [];
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
  return (
    <Card as="article" tone="inset" elevated={false} padding="none" style={{ marginBottom: "var(--space-md)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-md)", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          <strong
            aria-label={`운동종목 ${exercise.exerciseName}`}
            style={{ font: "var(--font-section-title)" }}
          >
            {exercise.exerciseName}
          </strong>
          {showBadgeAfterName && badgeMeta ? (
            <span className={badgeMeta.className}>{badgeMeta.label}</span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          {badgeMeta && !showBadgeAfterName ? (
            <span className={badgeMeta.className}>{badgeMeta.label}</span>
          ) : null}
          <button
            type="button"
            className="btn btn-icon btn-icon-danger"
            aria-label="운동 삭제"
            title="운동 삭제"
            onClick={onDelete}
          >
            <AppPlusMinusIcon kind="minus" />
          </button>
        </div>
      </div>

      <section style={{ padding: "var(--space-md)" }}>
        <div style={{ marginBottom: "var(--space-md)" }}>
          <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 2fr 1.5fr", gap: "var(--space-xs)", marginBottom: "var(--space-sm)", color: "var(--color-text-muted)", fontSize: "12px", textAlign: "center" }}>
            <span>세트</span>
            <span>TM%</span>
            <span>{isBodyweightExercise && bodyweightKg ? "추가중량(kg)" : "무게(kg)"}</span>
            <span>횟수</span>
          </div>

          <div role="list" aria-label={`${exercise.exerciseName} 세트 편집`}>
            {exercise.set.repsPerSet.map((setReps, index) => {
              const rawSetValue = programEntryState?.repsInputs[index]?.trim() ?? "";
              const parsedSetValue = Number(rawSetValue);
              const isSetComplete =
                usesProgramPlaceholders &&
                rawSetValue.length > 0 &&
                Number.isFinite(parsedSetValue) &&
                parsedSetValue >= 1 &&
                parsedSetValue <= 100;
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
                <div key={`${exercise.id}-set-${index}`} role="listitem" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 2fr 1.5fr", gap: "var(--space-xs)", alignItems: "center", marginBottom: "var(--space-xs)", textAlign: "center" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>{index + 1}</span>
                  <span style={{ font: "var(--font-secondary)" }}>
                    {formatPercentLabel(plannedPercentPerSet[index])}
                  </span>
                  <WorkoutRecordInlinePicker
                    label={`${index + 1}세트 무게`}
                    value={resolvedRowWeightKg}
                    min={0}
                    max={1000}
                    step={minimumPlateIncrementKg}
                    formatValue={(value) => formatCompactWeightValue(value, minimumPlateIncrementKg)}
                    onChange={onChangeWeight}
                  />
                  <WorkoutRecordInlinePicker
                    label={`${index + 1}세트 횟수`}
                    value={setReps}
                    min={1}
                    max={100}
                    step={1}
                    complete={isSetComplete}
                    formatValue={(value) => String(Math.round(value))}
                    onChange={(value) => onChangeSetReps(index, value)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-sm)", marginTop: "var(--space-lg)", marginBottom: "var(--space-md)" }}>
          <button
            type="button"
            className="btn btn-inline-action btn-inline-action-primary"
            onClick={onAddSet}
          >
            <AppPlusMinusIcon kind="plus" size={16} />
            <span>세트 추가</span>
          </button>
          <button
            type="button"
            className="btn btn-inline-action btn-inline-action-danger"
            onClick={onRemoveSet}
            disabled={exercise.set.repsPerSet.length <= 1}
          >
            <AppPlusMinusIcon kind="minus" size={16} />
            <span>삭제</span>
          </button>
        </div>

        <p>{weightStepMeta}로 입력됩니다.</p>
        {isBodyweightExercise && bodyweightKg ? (
          <p>총하중 기준: {formatKgValue(totalLoadKg)}</p>
        ) : null}
        {showMinimumPlateInfo ? (
          <p>최소 원판 Increment 규칙이 적용된 값입니다.</p>
        ) : null}
      </section>

      <label>
        <AppTextarea
          variant="workout"
          value={usesProgramPlaceholders ? (programEntryState?.memoInput ?? "") : exercise.note.memo}
          onChange={(event) => onChangeMemo(event.target.value)}
          placeholder={usesProgramPlaceholders ? programEntryState?.memoPlaceholder || "세트 메모를 입력하세요." : "세트 메모를 입력하세요."}
        />
      </label>
    </Card>
  );
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
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [draft, setDraft] = useState<WorkoutRecordDraft | null>(null);
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

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [exerciseOptionsLoading, setExerciseOptionsLoading] = useState(false);
  const [exerciseOptionsError, setExerciseOptionsError] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState<AddExerciseDraft>(createDefaultAddExerciseDraft);
  const [programEntryState, setProgramEntryState] = useState<WorkoutProgramExerciseEntryStateMap>({});
  const [workoutPreferences, setWorkoutPreferences] = useState<WorkoutPreferences>(toDefaultWorkoutPreferences);

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
  };

  const loadWorkoutContext = useCallback(
    async (
      input: LoadWorkoutContextInput,
    ) => {
      try {
        setLoading(true);
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
          setDraft(nextDraft);
          setProgramEntryState({});
          setLastSession(
            buildLastSessionSummary(
              logsRes.items ?? [],
              summaryDateKey,
              input.planParams,
              input.preferences.bodyweightKg,
            ),
          );
          setWorkflowState("idle");
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
          applyWeightRulesToDraft(
            createWorkoutRecordDraft(sessionRes.session, input.planName, {
              sessionDate: input.dateKey,
              timezone: browserTimezone,
              planSchedule: input.planSchedule,
            }),
            input.preferences,
          ),
        );
        setSelectedPlanId(input.planId);
        setDraft(prepared.draft);
        setProgramEntryState(prepared.programEntryState);
        setLastSession(
          buildLastSessionSummary(
            logsRes.items ?? [],
            input.dateKey,
            input.planParams,
            input.preferences.bodyweightKg,
          ),
        );
        setWorkflowState("idle");
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
      setAddDraft((prev) => ({
        ...prev,
        exerciseId: option?.id ?? null,
        exerciseName: option?.name ?? "",
        weightKg: resolveWeightWithCurrentPreferences(
          prev.weightKg,
          option?.id ?? null,
          option?.name ?? "",
        ),
      }));
      setExerciseOptionsError(null);
      setExerciseQuery("");
    },
    [resolveWeightWithCurrentPreferences],
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

    try {
      setWorkflowState("saving");
      setSaveError(null);
      const payload = toWorkoutLogPayload(draft, {
        bodyweightKg: workoutPreferences.bodyweightKg,
        isBodyweightExercise: isBodyweightExerciseName,
      });
      if (draft.session.logId) {
        await apiPatch(`/api/logs/${encodeURIComponent(draft.session.logId)}`, payload);
      } else {
        await apiPost("/api/logs", payload);
      }
      setWorkflowState("done");
      router.push("/");
    } catch (e: any) {
      setSaveError(e?.message ?? "운동기록 저장에 실패했습니다.");
      setWorkflowState("editing");
    }
  }, [draft, programEntryState, router, visibleExercises, workoutPreferences.bodyweightKg]);

  const refreshRecordPage = useCallback(async () => {
    if (workflowState === "saving") return;

    if (workflowState === "editing") {
      const shouldReload = await confirm({
        title: "입력 내용 다시 불러오기",
        message: "저장하지 않은 변경사항이 사라집니다.\n지금 화면 데이터를 다시 불러올까요?",
        confirmText: "다시 불러오기",
        cancelText: "취소",
      });
      if (!shouldReload) return;
    }

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
    });
  }, [confirm, draft, loadWorkoutContext, query, selectedPlan, workoutPreferences, workflowState]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: refreshRecordPage,
    triggerSelector: "[data-pull-refresh-trigger]",
  });

  const isPlansSettled = useQuerySettled(plansLoadKey, loading);
  const noPlan = isPlansSettled && !error && plans.length === 0 && !query.logId;
  const isEditingExistingLog = Boolean(draft?.session.logId);

  return (
    <div {...pullToRefresh.bind}>
      <PullToRefreshIndicator
        pullOffset={pullToRefresh.pullOffset}
        progress={pullToRefresh.progress}
        status={pullToRefresh.status}
        refreshingLabel="기록 화면 새로고침 중..."
        completeLabel="기록 화면 갱신 완료"
      />
      <LoadingStateRows
        active={loading}
        delayMs={160}
        label="기록 화면 불러오는 중"
      />
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
          <section data-pull-refresh-trigger="true" style={{ marginBottom: "var(--space-xl)" }}>
            <h2 style={{ font: "var(--font-heading)", marginBottom: "var(--space-sm)" }}>선택된 플랜</h2>
            <Card as="article" padding="md">
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", border: "1px solid var(--color-border)", borderRadius: "12px", backgroundColor: "var(--color-surface-secondary)", cursor: isEditingExistingLog ? "default" : "pointer" }}
                aria-label="플랜 선택 열기"
                aria-haspopup="dialog"
                aria-expanded={isEditingExistingLog ? false : planSheetOpen}
                onClick={isEditingExistingLog ? undefined : openPlanSheet}
                disabled={isEditingExistingLog}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "2px" }}>진행 중인 플랜</div>
                  <div style={{ font: "var(--font-body)", fontWeight: 600 }}>{selectedPlan?.name ?? draft.session.planName}</div>
                </div>
                <span aria-hidden="true" style={{ color: "var(--color-text-muted)" }}>
                  <svg viewBox="0 0 12 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                    <path d="M2 5.5L6 2L10 5.5" />
                    <path d="M2 10.5L6 14L10 10.5" />
                  </svg>
                </span>
              </button>
              {isEditingExistingLog ? (
                <p>기존 기록 수정 중에는 플랜을 변경할 수 없습니다.</p>
              ) : null}
            </Card>
          </section>

          <section style={{ marginBottom: "var(--space-xl)" }}>
            <h2 style={{ font: "var(--font-heading)", marginBottom: "var(--space-sm)" }}>지난 세션</h2>
            <SessionCard
              variant="last"
              title={lastSession?.dateLabel ? `${lastSession.weekLabel} · ${lastSession.sessionLabel}` : ""}
              date={lastSession?.dateLabel ?? null}
              totalSets={lastSession?.totalSets}
              totalVolume={lastSession?.totalVolume}
              bodyweightKg={lastSession?.bodyweightKg}
              exercises={lastSession?.exercises?.map((ex) => ({ name: ex.name, summary: ex.bestSet })) ?? []}
            />
          </section>

          <section>
            <h2 style={{ font: "var(--font-section-title)", marginBottom: "var(--space-md)" }}>{isEditingExistingLog ? "선택 날짜 기록" : "오늘 세션"}</h2>
            <SessionSummaryCard
              variant="today"
              data={{
                badgeLabel: `Week ${draft.session.week} · ${draft.session.sessionType}`,
                dateLabel: formatDateFriendly(draft.session.sessionDate),
                bodyweightKg: workoutPreferences.bodyweightKg,
              }}
            >
              <div aria-hidden="true" />

              <div>
                {visibleExercises.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", marginTop: "var(--space-md)" }}>
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
                          onRemoveSet={() => {
                            const repsPerSet = removeLastSetReps(exercise.set.repsPerSet);
                            if (exercise.source === "PROGRAM") {
                              setProgramEntryState((prev) => {
                                const current = createFallbackProgramEntryState(exercise, prev[exercise.id]);
                                return {
                                  ...prev,
                                  [exercise.id]: {
                                    ...current,
                                    repsInputs: current.repsInputs.slice(0, Math.max(repsPerSet.length, 1)),
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
                  <div>
                    <strong>기록할 운동이 없습니다.</strong>
                  </div>
                )}

                {visibleExercises.length > 0 ? <div aria-hidden="true" /> : null}

                <div style={{ marginBottom: "var(--space-md)" }}>
                  <button
                    type="button"
                    className="btn-add-exercise"
                    onClick={() => {
                      resetAddExerciseSheetState();
                      setAddSheetOpen(true);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ width: "32px", height: "32px" }}>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Add Exercise</span>
                  </button>
                </div>

                <label>
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
              </div>
            </SessionSummaryCard>

            <div>
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
                    ? "운동기록 수정"
                    : "운동기록 완료"}
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
        label=""
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
                label="운동종목 드롭다운 검색/선택"
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
            <CardContent>
              <section>
                <div>
                  <div>
                    <span>무게 입력</span>
                    <strong>
                      {isBodyweightExerciseName(addDraft.exerciseName) && workoutPreferences.bodyweightKg ? "추가중량 설정" : "무게 설정"}
                    </strong>
                  </div>
                  <span>{`${formatKgValue(addDraftIncrementKg)} 단위`}</span>
                </div>

                <AppNumberStepper
                  label={isBodyweightExerciseName(addDraft.exerciseName) && workoutPreferences.bodyweightKg ? "추가중량 (kg)" : "무게 (kg)"}
                  value={addDraft.weightKg}
                  min={0}
                  max={1000}
                  step={addDraftIncrementKg}
                  inputMode="decimal"
                  onChange={(value) =>
                    setAddDraft((prev) => ({
                      ...prev,
                      weightKg: resolveWeightWithCurrentPreferences(
                        value,
                        prev.exerciseId,
                        prev.exerciseName,
                      ),
                    }))
                  }
                />

                {isBodyweightExerciseName(addDraft.exerciseName) && workoutPreferences.bodyweightKg ? (
                  <p>총하중 기준: {formatKgValue(addDraftTotalLoadKg)}</p>
                ) : null}
              </section>

              <section>
                <div>
                  
                  <span>빠른 편집</span>
                </div>

                <div>
                  {addDraft.repsPerSet.map((setReps, index) => (
                    <div key={`add-set-${index}`}>
                      <AppNumberStepper
                        label={`${index + 1}세트`}
                        value={setReps}
                        min={1}
                        max={100}
                        onChange={(value) =>
                          setAddDraft((prev) => ({
                            ...prev,
                            repsPerSet: patchSetRepsAtIndex(prev.repsPerSet, index, value),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
                  <button
                    type="button"
                    className="btn btn-inline-action btn-inline-action-primary"
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
                  <button
                    type="button"
                    className="btn btn-inline-action btn-inline-action-danger"
                    onClick={() =>
                      setAddDraft((prev) => ({
                        ...prev,
                        repsPerSet: removeLastSetReps(prev.repsPerSet),
                      }))
                    }
                    disabled={addDraft.repsPerSet.length <= 1}
                  >
                    <AppPlusMinusIcon kind="minus" size={16} />
                    <span>마지막 세트</span>
                  </button>
                </div>
              </section>
            </CardContent>
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
            href="/workout-record/exercise-catalog"
            onClick={() => setAddSheetOpen(false)}
          >
            운동종목 CRUD 관리 열기
          </Link>
        </div>
      </BottomSheet>
    </div>
  );
}
