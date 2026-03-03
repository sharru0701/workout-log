"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { apiGet, apiPost } from "@/lib/api";
import { fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import {
  computeBodyweightTotalLoadKg,
  isBodyweightRelatedExerciseName,
  readWorkoutPreferences,
  resolveMinimumPlateIncrementKg,
  snapWeightToIncrementKg,
  toDefaultWorkoutPreferences,
  type WorkoutPreferences,
} from "@/lib/settings/workout-preferences";
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
  sets: number;
  reps: number;
  memo: string;
};

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

function NumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  inputMode = "numeric",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <label className="workout-stepper">
      <span className="ui-card-label">{label}</span>
      <div className="workout-stepper-control">
        <button
          type="button"
          className="haptic-tap workout-stepper-button"
          onClick={() => onChange(Math.max(min, value - step))}
          aria-label={`${label} 줄이기`}
        >
          -
        </button>
        <input
          className="workout-stepper-input"
          type="number"
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) return;
            onChange(Math.min(max, Math.max(min, next)));
          }}
        />
        <button
          type="button"
          className="haptic-tap workout-stepper-button"
          onClick={() => onChange(Math.min(max, value + step))}
          aria-label={`${label} 늘리기`}
        >
          +
        </button>
      </div>
    </label>
  );
}

function ExerciseRow({
  exercise,
  minimumPlateIncrementKg,
  bodyweightKg,
  onChangeName,
  onChangeWeight,
  onChangeSets,
  onChangeReps,
  onChangeMemo,
  onDelete,
}: {
  exercise: WorkoutExerciseViewModel;
  minimumPlateIncrementKg: number;
  bodyweightKg: number | null;
  onChangeName: (value: string) => void;
  onChangeWeight: (value: number) => void;
  onChangeSets: (value: number) => void;
  onChangeReps: (value: number) => void;
  onChangeMemo: (value: string) => void;
  onDelete: () => void;
}) {
  const totalLoadKg = computeBodyweightTotalLoadKg(exercise.exerciseName, exercise.set.weightKg, bodyweightKg);

  return (
    <div className="workout-swipe-shell">
      <button type="button" className="workout-swipe-delete haptic-tap" onClick={onDelete}>
        삭제
      </button>

      <article className="workout-set-card grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`ui-badge ${exercise.source === "PROGRAM" ? "ui-badge-info" : "ui-badge-neutral"}`}>
            {exercise.source === "PROGRAM" ? "Program Seed" : "User Added"}
          </span>
          {exercise.isEdited ? <span className="ui-badge ui-badge-warning">Edited</span> : null}
        </div>

        <label className="grid gap-1">
          <span className="ui-card-label">운동종목</span>
          <input
            className="workout-set-input workout-set-input-text"
            value={exercise.exerciseName}
            onChange={(event) => onChangeName(event.target.value)}
            placeholder="예: Back Squat"
          />
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className="ui-card-label">무게 (kg)</span>
            <input
              className="workout-set-input workout-set-input-number"
              type="number"
              inputMode="decimal"
              min={0}
              max={1000}
              step={minimumPlateIncrementKg}
              value={exercise.set.weightKg}
              onChange={(event) => onChangeWeight(Number(event.target.value))}
            />
          </label>
          <NumberStepper
            label="세트"
            value={exercise.set.count}
            min={1}
            max={50}
            onChange={onChangeSets}
            inputMode="numeric"
          />
          <NumberStepper
            label="횟수"
            value={exercise.set.reps}
            min={1}
            max={100}
            onChange={onChangeReps}
            inputMode="numeric"
          />
        </div>

        <div className="grid gap-1 rounded-xl border p-2 text-xs text-[var(--text-secondary)]">
          <span>최소 원판 Increment: {minimumPlateIncrementKg.toFixed(2)}kg</span>
          {isBodyweightRelatedExerciseName(exercise.exerciseName) ? (
            <span>
              {bodyweightKg
                ? `총 부하(외부중량 + 체중): ${totalLoadKg?.toFixed(2) ?? "-"}kg`
                : "체중 설정을 입력하면 중량 풀업 총 부하를 함께 계산합니다."}
            </span>
          ) : null}
        </div>

        <label className="grid gap-1">
          <span className="ui-card-label">메모</span>
          <textarea
            className="workout-set-input workout-set-input-text min-h-20"
            value={exercise.note.memo}
            onChange={(event) => onChangeMemo(event.target.value)}
            placeholder="세트 메모를 입력하세요."
          />
        </label>
      </article>
    </div>
  );
}

