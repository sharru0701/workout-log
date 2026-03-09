"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { Card, CardContent } from "@/components/ui/card";
import { AppNumberStepper, AppPlusMinusIcon, AppSelect, AppTextarea } from "@/components/ui/form-controls";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { apiGet, apiPost } from "@/lib/api";
import { computeExternalLoadFromTotalKg, formatKgValue, isBodyweightExerciseName } from "@/lib/bodyweight-load";
import { formatSessionKeyLabel } from "@/lib/session-key";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
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
  createWorkoutRecordDraft,
  hasWorkoutEdits,
  materializeWorkoutExercises,
  patchSeedExercise,
  removeSeedExercise,
  removeUserExercise,
  toWorkoutLogPayload,
  updateUserExercise,
  validateWorkoutDraft,
  type GeneratedSessionLike,
  type WorkoutExerciseViewModel,
  type WorkoutRecordDraft,
  type WorkoutWorkflowState,
} from "@/lib/workout-record/model";

type PlanItem = {
  id: string;
  name: string;
  isArchived?: boolean;
};

type LogItem = {
  id: string;
  performedAt: string;
  sets: Array<{ exerciseName: string; reps: number | null; weightKg: number | null }>;
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
  items: LogItem[];
};

type ExerciseResponse = {
  items: ExerciseOption[];
};

