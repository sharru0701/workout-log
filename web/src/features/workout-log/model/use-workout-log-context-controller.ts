"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { resolveWorkoutLogBootstrap } from "@/features/workout-log/model/bootstrap";
import {
  loadWorkoutContextData,
  type LoadWorkoutContextInput,
} from "@/features/workout-log/model/context-loader";
import {
  readWorkoutLogQueryContext,
  type WorkoutLogQueryContext,
} from "@/features/workout-log/model/query-context";
import type {
  WorkoutLogLastSessionSummary,
  WorkoutLogPlanItem,
  WorkoutLogRecentLogItem,
} from "@/features/workout-log/model/types";
import type {
  WorkoutRecordDraft,
  WorkoutProgramExerciseEntryStateMap,
  WorkoutWorkflowState,
} from "@/entities/workout-record";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import {
  toDefaultWorkoutPreferences,
  type WorkoutPreferences,
} from "@/lib/settings/workout-preferences";

type UseWorkoutLogContextControllerInput = {
  initialPlans?: WorkoutLogPlanItem[];
  initialSettings?: import("@/lib/settings/workout-preferences").SettingsSnapshot | null;
  query: WorkoutLogQueryContext;
  setQuery: Dispatch<SetStateAction<WorkoutLogQueryContext>>;
  selectedPlanId: string;
  setSelectedPlanId: Dispatch<SetStateAction<string>>;
  locale: "ko" | "en";
  browserTimezone: string;
  applyWeightRulesToDraft: (
    sourceDraft: WorkoutRecordDraft,
    preferences: WorkoutPreferences,
  ) => WorkoutRecordDraft;
  hasRestoredDraft: () => boolean;
  registerReloadDraftContext: (fn: (() => Promise<void>) | null) => void;
  setDraft: Dispatch<SetStateAction<WorkoutRecordDraft | null>>;
  setProgramEntryState: Dispatch<SetStateAction<WorkoutProgramExerciseEntryStateMap>>;
  setWorkflowState: Dispatch<SetStateAction<WorkoutWorkflowState>>;
  setSaveError: Dispatch<SetStateAction<string | null>>;
  onNoPlanDetected: () => Promise<void>;
  onBootstrapOpenAddSheet: () => void;
};