export default function WorkoutRecordPage() {
  const router = useRouter();

  const [query, setQuery] = useState<QueryContext>(() => readQueryContext());
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [draft, setDraft] = useState<WorkoutRecordDraft | null>(null);
  const [lastSession, setLastSession] = useState<{ title: string; description: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkoutWorkflowState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [exerciseOptionsLoading, setExerciseOptionsLoading] = useState(false);
  const [exerciseOptionsError, setExerciseOptionsError] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState<AddExerciseDraft>({
    exerciseId: null,
    exerciseName: "",
    weightKg: 0,
    sets: 3,
    reps: 5,
    memo: "",
  });
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
              exercise.set.weightKg,
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

        setDraft(
          applyWeightRulesToDraft(
            createWorkoutRecordDraft(sessionRes.session, planName),
            preferences,
          ),
        );
        setLastSession(buildLastSessionSummary(logsRes.items ?? [], dateKey));
        setWorkflowState("idle");
      } catch (e: any) {
        setDraft(null);
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
        setPlans(items);

        if (items.length === 0) {
          setSelectedPlanId("");
          setDraft(null);
          setLastSession(null);
          setLoading(false);
          return;
        }

        const fallbackPlan = items[0];
        const plan = items.find((entry) => entry.id === nextQuery.planId) ?? fallbackPlan;
        setSelectedPlanId(plan.id);
        await loadWorkoutContext(plan.id, plan.name, nextQuery.date, nextPreferences);

        if (nextQuery.openAdd) {
          setAddSheetOpen(true);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "플랜 목록을 불러오지 못했습니다.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadWorkoutContext]);

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

  const handleAddExercise = useCallback(() => {
    if (!draft) return;
    const exerciseName = addDraft.exerciseName.trim();
    if (!exerciseName) {
      setExerciseOptionsError("운동종목을 선택하거나 입력하세요.");
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
        sets: addDraft.sets,
        reps: addDraft.reps,
        memo: addDraft.memo,
      });
    });
    setWorkflowState("editing");
    setAddSheetOpen(false);
    setExerciseOptionsError(null);
    setAddDraft({
      exerciseId: null,
      exerciseName: "",
      weightKg: 0,
      sets: 3,
      reps: 5,
      memo: "",
    });
  }, [addDraft, draft, resolveWeightWithCurrentPreferences]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
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
        isBodyweightExercise: isBodyweightRelatedExerciseName,
      });
      await apiPost("/api/logs", payload);
      setWorkflowState("done");
      router.push("/");
    } catch (e: any) {
      setSaveError(e?.message ?? "운동기록 저장에 실패했습니다.");
      setWorkflowState("editing");
    }
  }, [draft, router, workoutPreferences.bodyweightKg]);

  const noPlan = !loading && !error && plans.length === 0;

  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <LoadingStateRows
        active={loading}
        delayMs={160}
        label="Workout Record 로딩 중"
        description="오늘 세션 자동 세팅과 지난 기록을 조회하고 있습니다."
      />
      <ErrorStateRows
        message={error}
        title="Workout Record 데이터를 불러오지 못했습니다"
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
        label="선택 가능한 프로그램이 없습니다"
        description="Program Store에서 프로그램을 시작한 뒤 다시 시도하세요."
      />

      {!noPlan && draft && (
        <>
          <section className="grid gap-2">
            <h2 className="ios-section-heading">선택된 프로그램 명</h2>
            <article className="motion-card rounded-2xl border p-4 grid gap-2">
              <strong>{draft.session.planName}</strong>
              <label className="grid gap-1">
                <span className="ui-card-label">프로그램 변경</span>
                <select
                  className="workout-set-input workout-set-input-text"
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
                </select>
              </label>
            </article>
          </section>

          <section className="grid gap-2">
            <h2 className="ios-section-heading">지난 세션 요약</h2>
            <article className="motion-card rounded-2xl border p-4 text-sm text-[var(--text-secondary)] grid gap-1">
              <span>{lastSession?.title ?? "지난 세션 없음"}</span>
              <span>{lastSession?.description ?? "저장된 세션이 없습니다."}</span>
            </article>
          </section>

          <section className="grid gap-2">
            <h2 className="ios-section-heading">오늘 수행 세션 요약</h2>
            <article className="motion-card rounded-2xl border p-4 grid gap-1 text-sm">
              <span>예상 1RM: {draft.session.estimatedE1rmKg === null ? "-" : `${draft.session.estimatedE1rmKg}kg`}</span>
              <span>예상 TM: {draft.session.estimatedTmKg === null ? "-" : `${draft.session.estimatedTmKg}kg`}</span>
              <span>주차: Week {draft.session.week}</span>
              <span>세션: {draft.session.sessionType}</span>
              <span>Session Key: {draft.session.sessionKey}</span>
              <span>Bodyweight: {workoutPreferences.bodyweightKg ? `${workoutPreferences.bodyweightKg.toFixed(1)}kg` : "미설정"}</span>
              <span className="text-[var(--accent-primary)]">
                편집 상태: {stateLabel(workflowState)} / 변경사항: {hasWorkoutEdits(draft) ? "있음" : "없음"}
              </span>
            </article>
          </section>

          <section className="grid gap-2">
            <h2 className="ios-section-heading">기록 본문 영역</h2>
            <article className="motion-card rounded-2xl border p-4 grid gap-3">
              <p className="text-sm text-[var(--text-secondary)]">
                프로그램 로직 기반 자동 세팅 + 사용자 편집 레이어를 함께 적용합니다.
              </p>

              {visibleExercises.map((exercise) => (
                <ExerciseRow
                  key={exercise.id}
                  exercise={exercise}
                  minimumPlateIncrementKg={resolveMinimumPlateIncrementKg(workoutPreferences, {
                    exerciseId: exercise.exerciseId,
                    exerciseName: exercise.exerciseName,
                  })}
                  bodyweightKg={workoutPreferences.bodyweightKg}
                  onChangeName={(value) => {
                    if (exercise.source === "PROGRAM") {
                      applyEditing((prev) => patchSeedExercise(prev, exercise.id, { exerciseName: value }));
                      return;
                    }
                    applyEditing((prev) => updateUserExercise(prev, exercise.id, { exerciseName: value }));
                  }}
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
                  onChangeSets={(value) => {
                    if (exercise.source === "PROGRAM") {
                      applyEditing((prev) => patchSeedExercise(prev, exercise.id, { set: { count: value } }));
                      return;
                    }
                    applyEditing((prev) => updateUserExercise(prev, exercise.id, { set: { count: value } }));
                  }}
                  onChangeReps={(value) => {
                    if (exercise.source === "PROGRAM") {
                      applyEditing((prev) => patchSeedExercise(prev, exercise.id, { set: { reps: value } }));
                      return;
                    }
                    applyEditing((prev) => updateUserExercise(prev, exercise.id, { set: { reps: value } }));
                  }}
                  onChangeMemo={(value) => {
                    if (exercise.source === "PROGRAM") {
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
                  <span className="text-sm text-[var(--text-secondary)]">+ 버튼으로 운동을 추가해 주세요.</span>
                </div>
              )}

              <button
                type="button"
                className="haptic-tap rounded-xl border px-4 py-3 text-center text-sm font-semibold"
                onClick={() => {
                  setAddSheetOpen(true);
                }}
              >
                + Add Exercise
              </button>

              <label className="grid gap-1">
                <span className="ui-card-label">세션 메모</span>
                <textarea
                  className="workout-set-input workout-set-input-text min-h-20"
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
        onClose={() => setAddSheetOpen(false)}
        closeLabel="닫기"
        footer={
          <div className="grid gap-2">
            <button
              type="button"
              className="ui-primary-button"
              onClick={handleAddExercise}
              disabled={!addDraft.exerciseName.trim()}
            >
              기록 영역에 추가
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="ui-card-label">운동종목 검색</span>
            <input
              className="workout-set-input workout-set-input-text"
              value={exerciseQuery}
              placeholder="예: Squat"
              onChange={(event) => setExerciseQuery(event.target.value)}
            />
          </label>

          <div className="grid gap-2 max-h-48 overflow-auto">
            {exerciseOptionsLoading && <span className="text-sm text-[var(--text-secondary)]">검색 중...</span>}
            {!exerciseOptionsLoading &&
              exerciseOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`haptic-tap rounded-xl border px-3 py-2 text-left text-sm ${
                    addDraft.exerciseId === option.id ? "border-[color:var(--accent-primary)]" : ""
                  }`}
                  onClick={() => {
                    setAddDraft((prev) => ({
                      ...prev,
                      exerciseId: option.id,
                      exerciseName: option.name,
                      weightKg: resolveWeightWithCurrentPreferences(prev.weightKg, option.id, option.name),
                    }));
                  }}
                >
                  <strong>{option.name}</strong>
                  {option.category ? <span className="ml-2 text-[var(--text-secondary)]">{option.category}</span> : null}
                </button>
              ))}
          </div>

          {exerciseOptionsError ? <p className="text-sm text-[var(--color-warning)]">{exerciseOptionsError}</p> : null}

          <label className="grid gap-1">
            <span className="ui-card-label">운동종목</span>
            <input
              className="workout-set-input workout-set-input-text"
              value={addDraft.exerciseName}
              onChange={(event) =>
                setAddDraft((prev) => ({
                  ...prev,
                  exerciseId: null,
                  exerciseName: event.target.value,
                  weightKg: resolveWeightWithCurrentPreferences(prev.weightKg, null, event.target.value),
                }))
              }
            />
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="grid gap-1">
              <span className="ui-card-label">무게 (kg)</span>
              <input
                className="workout-set-input workout-set-input-number"
                type="number"
                inputMode="decimal"
                min={0}
                step={addDraftIncrementKg}
                value={addDraft.weightKg}
                onChange={(event) =>
                  setAddDraft((prev) => ({
                    ...prev,
                    weightKg: resolveWeightWithCurrentPreferences(
                      Number(event.target.value),
                      prev.exerciseId,
                      prev.exerciseName,
                    ),
                  }))
                }
              />
            </label>
            <NumberStepper
              label="세트"
              value={addDraft.sets}
              min={1}
              max={50}
              onChange={(value) => setAddDraft((prev) => ({ ...prev, sets: value }))}
            />
            <NumberStepper
              label="횟수"
              value={addDraft.reps}
              min={1}
              max={100}
              onChange={(value) => setAddDraft((prev) => ({ ...prev, reps: value }))}
            />
          </div>

          <div className="grid gap-1 rounded-xl border p-2 text-xs text-[var(--text-secondary)]">
            <span>적용 Increment: {addDraftIncrementKg.toFixed(2)}kg</span>
            {isBodyweightRelatedExerciseName(addDraft.exerciseName) ? (
              <span>
                {workoutPreferences.bodyweightKg
                  ? `총 부하(외부중량 + 체중): ${addDraftTotalLoadKg?.toFixed(2) ?? "-"}kg`
                  : "체중 설정값이 없어서 총 부하 계산은 생략됩니다."}
              </span>
            ) : null}
          </div>

          <label className="grid gap-1">
            <span className="ui-card-label">메모</span>
            <textarea
              className="workout-set-input workout-set-input-text min-h-20"
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