type QueryContext = {
  planId: string | null;
  date: string;
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

function inferProgramNameFromPlanName(planName: string) {
  return String(planName)
    .replace(/^program\s+/i, "")
    .replace(/\s+program$/i, "")
    .trim();
}

function readQueryContext(): QueryContext {
  if (typeof window === "undefined") {
    return {
      planId: null,
      date: toDateKey(new Date()),
      openAdd: false,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const planId = params.get("planId");
  const date = params.get("date");
  return {
    planId: planId && planId.trim() ? planId : null,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toDateKey(new Date()),
    openAdd: params.get("openAdd") === "1",
  };
}

function formatDateLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "날짜 미상";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function buildLastSessionSummary(logs: LogItem[], todayKey: string) {
  const selected = logs.find((entry) => toDateKey(new Date(entry.performedAt)) !== todayKey) ?? logs[0] ?? null;
  if (!selected) {
    return {
      title: "지난 세션 없음",
      description: "아직 저장된 세션이 없습니다.",
    };
  }

  const topExercise = selected.sets[0]?.exerciseName ?? "운동 정보 없음";
  return {
    title: `${formatDateLabel(selected.performedAt)} / ${selected.sets.length}세트`,
    description: `대표 운동: ${topExercise}`,
  };
}

function stateLabel(state: WorkoutWorkflowState) {
  if (state === "idle") return "Idle";
  if (state === "editing") return "Editing";
  if (state === "saving") return "Saving";
  return "Done";
}

function workoutExerciseBadgeMeta(badge: WorkoutExerciseViewModel["badge"]) {
  if (badge === "AUTO") return { label: "Auto", className: "ui-badge-info" };
  if (badge === "CUSTOM") return { label: "Custom", className: "ui-badge-neutral" };
  if (badge === "ADDED") return { label: "Added", className: "ui-badge-info" };
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

function ExerciseRow({
  exercise,
  minimumPlateIncrementKg,
  showMinimumPlateInfo,
  bodyweightKg,
  programEntryState,
  onChangeWeight,
  onChangeProgramSetInput,
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
  onChangeProgramSetInput?: (setIndex: number, value: string) => void;
  onChangeSetReps: (setIndex: number, value: number) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onChangeMemo: (value: string) => void;
  onDelete: () => void;
}) {
  const totalLoadKg = computeBodyweightTotalLoadKg(exercise.exerciseName, exercise.set.weightKg, bodyweightKg);
  const isBodyweightExercise = isBodyweightExerciseName(exercise.exerciseName);
  const badgeMeta = workoutExerciseBadgeMeta(exercise.badge);
  const usesProgramPlaceholders = Boolean(programEntryState);
  const circleActionButtonStyle = {
    width: "var(--touch-target)",
    height: "var(--touch-target)",
    minWidth: "var(--touch-target)",
    minHeight: "var(--touch-target)",
    padding: 0,
    aspectRatio: "1 / 1",
  } as const;

  return (
    <article className="workout-set-card grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {badgeMeta ? (
            <span className={`ui-badge ${badgeMeta.className}`}>{badgeMeta.label}</span>
          ) : null}
        </div>
        <button
          type="button"
          className="haptic-tap flex shrink-0 items-center justify-center rounded-full border bg-[color:color-mix(in_srgb,var(--bg-surface)_74%,transparent)] text-[var(--color-warning)] shadow-[0_8px_18px_-16px_color-mix(in_srgb,#000000_45%,transparent)]"
          style={circleActionButtonStyle}
          aria-label="운동 삭제"
          title="운동 삭제"
          onClick={onDelete}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M4.5 7.5h15" strokeLinecap="round" />
            <path d="M9.75 3.75h4.5" strokeLinecap="round" />
            <path
              d="M7.5 7.5v10.5A1.5 1.5 0 0 0 9 19.5h6a1.5 1.5 0 0 0 1.5-1.5V7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M10.5 10.5v5.25" strokeLinecap="round" />
            <path d="M13.5 10.5v5.25" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <label className="grid gap-1">
        <span className="ui-card-label">운동종목</span>
        <div className="workout-static-field" aria-label={`운동종목 ${exercise.exerciseName}`}>
          <strong className="workout-static-field-value">{exercise.exerciseName}</strong>
        </div>
      </label>

      <AppNumberStepper
        label={isBodyweightExercise && bodyweightKg ? "추가중량 (kg)" : "무게 (kg)"}
        value={exercise.set.weightKg}
        min={0}
        max={1000}
        step={minimumPlateIncrementKg}
        inputMode="decimal"
        onChange={onChangeWeight}
      />
      {isBodyweightExercise && bodyweightKg ? (
        <p className="px-1 text-xs text-[var(--text-secondary)]">총하중 기준: {formatKgValue(totalLoadKg)}</p>
      ) : null}

      <div className="grid gap-2">
        <div className="grid gap-2">
          {exercise.set.repsPerSet.map((setReps, index) => {
            const rawSetValue = programEntryState?.repsInputs[index]?.trim() ?? "";
            const parsedSetValue = Number(rawSetValue);
            const isSetComplete =
              usesProgramPlaceholders &&
              rawSetValue.length > 0 &&
              Number.isFinite(parsedSetValue) &&
              parsedSetValue >= 1 &&
              parsedSetValue <= 100;

            return (
              <AppNumberStepper
                key={`${exercise.id}-set-${index}`}
                label={`${index + 1}세트`}
                value={setReps}
                min={1}
                max={100}
                onChange={(value) => onChangeSetReps(index, value)}
                displayValue={usesProgramPlaceholders ? (programEntryState?.repsInputs[index] ?? "") : undefined}
                onDisplayValueChange={
                  usesProgramPlaceholders && onChangeProgramSetInput
                    ? (value) => onChangeProgramSetInput(index, value)
                    : undefined
                }
                allowEmpty={usesProgramPlaceholders}
                placeholder={usesProgramPlaceholders ? String(setReps) : undefined}
                complete={isSetComplete}
                inputMode="numeric"
              />
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
            onClick={onAddSet}
          >
            <AppPlusMinusIcon kind="plus" className="h-3.5 w-3.5" />
            <span>세트 추가</span>
          </button>
          <button
            type="button"
            className="haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
            onClick={onRemoveSet}
            disabled={exercise.set.repsPerSet.length <= 1}
          >
            <AppPlusMinusIcon kind="minus" className="h-3.5 w-3.5" />
            <span>마지막 세트</span>
          </button>
        </div>
      </div>

      {showMinimumPlateInfo || (isBodyweightExercise && bodyweightKg) ? (
        <div className="grid gap-1 rounded-xl border p-2 text-xs text-[var(--text-secondary)]">
          {showMinimumPlateInfo ? <span>최소 원판 Increment: {minimumPlateIncrementKg.toFixed(2)}kg</span> : null}
          {isBodyweightExercise && bodyweightKg ? (
            <span>{`총 부하(외부중량 + 체중): ${totalLoadKg?.toFixed(2) ?? "-"}kg`}</span>
          ) : null}
        </div>
      ) : null}

      <label className="grid gap-1">
        <span className="ui-card-label">메모</span>
        <AppTextarea
          variant="workout"
          className="min-h-20"
          value={usesProgramPlaceholders ? (programEntryState?.memoInput ?? "") : exercise.note.memo}
          onChange={(event) => onChangeMemo(event.target.value)}
          placeholder={usesProgramPlaceholders ? programEntryState?.memoPlaceholder || "세트 메모를 입력하세요." : "세트 메모를 입력하세요."}
        />
      </label>
    </article>
  );
}

export default function WorkoutRecordPage() {
  const router = useRouter();
  const { alert } = useAppDialog();

  const [query, setQuery] = useState<QueryContext>(() => readQueryContext());
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [draft, setDraft] = useState<WorkoutRecordDraft | null>(null);
  const [lastSession, setLastSession] = useState<{ title: string; description: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [plansLoadKey, setPlansLoadKey] = useState("workout-record:init");
  const [error, setError] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkoutWorkflowState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const loadWorkoutContext = useCallback(
    async (
      planId: string,
      planName: string,
      dateKey: string,
      preferences: WorkoutPreferences,
    ) => {
      try {
        setLoading(true);
        setError(null);
        setSaveError(null);
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

        const [sessionRes, logsRes] = await Promise.all([
          apiPost<GeneratedSessionResponse>(`/api/plans/${encodeURIComponent(planId)}/generate`, {
            sessionDate: dateKey,
            timezone,
          }),
          apiGet<LogsResponse>(`/api/logs?planId=${encodeURIComponent(planId)}&limit=6`),
        ]);

        const prepared = prepareWorkoutRecordDraftForEntry(
          applyWeightRulesToDraft(
            createWorkoutRecordDraft(sessionRes.session, planName),
            preferences,
          ),
        );
        setDraft(prepared.draft);
        setProgramEntryState(prepared.programEntryState);
        setLastSession(buildLastSessionSummary(logsRes.items ?? [], dateKey));
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
    [applyWeightRulesToDraft],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nextQuery = readQueryContext();
      setQuery(nextQuery);
      setPlansLoadKey(`workout-record:${nextQuery.date}:${nextQuery.planId ?? ""}:${Date.now()}`);
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
        await loadWorkoutContext(plan.id, plan.name, nextQuery.date, nextPreferences);

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
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) return;
      setSelectedPlanId(plan.id);
      await loadWorkoutContext(plan.id, plan.name, query.date, workoutPreferences);
    },
    [plans, loadWorkoutContext, query.date, workoutPreferences],
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
      await apiPost("/api/logs", payload);
      setWorkflowState("done");
      router.push("/");
    } catch (e: any) {
      setSaveError(e?.message ?? "운동기록 저장에 실패했습니다.");
      setWorkflowState("editing");
    }
  }, [draft, programEntryState, router, visibleExercises, workoutPreferences.bodyweightKg]);

  const isPlansSettled = useQuerySettled(plansLoadKey, loading);
  const noPlan = isPlansSettled && !error && plans.length === 0;

  return (
    <div className="native-page native-page-enter tab-screen app-dashboard-screen momentum-scroll">
      <LoadingStateRows
        active={loading}
        delayMs={160}
        label="기록 화면 불러오는 중"
      />
      <ErrorStateRows
        message={error}
        title="기록 화면 데이터를 불러오지 못했습니다"
        onRetry={() => {
          if (selectedPlan && selectedPlan.id) {
            void loadWorkoutContext(selectedPlan.id, selectedPlan.name, query.date, workoutPreferences);
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
          <section className="grid grid-cols-1 gap-2">
            <h2 className="ios-section-heading">선택된 플랜</h2>
            <article className="motion-card rounded-2xl border p-4 grid grid-cols-1 gap-3">
              <strong style={{ overflowWrap: "break-word", wordBreak: "break-word", minWidth: 0 }}>{selectedPlan?.name ?? draft.session.planName}</strong>
              <span className="ui-card-label" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                기반 프로그램: {inferProgramNameFromPlanName(draft.session.planName)}
              </span>
              <AppSelect
                label="플랜 변경"
                value={selectedPlanId}
                onChange={(event) => {
                  void handlePlanChange(event.target.value);
                }}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </AppSelect>
            </article>
          </section>

          <section className="grid gap-2">
            <h2 className="ios-section-heading">지난 세션 요약</h2>
            <article className="motion-card rounded-2xl border p-4 text-sm grid gap-1">
              <span>{lastSession?.title ?? "지난 세션 없음"}</span>
            </article>
          </section>

          <section className="grid gap-2">
            <h2 className="ios-section-heading">오늘 수행 세션 요약</h2>
            <article className="motion-card rounded-2xl border p-4 grid gap-1 text-sm">
              <span>예상 1RM: {draft.session.estimatedE1rmKg === null ? "-" : `${draft.session.estimatedE1rmKg}kg`}</span>
              <span>예상 TM: {draft.session.estimatedTmKg === null ? "-" : `${draft.session.estimatedTmKg}kg`}</span>
              <span>주차: Week {draft.session.week}</span>
              <span>세션: {draft.session.sessionType}</span>
              <span>Session Key: {formatSessionKeyLabel(draft.session.sessionKey)}</span>
              <span>Bodyweight: {workoutPreferences.bodyweightKg ? `${workoutPreferences.bodyweightKg.toFixed(1)}kg` : "미설정"}</span>
              <span className="text-[var(--accent-primary)]">
                편집 상태: {stateLabel(workflowState)} / 변경사항: {hasWorkoutEdits(draft) ? "있음" : "없음"}
              </span>
            </article>
          </section>

          <section className="grid gap-2">
            <h2 className="ios-section-heading">기록 본문 영역</h2>
            <article className="motion-card rounded-2xl border p-4 grid gap-3">
              {visibleExercises.map((exercise) => (
                <ExerciseRow
                  key={exercise.id}
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
                  onChangeProgramSetInput={(setIndex, value) => {
                    setProgramEntryState((prev) => {
                      const current = createFallbackProgramEntryState(exercise, prev[exercise.id]);
                      const repsInputs = current.repsInputs.slice();
                      repsInputs[setIndex] = value;
                      return {
                        ...prev,
                        [exercise.id]: {
                          ...current,
                          repsInputs,
                        },
                      };
                    });
                  }}
                  onChangeSetReps={(setIndex, value) => {
                    const repsPerSet = patchSetRepsAtIndex(exercise.set.repsPerSet, setIndex, value);
                    if (exercise.source === "PROGRAM") {
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
              ))}

              {visibleExercises.length === 0 && (
                <div className="workout-empty-state">
                  <strong>기록할 운동이 없습니다.</strong>
                </div>
              )}

              <button
                type="button"
                className="haptic-tap rounded-xl border px-4 py-3 text-center text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                onClick={() => {
                  resetAddExerciseSheetState();
                  setAddSheetOpen(true);
                }}
              >
                <AppPlusMinusIcon kind="plus" className="h-3.5 w-3.5" />
                <span>Add Exercise</span>
              </button>

              <label className="grid gap-1">
                <span className="ui-card-label">세션 메모</span>
                <AppTextarea
                  variant="workout"
                  className="min-h-20"
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
            </article>

            <div className="workout-save-dock">
              <button
                type="button"
                className="haptic-tap workout-action-pill is-primary workout-save-button"
                onClick={() => {
                  void handleSave();
                }}
                disabled={workflowState === "saving"}
              >
                {workflowState === "saving" ? "저장 중..." : "운동기록 완료"}
              </button>
            </div>
          </section>
        </>
      )}

      <BottomSheet
        open={addSheetOpen}
        title="운동 추가"
        description="기존 DB 종목 선택 또는 검색 후 기록 영역에 추가합니다."
        onClose={closeAddExerciseSheet}
        closeLabel="닫기"
        footer={
          <div className="grid gap-2">
            <button
              type="button"
              className="ui-primary-button"
              onClick={handleAddExercise}
              disabled={!addDraft.exerciseId}
            >
              기록 영역에 추가
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <Card padding="md" elevated={false}>
            <CardContent>
              <label className="grid gap-1">
                <span className="ui-card-label">운동종목 드롭다운 검색/선택</span>
                <div className="workout-combobox" data-no-swipe="true">
                  <div className="app-search-shell">
                    <span className="app-search-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.8-3.8" />
                      </svg>
                    </span>
                    <input
                      type="search"
                      inputMode="search"
                      className="app-search-input"
                      value={exerciseQuery}
                      placeholder="예: Squat"
                      onChange={(event) => {
                        const nextQuery = event.target.value;
                        setExerciseQuery(nextQuery);
                        setExerciseOptionsError(null);
                        setAddDraft((prev) => {
                          if (!prev.exerciseId) return prev;
                          if (nextQuery.trim().toLowerCase() === prev.exerciseName.trim().toLowerCase()) return prev;
                          return { ...prev, exerciseId: null, exerciseName: "" };
                        });
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
                          setExerciseOptionsError(null);
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>

                  {selectedExerciseOption ? (
                    <div className="workout-combobox-selected" role="status" aria-live="polite">
                      <span className="workout-combobox-selected-kicker">선택됨</span>
                      <strong className="workout-combobox-selected-name">
                        {selectedExerciseOption.category
                          ? `${selectedExerciseOption.name} · ${selectedExerciseOption.category}`
                          : selectedExerciseOption.name}
                      </strong>
                      <button
                        type="button"
                        className="haptic-tap workout-combobox-selected-edit"
                        onClick={() => selectExerciseOption(null)}
                      >
                        선택 변경
                      </button>
                    </div>
                  ) : null}

                  {!selectedExerciseOption ? (
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
                            className={`haptic-tap workout-combobox-option${addDraft.exerciseId === option.id ? " is-active" : ""}`}
                            onClick={() => {
                              selectExerciseOption(option);
                            }}
                          >
                            {option.category ? `${option.name} · ${option.category}` : option.name}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              </label>
            </CardContent>
          </Card>

          {exerciseOptionsError ? <p className="text-sm text-[var(--color-warning)]">{exerciseOptionsError}</p> : null}

          <Card padding="md" elevated={false}>
            <CardContent>
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
                <p className="px-1 text-xs text-[var(--text-secondary)]">총하중 기준: {formatKgValue(addDraftTotalLoadKg)}</p>
              ) : null}

              <div className="grid gap-2">
                <div className="grid gap-2">
                  {addDraft.repsPerSet.map((setReps, index) => (
                    <AppNumberStepper
                      key={`add-set-${index}`}
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
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
              <button
              type="button"
              className="haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
              onClick={() =>
                setAddDraft((prev) => ({
                  ...prev,
                  repsPerSet: appendSetReps(prev.repsPerSet),
                }))
              }
            >
              <AppPlusMinusIcon kind="plus" className="h-3.5 w-3.5" />
              <span>세트 추가</span>
            </button>
            <button
              type="button"
                className="haptic-tap rounded-xl border px-3 py-2 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                onClick={() =>
                setAddDraft((prev) => ({
                  ...prev,
                  repsPerSet: removeLastSetReps(prev.repsPerSet),
                }))
              }
              disabled={addDraft.repsPerSet.length <= 1}
            >
              <AppPlusMinusIcon kind="minus" className="h-3.5 w-3.5" />
              <span>마지막 세트</span>
            </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {addDraftIncrementInfo.source === "RULE" || (isBodyweightExerciseName(addDraft.exerciseName) && workoutPreferences.bodyweightKg) ? (
            <Card tone="subtle" padding="sm" elevated={false} className="text-xs text-[var(--text-secondary)]">
              {addDraftIncrementInfo.source === "RULE" ? <span>적용 Increment: {addDraftIncrementKg.toFixed(2)}kg</span> : null}
              {isBodyweightExerciseName(addDraft.exerciseName) && workoutPreferences.bodyweightKg ? (
                <span>{`총 부하(외부중량 + 체중): ${addDraftTotalLoadKg?.toFixed(2) ?? "-"}kg`}</span>
              ) : null}
            </Card>
          ) : null}

          <label className="grid gap-1">
            <span className="ui-card-label">메모</span>
            <AppTextarea
              variant="workout"
              className="min-h-20"
              value={addDraft.memo}
              onChange={(event) => setAddDraft((prev) => ({ ...prev, memo: event.target.value }))}
            />
          </label>

          <Link
            href="/workout-record/exercise-catalog"
            className="haptic-tap rounded-xl border px-4 py-3 text-center text-sm font-semibold no-underline"
            onClick={() => setAddSheetOpen(false)}
          >
            운동종목 CRUD 관리 열기
          </Link>
        </div>
      </BottomSheet>
    </div>
  );
}