export function useWorkoutLogContextController({
  initialPlans,
  initialSettings,
  query,
  setQuery,
  selectedPlanId,
  setSelectedPlanId,
  locale,
  browserTimezone,
  applyWeightRulesToDraft,
  hasRestoredDraft,
  registerReloadDraftContext,
  setDraft,
  setProgramEntryState,
  setWorkflowState,
  setSaveError,
  onNoPlanDetected,
  onBootstrapOpenAddSheet,
}: UseWorkoutLogContextControllerInput) {
  const [plans, setPlans] = useState<WorkoutLogPlanItem[]>([]);
  const [recentLogItems, setRecentLogItems] = useState<WorkoutLogRecentLogItem[]>([]);
  const [lastSession, setLastSession] = useState<WorkoutLogLastSessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [plansLoadKey, setPlansLoadKey] = useState("workout-record:init");
  const [error, setError] = useState<string | null>(null);
  const [workoutPreferences, setWorkoutPreferences] = useState<WorkoutPreferences>(toDefaultWorkoutPreferences);

  const selectedPlan = useMemo(
    () => plans.find((entry) => entry.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const contextHasLoadedRef = useRef(false);

  const loadWorkoutContext = useCallback(
    async (input: LoadWorkoutContextInput & { isRefresh?: boolean }) => {
      try {
        if (!contextHasLoadedRef.current && !input.isRefresh) {
          setLoading(true);
        }
        setError(null);
        setSaveError(null);

        const result = await loadWorkoutContextData(input, {
          browserTimezone,
          locale,
          applyWeightRulesToDraft,
        });

        if (result.kind === "blocked") {
          setDraft(null);
          setProgramEntryState({});
          setLastSession(null);
          setError(result.message);
          setWorkflowState("idle");
          return;
        }

        setSelectedPlanId(result.selectedPlanId);

        if (!hasRestoredDraft()) {
          setDraft(result.draft);
          setProgramEntryState(result.programEntryState);
        }

        setRecentLogItems(result.recentLogItems);
        setLastSession(result.lastSession);
        setWorkflowState((prev) => (hasRestoredDraft() ? prev : "idle"));
        contextHasLoadedRef.current = true;
      } catch (e: any) {
        setDraft(null);
        setProgramEntryState({});
        setLastSession(null);
        setError(
          e?.message ??
            (locale === "ko"
              ? "운동기록 화면 데이터를 불러오지 못했습니다."
              : "Could not load the workout log screen."),
        );
      } finally {
        setLoading(false);
      }
    },
    [
      applyWeightRulesToDraft,
      browserTimezone,
      hasRestoredDraft,
      locale,
      setDraft,
      setProgramEntryState,
      setSaveError,
      setSelectedPlanId,
      setWorkflowState,
    ],
  );

  useEffect(() => {
    registerReloadDraftContext(async () => {
      const plan = selectedPlan;
      const prefs = workoutPreferences;
      const currentQuery = query;
      const resolvedPlanId = plan?.id ?? currentQuery.planId ?? "";
      const resolvedPlanName = plan?.name ?? (locale === "ko" ? "프로그램 미선택" : "No Program Selected");
      if (!resolvedPlanId) return;
      await loadWorkoutContext({
        planId: resolvedPlanId,
        planName: resolvedPlanName,
        dateKey: currentQuery.date,
        preferences: prefs,
        planAutoProgression: plan?.params?.autoProgression === true,
        planSchedule: plan?.params?.schedule,
        planParams: plan?.params ?? null,
        isRefresh: true,
      });
    });
    return () => {
      registerReloadDraftContext(null);
    };
  }, [selectedPlan, workoutPreferences, query, loadWorkoutContext, locale, registerReloadDraftContext]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nextQuery = readWorkoutLogQueryContext();
      setQuery(nextQuery);
      setPlansLoadKey(
        `workout-record:${nextQuery.date}:${nextQuery.planId ?? ""}:${nextQuery.logId ?? ""}:${Date.now()}`,
      );
      setLoading(true);
      setError(null);

      try {
        const bootstrap = await resolveWorkoutLogBootstrap({
          query: nextQuery,
          initialPlans,
          initialSettings,
          locale,
        });
        if (cancelled) return;

        setWorkoutPreferences(bootstrap.preferences);

        if (bootstrap.kind === "no-plan") {
          setSelectedPlanId("");
          setDraft(null);
          setProgramEntryState({});
          setLastSession(null);
          setWorkflowState("idle");
          setSaveError(null);
          setLoading(false);
          await onNoPlanDetected();
          return;
        }

        setPlans(bootstrap.plans);
        setSelectedPlanId(bootstrap.loadInput.planId);
        await loadWorkoutContext(bootstrap.loadInput);

        if (bootstrap.openAdd) {
          onBootstrapOpenAddSheet();
        }
      } catch (e: any) {
        if (!cancelled) {
          setDraft(null);
          setProgramEntryState({});
          setError(
            e?.message ??
              (locale === "ko" ? "플랜 목록을 불러오지 못했습니다." : "Could not load the plans list."),
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    initialPlans,
    initialSettings,
    loadWorkoutContext,
    locale,
    onBootstrapOpenAddSheet,
    onNoPlanDetected,
    setDraft,
    setProgramEntryState,
    setQuery,
    setSelectedPlanId,
    setSaveError,
    setWorkflowState,
  ]);

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
    [plans, loadWorkoutContext, query.date, query.logId, setSelectedPlanId, workoutPreferences],
  );

  const retryCurrentContextLoad = useCallback(() => {
    const resolvedPlanId = selectedPlan?.id ?? query.planId ?? "";
    const resolvedPlanName = selectedPlan?.name ?? (locale === "ko" ? "프로그램 미선택" : "No Program Selected");
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
  }, [loadWorkoutContext, locale, query, selectedPlan, workoutPreferences]);

  const isPlansSettled = useQuerySettled(plansLoadKey, loading);
  const noPlan = isPlansSettled && !error && plans.length === 0 && !query.logId;

  return {
    query,
    plans,
    selectedPlanId,
    recentLogItems,
    lastSession,
    loading,
    error,
    workoutPreferences,
    selectedPlan,
    noPlan,
    handlePlanChange,
    retryCurrentContextLoad,
  };
}
