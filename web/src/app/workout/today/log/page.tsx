"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import { apiGet, apiPost, isAbortError } from "@/lib/api";
import {
  computeExternalLoadFromTotalKg,
  formatExerciseLoadLabel,
} from "@/lib/bodyweight-load";
import { progressionTone, summarizeProgression, type ProgressionSummaryPayload } from "@/lib/progression/summary";
import { buildSessionKey, formatSessionKeyLabel, parseSessionKey } from "@/lib/session-key";
import { fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { readWorkoutPreferences, toDefaultWorkoutPreferences } from "@/lib/settings/workout-preferences";
import {
  enqueueWorkoutLog,
  getPendingWorkoutLogCount,
  isLikelyNetworkError,
  offlineQueueUpdateEventName,
  syncPendingWorkoutLogsViaApi,
  type WorkoutLogRequest,
} from "@/lib/offlineLogQueue";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import {
  getUnsyncedWorkoutUxEvents,
  markWorkoutUxEventsSynced,
  pickWorkoutUxGuidedHint,
  summarizeStoredWorkoutUxEvents,
  summarizeUnsyncedWorkoutUxEvents,
  trackWorkoutUxEvent,
  type WorkoutUxGuidedHint,
  type WorkoutUxSummary,
} from "@/lib/workout-ux-events";
import WorkoutSetRow from "./_components/workout-set-row";
import { AccordionSection } from "@/components/ui/accordion-section";
import { AppPlusMinusIcon, AppSelect, AppTextInput } from "@/components/ui/form-controls";
import { NumberPickerField } from "@/components/ui/number-picker-sheet";
import { InlineDisclosure } from "@/components/ui/inline-disclosure";
import { PrimaryButton } from "@/components/ui/primary-button";
import { DisabledStateRows, EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";

const WorkoutAddExerciseSheet = dynamic(() => import("./_components/workout-add-exercise-sheet"), {
  ssr: false,
  loading: () => null,
});

const WorkoutOverridesSheet = dynamic(() => import("./_components/workout-overrides-sheet"), {
  ssr: false,
  loading: () => null,
});

type SetRow = {
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

let workoutSetRowSequence = 0;

function createSetRowId() {
  workoutSetRowSequence += 1;
  return `set-row-${workoutSetRowSequence}`;
}

function createSetRow(row: Omit<SetRow, "id">): SetRow {
  return {
    id: createSetRowId(),
    ...row,
  };
}

type Plan = {
  id: string;
  userId: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
  params: any;
  createdAt: string;
};

type RecentGeneratedSession = {
  id: string;
  sessionKey: string;
  updatedAt: string;
};

type ExerciseOption = {
  id: string;
  name: string;
  category: string | null;
  aliases: string[];
};

type UxSummaryResp = {
  from: string;
  to: string;
  rangeDays: number;
  totalEvents: number;
  summary: WorkoutUxSummary;
};

type LogFocusMode = "BEGINNER" | "POWER";

type SaveLogResponse = {
  log: {
    id: string;
  };
  progression?: ProgressionSummaryPayload | null;
};

function toSetRowsFromPlannedExercises(snapshot: any, bodyweightKg: number | null): SetRow[] {
  const planned = Array.isArray(snapshot?.exercises) ? snapshot.exercises : [];
  const rows: SetRow[] = [];

  for (const ex of planned) {
    const exerciseName = String(ex?.exerciseName ?? "").trim();
    if (!exerciseName) continue;
    const sets = Array.isArray(ex?.sets) && ex.sets.length > 0 ? ex.sets : [{}];
    sets.forEach((s: any, idx: number) => {
      const reps = Number(s?.reps ?? 0);
      const totalTargetWeightKg = Number(s?.targetWeightKg ?? 0);
      const weightKg =
        computeExternalLoadFromTotalKg(
          exerciseName,
          Number.isFinite(totalTargetWeightKg) ? totalTargetWeightKg : 0,
          bodyweightKg,
        ) ??
        totalTargetWeightKg;
      const rpe = Number(s?.rpe ?? 0);
      const percent = Number(s?.percent ?? 0);
      rows.push(createSetRow({
        exerciseName,
        setNumber: idx + 1,
        reps: Number.isFinite(reps) ? reps : 0,
        weightKg: Number.isFinite(weightKg) ? weightKg : 0,
        rpe: Number.isFinite(rpe) ? rpe : 0,
        isExtra: false,
        isPlanned: true,
        completed: false,
        plannedRef: {
          exerciseName,
          setNumber: idx + 1,
          rowType: typeof ex?.rowType === "string" ? ex.rowType : undefined,
          progressionTarget: typeof ex?.progressionTarget === "string" ? ex.progressionTarget : undefined,
          progressionKey: typeof ex?.progressionKey === "string" ? ex.progressionKey : undefined,
          progressionLabel: exerciseName,
          reps: Number.isFinite(reps) ? reps : undefined,
          targetWeightKg: Number.isFinite(weightKg) ? weightKg : undefined,
          totalTargetWeightKg: Number.isFinite(totalTargetWeightKg) ? totalTargetWeightKg : undefined,
          rpe: Number.isFinite(rpe) ? rpe : undefined,
          percent: Number.isFinite(percent) && percent > 0 ? percent : undefined,
          note: typeof s?.note === "string" ? s.note : undefined,
        },
      }));
    });
  }

  return rows;
}

function dateOnlyInTimezone(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export default function WorkoutTodayPage() {
  const setGridColCount = 5;
  const [userId, setUserId] = useState("dev");
  const [planId, setPlanId] = useState("");
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState(1);
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [sessionDate, setSessionDate] = useState(() =>
    dateOnlyInTimezone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
  );
  const [bodyweightKg, setBodyweightKg] = useState<number | null>(toDefaultWorkoutPreferences().bodyweightKg);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [initialPlanLoadDone, setInitialPlanLoadDone] = useState(false);
  const [recentSessions, setRecentSessions] = useState<RecentGeneratedSession[]>([]);
  const [loadingRecentSessions, setLoadingRecentSessions] = useState(false);
  const [selectedRecentSessionId, setSelectedRecentSessionId] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  const [generatedSession, setGeneratedSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progressionSummary, setProgressionSummary] = useState<ProgressionSummaryPayload | null>(null);
  const [lastSavedLogId, setLastSavedLogId] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncingPending, setIsSyncingPending] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const [sets, setSets] = useState<SetRow[]>([]);
  const [selectedSetIdx, setSelectedSetIdx] = useState<number | null>(null);
  const [blockTarget, setBlockTarget] = useState("BENCH");
  const [replacementExerciseName, setReplacementExerciseName] = useState("");
  const [overridesSheetOpen, setOverridesSheetOpen] = useState(false);
  const [addExerciseSheetOpen, setAddExerciseSheetOpen] = useState(false);
  const [shouldRenderOverridesSheet, setShouldRenderOverridesSheet] = useState(false);
  const [shouldRenderAddExerciseSheet, setShouldRenderAddExerciseSheet] = useState(false);
  const [addExerciseQuery, setAddExerciseQuery] = useState("");
  const [selectedAddExerciseName, setSelectedAddExerciseName] = useState("");
  const [autoGeneratedFromQuery, setAutoGeneratedFromQuery] = useState(false);
  const [queryAutoGenerate, setQueryAutoGenerate] = useState(false);
  const [focusMode, setFocusMode] = useState<LogFocusMode>("BEGINNER");
  const [guidedHint, setGuidedHint] = useState<WorkoutUxGuidedHint | null>(null);
  const [serverUxSummary, setServerUxSummary] = useState<WorkoutUxSummary | null>(null);
  const [isUxSyncing, setIsUxSyncing] = useState(false);
  const [uxSyncNotice, setUxSyncNotice] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{ row: number; col: number } | null>(null);
  const setInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const setsLengthRef = useRef(0);
  const pendingSyncInFlight = useRef(false);
  const uxSyncInFlight = useRef(false);
  const uxSyncControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const sessionSwipeStartX = useRef<number | null>(null);

  const derivedGeneratedId = generatedSession?.id as string | undefined;
  const snapshot = generatedSession?.snapshot;
  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId]);
  const planType = snapshot?.plan?.type ?? selectedPlan?.type;
  const sessionKeyMode = String(selectedPlan?.params?.sessionKeyMode ?? "").toUpperCase();
  const sessionKey =
    generatedSession?.sessionKey ??
    snapshot?.sessionKey ??
    buildSessionKey({
      mode: sessionKeyMode,
      sessionDate,
      week,
      day,
      autoProgression: selectedPlan?.params?.autoProgression === true,
    });

  const isPowerMode = focusMode === "POWER";
  const setCellKey = useCallback((row: number, col: number) => `${row}:${col}`, []);
  const registerSetInputRef = useCallback((key: string, element: HTMLInputElement | null) => {
    setInputRefs.current[key] = element;
  }, []);
  setsLengthRef.current = sets.length;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchSettingsSnapshot(controller.signal)
      .then((snapshot) => {
        if (cancelled) return;
        setBodyweightKg(readWorkoutPreferences(snapshot).bodyweightKg);
      })
      .catch((error) => {
        if (cancelled || isAbortError(error)) return;
        setBodyweightKg(toDefaultWorkoutPreferences().bodyweightKg);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      uxSyncControllerRef.current?.abort();
    };
  }, []);

  function mergeUxSummary(base: WorkoutUxSummary, extra: WorkoutUxSummary): WorkoutUxSummary {
    return {
      opens: base.opens + extra.opens,
      modeChanges: base.modeChanges + extra.modeChanges,
      generateClicks: base.generateClicks + extra.generateClicks,
      generateSuccesses: base.generateSuccesses + extra.generateSuccesses,
      addSheetOpens: base.addSheetOpens + extra.addSheetOpens,
      addExerciseAdds: base.addExerciseAdds + extra.addExerciseAdds,
      saveClicks: base.saveClicks + extra.saveClicks,
      saveSuccesses: base.saveSuccesses + extra.saveSuccesses,
      saveFailures: base.saveFailures + extra.saveFailures,
      repeatClicks: base.repeatClicks + extra.repeatClicks,
      repeatSuccesses: base.repeatSuccesses + extra.repeatSuccesses,
    };
  }

  function trackEvent(name: string, props?: Record<string, string | number | boolean | null>) {
    trackWorkoutUxEvent(name, {
      mode: focusMode,
      planSelected: Boolean(planId),
      ...props,
    });
    refreshGuidedHint();
    if (typeof window !== "undefined" && navigator.onLine) {
      const unsyncedCount = getUnsyncedWorkoutUxEvents(12).length;
      if (unsyncedCount >= 12) {
        void syncUxEventsWithServer("threshold");
      }
    }
  }

  function setFocusModeWithTracking(nextMode: LogFocusMode, source: "toggle" | "shortcut") {
    setFocusMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("workoutlog:focus-mode", nextMode);
    }
    trackWorkoutUxEvent("workout_focus_mode_changed", {
      mode: nextMode,
      nextMode,
      source,
      planSelected: Boolean(planId),
    });
    refreshGuidedHint();
  }

  function openAddExerciseSheet(source: "quick" | "advanced" | "empty" | "shortcut") {
    setShouldRenderAddExerciseSheet(true);
    setAddExerciseSheetOpen(true);
    trackEvent("workout_add_exercise_sheet_opened", { source });
  }

  function refreshGuidedHint(serverSummaryOverride?: WorkoutUxSummary | null) {
    const serverSummary = serverSummaryOverride ?? serverUxSummary;
    const mergedSummary = serverSummary
      ? mergeUxSummary(serverSummary, summarizeUnsyncedWorkoutUxEvents({ withinDays: 14 }))
      : summarizeStoredWorkoutUxEvents({ withinDays: 14 });
    const nextHint = pickWorkoutUxGuidedHint(mergedSummary);
    setGuidedHint(nextHint);
  }

  async function syncUxEventsWithServer(reason: "initial" | "online" | "manual" | "threshold") {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) {
      if (reason === "manual") {
        setUxSyncNotice("오프라인에서는 행동 로그를 동기화할 수 없습니다.");
      }
      return;
    }
    if (uxSyncInFlight.current) return;
    uxSyncInFlight.current = true;
    const controller = new AbortController();
    uxSyncControllerRef.current?.abort();
    uxSyncControllerRef.current = controller;
    setIsUxSyncing(true);
    if (reason === "manual") {
      setUxSyncNotice(null);
    }

    try {
      const unsynced = getUnsyncedWorkoutUxEvents(180);
      if (unsynced.length > 0) {
        const syncRes = await apiPost<{
          acceptedIds: string[];
          acceptedCount: number;
          droppedCount: number;
        }>("/api/ux-events", { events: unsynced }, { signal: controller.signal });
        if (!isMountedRef.current || uxSyncControllerRef.current !== controller) return;
        markWorkoutUxEventsSynced(syncRes.acceptedIds);
        if (reason === "manual") {
          setUxSyncNotice(`행동 로그 ${syncRes.acceptedCount}건을 동기화했습니다.`);
        }
      } else if (reason === "manual") {
        setUxSyncNotice("동기화할 행동 로그가 없습니다.");
      }

      const summaryRes = await apiGet<UxSummaryResp>("/api/stats/ux-events-summary?days=14", {
        signal: controller.signal,
      });
      if (!isMountedRef.current || uxSyncControllerRef.current !== controller) return;
      setServerUxSummary(summaryRes.summary);
      refreshGuidedHint(summaryRes.summary);
    } catch (error) {
      if (isAbortError(error)) return;
      if (reason === "manual") {
        setUxSyncNotice("행동 로그 동기화에 실패했습니다. 잠시 후 다시 시도하세요.");
      }
    } finally {
      if (uxSyncControllerRef.current === controller) {
        uxSyncControllerRef.current = null;
      }
      uxSyncInFlight.current = false;
      if (isMountedRef.current) {
        setIsUxSyncing(false);
      }
    }
  }

  const refreshPendingSyncCount = () => {
    if (typeof window === "undefined") return;
    setPendingSyncCount(getPendingWorkoutLogCount());
  };

  async function syncPendingQueuedLogs() {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) return;
    if (pendingSyncInFlight.current) return;
    if (getPendingWorkoutLogCount() === 0) {
      setPendingSyncCount(0);
      setSyncNotice(null);
      return;
    }

    pendingSyncInFlight.current = true;
    setIsSyncingPending(true);
    setSyncNotice("대기 로그 동기화 중...");
    try {
      const result = await syncPendingWorkoutLogsViaApi();
      setPendingSyncCount(result.remaining);
      if (result.synced > 0) {
        if (result.lastSyncedLogId) setLastSavedLogId(result.lastSyncedLogId);
        setSyncNotice(`${result.synced}건 동기화 완료`);
      } else if (result.failed > 0) {
        setSyncNotice(`동기화 대기: ${result.remaining}`);
      } else {
        setSyncNotice(null);
      }
    } finally {
      pendingSyncInFlight.current = false;
      setIsSyncingPending(false);
    }
  }

  const refreshPageData = useCallback(async () => {
    setRefreshTick((prev) => prev + 1);
  }, [refreshTick]);
  const pullToRefresh = usePullToRefresh({
    onRefresh: refreshPageData,
    triggerSelector: "[data-pull-refresh-trigger]",
  });

  function applyRecentSessionSelection(id: string) {
    setSelectedRecentSessionId(id);
    const picked = recentSessions.find((s) => s.id === id);
    if (!picked) return;
    const parsed = parseSessionKey(picked.sessionKey);
    if (!parsed) return;
    if (parsed.kind === "date") {
      setWeek(1);
      setDay(1);
    }
    if (parsed.week !== null) setWeek(parsed.week);
    if (parsed.day !== null) setDay(parsed.day);
    if (parsed.sessionDate) setSessionDate(parsed.sessionDate);
  }

  function selectAdjacentRecentSession(direction: -1 | 1) {
    if (recentSessions.length === 0) return;
    const currentIndex = selectedRecentSessionId
      ? recentSessions.findIndex((s) => s.id === selectedRecentSessionId)
      : 0;
    const safeCurrentIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = Math.max(0, Math.min(recentSessions.length - 1, safeCurrentIndex + direction));
    if (nextIndex === safeCurrentIndex) return;
    applyRecentSessionSelection(recentSessions[nextIndex].id);
  }

  function onRecentSessionSwipeStart(event: React.TouchEvent<HTMLDivElement>) {
    sessionSwipeStartX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function onRecentSessionSwipeEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (sessionSwipeStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? sessionSwipeStartX.current;
    const delta = endX - sessionSwipeStartX.current;
    sessionSwipeStartX.current = null;
    if (Math.abs(delta) < 34) return;
    selectAdjacentRecentSession(delta < 0 ? 1 : -1);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOfflineMode(false);
      setSyncNotice(null);
      refreshPendingSyncCount();
      void syncPendingQueuedLogs();
      void syncUxEventsWithServer("online");
    };

    const handleOffline = () => {
      setIsOfflineMode(true);
      setSyncNotice("오프라인 모드");
      refreshPendingSyncCount();
    };

    const handleStorage = () => {
      refreshPendingSyncCount();
    };

    const handleQueueUpdate = () => {
      refreshPendingSyncCount();
    };

    setIsOfflineMode(!navigator.onLine);
    refreshPendingSyncCount();
    if (navigator.onLine) {
      void syncPendingQueuedLogs();
      void syncUxEventsWithServer("online");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(offlineQueueUpdateEventName(), handleQueueUpdate);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(offlineQueueUpdateEventName(), handleQueueUpdate);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedMode = window.localStorage.getItem("workoutlog:focus-mode");
    if (savedMode === "BEGINNER" || savedMode === "POWER") {
      setFocusMode(savedMode);
      trackWorkoutUxEvent("workout_log_opened", { mode: savedMode });
    } else {
      trackWorkoutUxEvent("workout_log_opened", { mode: "BEGINNER" });
    }
    refreshGuidedHint();
    void syncUxEventsWithServer("initial");
  }, []);

  useEffect(() => {
    if (selectedSetIdx !== null && !sets[selectedSetIdx]) {
      setSelectedSetIdx(null);
    }
  }, [selectedSetIdx, sets]);

  useEffect(() => {
    if (!pendingFocus) return;
    const el = setInputRefs.current[setCellKey(pendingFocus.row, pendingFocus.col)];
    if (el) {
      el.focus();
      if (el.select) el.select();
    }
    setPendingFocus(null);
  }, [pendingFocus, sets.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const qPlanId = sp.get("planId");
    const qDate = sp.get("date");
    if (qPlanId) setPlanId(qPlanId);
    if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) setSessionDate(qDate);
    setQueryAutoGenerate(sp.get("autoGenerate") === "1");
  }, []);

  useEffect(() => {
    if (autoGeneratedFromQuery) return;
    if (!queryAutoGenerate) return;
    if (!planId) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return;

    setSuccess(null);
    setError(null);
    generateForDate(sessionDate)
      .then(() => setAutoGeneratedFromQuery(true))
      .catch((e: any) => setError(e?.message ?? "캘린더 자동 생성에 실패했습니다."));
  }, [autoGeneratedFromQuery, planId, queryAutoGenerate, sessionDate]);

  useEffect(() => {
    const tz = selectedPlan?.params?.timezone;
    if (typeof tz === "string" && tz.trim()) {
      setTimezone(tz);
    }
  }, [selectedPlan?.id, selectedPlan?.params?.timezone]);

  useEffect(() => {
    if (!success) {
      setProgressionSummary(null);
      return;
    }
    if (!success.startsWith("로그를 저장했습니다:")) {
      setProgressionSummary(null);
    }
  }, [success]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        setLoadingPlans(true);
        const res = await apiGet<{ items: Plan[] }>("/api/plans", { signal: controller.signal });
        if (cancelled) return;
        setPlans(res.items);
        setPlanId((prev) => {
          if (prev && res.items.some((p) => p.id === prev)) return prev;
          return res.items[0]?.id ?? "";
        });
      } catch (e: any) {
        if (cancelled || isAbortError(e)) return;
        setError(e?.message ?? "플랜 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setLoadingPlans(false);
          setInitialPlanLoadDone(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        setLoadingRecentSessions(true);
        const sp = new URLSearchParams();
        sp.set("limit", "20");
        if (planId) sp.set("planId", planId);

        const res = await apiGet<{ items: RecentGeneratedSession[] }>(`/api/generated-sessions?${sp.toString()}`, {
          signal: controller.signal,
        });
        if (cancelled) return;
        setRecentSessions(res.items);
        setSelectedRecentSessionId((prev) => (res.items.some((s) => s.id === prev) ? prev : ""));
      } catch (e: any) {
        if (cancelled || isAbortError(e)) return;
        setError(e?.message ?? "최근 세션을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoadingRecentSessions(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [planId, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await apiGet<{ items: ExerciseOption[] }>("/api/exercises?limit=200", {
          signal: controller.signal,
        });
        if (!cancelled) setExerciseOptions(res.items);
      } catch (error) {
        if (cancelled || isAbortError(error)) return;
        if (!cancelled) setExerciseOptions([]);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refreshTick]);

  const defaultExercisesFromSnapshot = useMemo(() => {
    const names: string[] = [];

    if (Array.isArray(snapshot?.exercises)) {
      for (const ex of snapshot.exercises) {
        if (ex?.exerciseName) names.push(ex.exerciseName);
      }
    }

    if (snapshot?.manualSession?.items) {
      for (const it of snapshot.manualSession.items) {
        if (it?.exerciseName) names.push(it.exerciseName);
      }
    }

    if (Array.isArray(snapshot?.blocks)) {
      for (const b of snapshot.blocks) {
        const repl = b?.replacements?.mainExercise;
        if (repl) names.push(repl);
        else if (b?.target) names.push(String(b.target));
      }
    }

    if (Array.isArray(snapshot?.accessories)) {
      for (const a of snapshot.accessories) {
        if (a?.exerciseName) names.push(a.exerciseName);
      }
    }

    return Array.from(new Set(names));
  }, [snapshot]);

  const addExerciseCandidates = useMemo(() => {
    const query = addExerciseQuery.trim().toLowerCase();
    const pool = [
      ...defaultExercisesFromSnapshot,
      ...exerciseOptions.map((option) => option.name),
      ...exerciseOptions.flatMap((option) => option.aliases),
    ];
    const seen = new Set<string>();
    const items: string[] = [];
    for (const raw of pool) {
      const name = String(raw ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      if (query && !key.includes(query)) continue;
      seen.add(key);
      items.push(name);
      if (items.length >= 24) break;
    }
    return items;
  }, [addExerciseQuery, defaultExercisesFromSnapshot, exerciseOptions]);

  useEffect(() => {
    if (addExerciseCandidates.length === 0) {
      setSelectedAddExerciseName("");
      return;
    }
    setSelectedAddExerciseName((prev) =>
      addExerciseCandidates.includes(prev) ? prev : (addExerciseCandidates[0] ?? ""),
    );
  }, [addExerciseCandidates]);

  const exerciseOptionList = useMemo(
    () =>
      exerciseOptions.flatMap((ex) => [
        <option key={`n-${ex.id}`} value={ex.name} />,
        ...ex.aliases.map((alias) => <option key={`a-${ex.id}-${alias}`} value={alias} />),
      ]),
    [exerciseOptions],
  );

  function applyGeneratedSession(session: any) {
    setGeneratedSession(session);
    const sKey = typeof session?.sessionKey === "string" ? session.sessionKey : null;
    const parsedKey = sKey ? parseSessionKey(sKey) : null;
    if (parsedKey?.sessionDate) {
      setSessionDate(parsedKey.sessionDate);
    }
    const nextWeek = Number(session?.snapshot?.week);
    const nextDay = Number(session?.snapshot?.day);
    if (Number.isFinite(nextWeek) && nextWeek >= 1) setWeek(nextWeek);
    if (Number.isFinite(nextDay) && nextDay >= 1) setDay(nextDay);
  }

  async function generateSessionAt(nextWeek: number, nextDay: number, opts?: { date?: string }) {
    if (!planId) throw new Error("planId가 필요합니다.");
    const dateValue = opts?.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : undefined;
    const res = await apiPost<{ session: any }>(`/api/plans/${planId}/generate`, {
      week: dateValue ? undefined : nextWeek,
      day: dateValue ? undefined : nextDay,
      sessionDate: dateValue,
      timezone,
    });
    applyGeneratedSession(res.session);
    return res.session;
  }

  async function generateSession() {
    await generateSessionAt(week, day);
  }

  async function generateForDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("날짜 형식은 YYYY-MM-DD여야 합니다.");
    setSessionDate(date);
    await generateSessionAt(week, day, { date });
  }

  async function generateForToday() {
    if (!planId) throw new Error("planId가 필요합니다.");
    const today = dateOnlyInTimezone(new Date(), timezone);
    await generateForDate(today);
    setSuccess(`오늘 기준 세션을 생성했습니다: ${today}`);
  }

  async function generateAndApplyForDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("날짜 형식은 YYYY-MM-DD여야 합니다.");
    const session = await generateSessionAt(week, day, { date });
    const generatedRows = toSetRowsFromPlannedExercises(session?.snapshot, bodyweightKg);
    if (generatedRows.length === 0) throw new Error("생성된 세션에 계획 운동이 없습니다.");
    setSets(generatedRows);
    setSelectedSetIdx(null);
    setSuccess(`계획 세트 ${generatedRows.length}개를 불러와 적용했습니다 (${date})`);
  }

  const makeNextSetFromRow = useCallback((baseRow: SetRow, rows: SetRow[]): SetRow => {
    const nextSetNumber =
      rows
        .filter((r) => r.exerciseName.trim().toLowerCase() === baseRow.exerciseName.trim().toLowerCase())
        .reduce((max, r) => Math.max(max, r.setNumber), 0) + 1;

    return createSetRow({
      exerciseName: baseRow.exerciseName,
      setNumber: nextSetNumber,
      reps: baseRow.reps,
      weightKg: baseRow.weightKg,
      rpe: baseRow.rpe,
      isExtra: baseRow.isExtra,
      isPlanned: false,
      completed: false,
      plannedRef: null,
    });
  }, []);

  const moveFocusInSetGrid = useCallback((row: number, col: number) => {
    if (row < 0 || row >= setsLengthRef.current) return;
    const safeCol = Math.max(0, Math.min(setGridColCount - 1, col));
    setPendingFocus({ row, col: safeCol });
  }, [setGridColCount]);

  const insertSetBelow = useCallback((idx: number, focusCol = 0) => {
    setSets((prev) => {
      const row = prev[idx];
      if (!row) return prev;
      const next = [...prev];
      next.splice(idx + 1, 0, makeNextSetFromRow(row, next));
      return next;
    });
    setPendingFocus({ row: idx + 1, col: focusCol });
  }, [makeNextSetFromRow]);

  const handleSetGridKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      insertSetBelow(row, col);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveFocusInSetGrid(row - 1, col);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveFocusInSetGrid(row + 1, col);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveFocusInSetGrid(row, col - 1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      moveFocusInSetGrid(row, col + 1);
    }
  }, [insertSetBelow, moveFocusInSetGrid]);

  const addSetRow = useCallback(() => {
    const ex = defaultExercisesFromSnapshot[0] ?? "Accessory";
    let nextFocusRow = 0;
    setSets((prev) => {
      nextFocusRow = prev.length;
      return [
        ...prev,
        createSetRow({
        exerciseName: ex,
        setNumber: 1,
        reps: 10,
        weightKg: 0,
        rpe: 8,
        isExtra: true,
        isPlanned: false,
        completed: false,
        plannedRef: null,
        }),
      ];
    });
    setPendingFocus({ row: nextFocusRow, col: 0 });
  }, [defaultExercisesFromSnapshot]);

  const addExerciseByName = useCallback((exerciseName: string) => {
    const trimmedName = exerciseName.trim();
    if (!trimmedName) throw new Error("운동 이름을 입력하세요.");
    let nextFocusRow = 0;
    setSets((prev) => {
      nextFocusRow = prev.length;
      const nextSetNumber =
        prev
          .filter((row) => row.exerciseName.trim().toLowerCase() === trimmedName.toLowerCase())
          .reduce((max, row) => Math.max(max, row.setNumber), 0) + 1;
      return [
        ...prev,
        createSetRow({
          exerciseName: trimmedName,
          setNumber: nextSetNumber,
          reps: 10,
          weightKg: 0,
          rpe: 8,
          isExtra: true,
          isPlanned: false,
          completed: false,
          plannedRef: null,
        }),
      ];
    });
    setPendingFocus({ row: nextFocusRow, col: 0 });
  }, []);

  function addExerciseFromSheet(exerciseName: string) {
    try {
      addExerciseByName(exerciseName);
      setAddExerciseSheetOpen(false);
      setAddExerciseQuery("");
      setSuccess(`${exerciseName} 운동을 추가했습니다.`);
      setError(null);
      trackEvent("workout_add_exercise_added", {
        source: "sheet",
        exerciseNameLength: exerciseName.trim().length,
      });
    } catch (e: any) {
      setError(e?.message ?? "운동 추가에 실패했습니다.");
      trackEvent("workout_add_exercise_failed", { source: "sheet" });
    }
  }

  async function runGenerateAndApply(date: string, source: "quick" | "empty") {
    trackEvent("workout_generate_apply_clicked", { source });
    try {
      await generateAndApplyForDate(date);
      trackEvent("workout_generate_apply_succeeded", { source });
    } catch (error) {
      trackEvent("workout_generate_apply_failed", { source });
      throw error;
    }
  }

  async function runRepeatLastWorkout(source: "quick" | "advanced") {
    trackEvent("workout_repeat_last_clicked", { source });
    try {
      await repeatLastWorkout();
      trackEvent("workout_repeat_last_succeeded", { source });
    } catch (error) {
      trackEvent("workout_repeat_last_failed", { source });
      throw error;
    }
  }

  function runGuidedHintAction() {
    if (!guidedHint) return;
    setSuccess(null);
    setError(null);
    trackEvent("workout_guided_hint_action_clicked", { hintId: guidedHint.id, action: guidedHint.action });

    if (guidedHint.action === "generate_apply") {
      runGenerateAndApply(sessionDate, "quick").catch((e) => setError(e.message));
      return;
    }

    if (guidedHint.action === "add_exercise") {
      openAddExerciseSheet("shortcut");
      return;
    }

    if (guidedHint.action === "save_log") {
      void handleSaveLog();
      return;
    }

    setFocusModeWithTracking("POWER", "shortcut");
  }

  const applyPlannedSets = useCallback(() => {
    const generatedRows = toSetRowsFromPlannedExercises(snapshot, bodyweightKg);
    if (generatedRows.length === 0) throw new Error("스냅샷에 계획 운동이 없습니다.");
    setSets(generatedRows);
    setSelectedSetIdx(null);
    setSuccess(`계획 세트 ${generatedRows.length}개를 적용했습니다.`);
  }, [bodyweightKg, snapshot]);

  const completeSetAndAddNext = useCallback((idx: number) => {
    let nextFocusRow: number | null = null;
    setSets((prev) => {
      const row = prev[idx];
      if (!row) return prev;

      const next = [...prev];
      const wasCompleted = row.completed;
      next[idx] = { ...row, completed: true };
      if (wasCompleted) return next;
      next.push(makeNextSetFromRow(row, next));
      nextFocusRow = next.length - 1;
      return next;
    });
    if (nextFocusRow !== null) {
      setPendingFocus({ row: nextFocusRow, col: 0 });
    }
  }, [makeNextSetFromRow]);

  const copyPreviousSet = useCallback((idx: number) => {
    setSets((prev) => {
      const current = prev[idx];
      if (!current || idx < 1) return prev;

      let sourceIdx = -1;
      for (let i = idx - 1; i >= 0; i -= 1) {
        if (
          prev[i]?.exerciseName.trim().toLowerCase() === current.exerciseName.trim().toLowerCase()
        ) {
          sourceIdx = i;
          break;
        }
      }
      if (sourceIdx < 0) sourceIdx = idx - 1;
      const source = prev[sourceIdx];
      if (!source) return prev;

      const next = [...prev];
      next[idx] = {
        ...next[idx],
        reps: source.reps,
        weightKg: source.weightKg,
        rpe: source.rpe,
      };
      return next;
    });
    setPendingFocus({ row: idx, col: 2 });
  }, []);

  function quickAddFromSelected() {
    if (selectedSetIdx === null) throw new Error("먼저 세트 행을 선택하세요.");
    const row = sets[selectedSetIdx];
    if (!row) throw new Error("선택한 세트 행을 찾을 수 없습니다.");

    let nextFocusRow = 0;
    setSets((prev) => {
      nextFocusRow = prev.length;
      return [
        ...prev,
        makeNextSetFromRow(row, prev),
      ];
    });
    setPendingFocus({ row: nextFocusRow, col: 0 });
  }

  const updateSetRow = useCallback((idx: number, updater: (row: SetRow) => SetRow) => {
    setSets((prev) => {
      if (!prev[idx]) return prev;
      const copy = [...prev];
      copy[idx] = updater(copy[idx]);
      return copy;
    });
  }, []);

  const removeSetRow = useCallback((idx: number) => {
    setSets((prev) => prev.filter((_, rowIdx) => rowIdx !== idx));
  }, []);

  async function repeatLastWorkout() {
    const sp = new URLSearchParams();
    sp.set("limit", "1");
    if (planId) sp.set("planId", planId);

    const res = await apiGet<{ items: Array<{ id: string; performedAt: string; sets: any[] }> }>(
      `/api/logs?${sp.toString()}`,
    );

    const last = res.items[0];
    if (!last) throw new Error("이전 운동 기록이 없습니다.");

    const rows: SetRow[] = (last.sets ?? []).map((s: any) => createSetRow({
      exerciseName: String(s.exerciseName ?? ""),
      setNumber: Number(s.setNumber ?? 1) || 1,
      reps: Number(s.reps ?? 0) || 0,
      weightKg: Number(s.weightKg ?? 0) || 0,
      rpe: Number(s.rpe ?? 0) || 0,
      isExtra: Boolean(s.isExtra ?? false),
      isPlanned: Boolean(s?.meta?.planned ?? false),
      completed: false,
      plannedRef: s?.meta?.plannedRef ?? null,
    }));

    if (rows.length === 0) throw new Error("이전 운동 기록에 세트가 없습니다.");
    setSets(rows);
    setSelectedSetIdx(null);
    setGeneratedSession(null);
    setSuccess(`이전 운동을 불러왔습니다: ${new Date(last.performedAt).toLocaleString()}`);
  }

  async function resolveExerciseId(
    name: string,
    opts?: { allowRemoteLookup?: boolean },
  ): Promise<string | null> {
    const needle = name.trim().toLowerCase();
    if (!needle) return null;
    const allowRemoteLookup = opts?.allowRemoteLookup ?? true;

    for (const ex of exerciseOptions) {
      if (ex.name.toLowerCase() === needle) return ex.id;
      if (ex.aliases.some((a) => a.toLowerCase() === needle)) return ex.id;
    }

    if (!allowRemoteLookup) return null;

    const res = await apiGet<{ items: ExerciseOption[] }>(
      `/api/exercises?query=${encodeURIComponent(name)}&limit=20`,
    );
    const exact = res.items.find(
      (ex) =>
        ex.name.toLowerCase() === needle || ex.aliases.some((a) => a.toLowerCase() === needle),
    );
    return exact?.id ?? null;
  }

  async function buildLogPayload(opts?: { allowRemoteLookup?: boolean }): Promise<WorkoutLogRequest> {
    if (!planId) throw new Error("planId가 필요합니다.");
    if (!sets.length) throw new Error("저장할 세트가 필요합니다.");
    const allowRemoteLookup = opts?.allowRemoteLookup ?? true;
    const exerciseIdCache = new Map<string, string | null>();
    const setsWithExerciseId = await Promise.all(
      sets.map(async (s) => {
        const key = s.exerciseName.trim().toLowerCase();
        if (!exerciseIdCache.has(key)) {
          try {
            exerciseIdCache.set(
              key,
              await resolveExerciseId(s.exerciseName, { allowRemoteLookup }),
            );
          } catch (error) {
            if (!isLikelyNetworkError(error)) throw error;
            exerciseIdCache.set(key, null);
          }
        }
        return {
          exerciseName: s.exerciseName,
          setNumber: s.setNumber,
          reps: s.reps,
          weightKg: s.weightKg,
          rpe: s.rpe,
          isExtra: s.isExtra,
          isPlanned: s.isPlanned,
          completed: s.completed,
          exerciseId: exerciseIdCache.get(key) ?? null,
          meta: {
            planned: Boolean(s.isPlanned),
            completed: Boolean(s.completed),
            plannedRef: s.plannedRef ?? null,
          },
        };
      }),
    );

    return {
      planId,
      generatedSessionId: derivedGeneratedId ?? null,
      notes: `W${week}D${day} (${planType ?? "unknown"})`,
      sets: setsWithExerciseId,
    };
  }

  async function saveLog(payload: WorkoutLogRequest) {
    return apiPost<SaveLogResponse>(`/api/logs`, payload);
  }

  async function handleSaveLog() {
    setSuccess(null);
    setError(null);
    setProgressionSummary(null);
    setLastSavedLogId(null);
    setSyncNotice(null);
    trackEvent("workout_save_clicked", { setCount: sets.length });

    try {
      const isOnline = typeof window === "undefined" ? true : navigator.onLine;
      const payload = await buildLogPayload({ allowRemoteLookup: isOnline });

      if (typeof window !== "undefined" && !isOnline) {
        enqueueWorkoutLog(payload);
        refreshPendingSyncCount();
        setIsOfflineMode(true);
        setSuccess("오프라인으로 저장했습니다. 온라인 복귀 시 자동 동기화됩니다.");
        setProgressionSummary(null);
        setSyncNotice("동기화 대기");
        trackEvent("workout_save_succeeded", { strategy: "offline-queued", setCount: payload.sets.length });
        return;
      }

      try {
        const saved = await saveLog(payload);
        const log = saved.log;
        setLastSavedLogId(log.id);
        setSuccess(`로그를 저장했습니다: ${log.id}`);
        setProgressionSummary(saved.progression ?? null);
        setIsOfflineMode(false);
        refreshPendingSyncCount();
        void syncPendingQueuedLogs();
        trackEvent("workout_save_succeeded", {
          strategy: "online",
          setCount: payload.sets.length,
          hasGeneratedSession: Boolean(derivedGeneratedId),
        });
      } catch (error) {
        if (isLikelyNetworkError(error)) {
          enqueueWorkoutLog(payload);
          refreshPendingSyncCount();
          setIsOfflineMode(true);
          setSuccess("네트워크가 불안정해 오프라인 저장 후 대기열에 추가했습니다.");
          setProgressionSummary(null);
          setSyncNotice("동기화 대기");
          trackEvent("workout_save_succeeded", { strategy: "fallback-queued", setCount: payload.sets.length });
          return;
        }
        throw error;
      }
    } catch (e: any) {
      setError(e?.message ?? "로그 저장에 실패했습니다.");
      trackEvent("workout_save_failed");
    }
  }

  async function makeAccessoryPermanent() {
    if (!planId) throw new Error("planId가 필요합니다.");
    if (selectedSetIdx === null) throw new Error("먼저 세트 행을 선택하세요.");

    const row = sets[selectedSetIdx];
    if (!row?.isExtra) throw new Error("선택한 행은 extra 상태여야 합니다.");
    if (!row.exerciseName.trim()) throw new Error("운동 이름을 입력하세요.");

    await apiPost<{ override: any }>(`/api/plans/${planId}/overrides`, {
      scope: "SESSION",
      weekNumber: week,
      sessionKey,
      patch: {
        op: "ADD_ACCESSORY",
        value: {
          exerciseName: row.exerciseName.trim(),
          sets: [
            {
              setNumber: row.setNumber,
              reps: row.reps,
              weightKg: row.weightKg,
              rpe: row.rpe,
            },
          ],
          order: 99,
        },
      },
      note: `${sessionKey} 세션에 보조 운동 ${row.exerciseName}를 고정`,
    });

    await generateSessionAt(week, day, {
      date: sessionKeyMode === "DATE" ? sessionDate : undefined,
    });
    setSuccess(`보조 운동 오버라이드를 적용하고 ${formatSessionKeyLabel(sessionKey)}를 다시 생성했습니다.`);
  }

  async function replaceExercisePermanent() {
    if (!planId) throw new Error("planId가 필요합니다.");
    if (!replacementExerciseName.trim()) throw new Error("대체 운동 이름을 입력하세요.");

    await apiPost<{ override: any }>(`/api/plans/${planId}/overrides`, {
      scope: "SESSION",
      weekNumber: week,
      sessionKey,
      patch: {
        op: "REPLACE_EXERCISE",
        target: { blockTarget },
        value: { exerciseName: replacementExerciseName.trim() },
      },
      note: `${sessionKey}에서 ${blockTarget}를 ${replacementExerciseName.trim()}로 교체`,
    });

    await generateSessionAt(week, day, {
      date: sessionKeyMode === "DATE" ? sessionDate : undefined,
    });
    setSuccess(`운동 교체 오버라이드를 적용하고 ${formatSessionKeyLabel(sessionKey)}를 다시 생성했습니다.`);
  }

  const compareRows = useMemo(() => {
    const plannedRows = toSetRowsFromPlannedExercises(snapshot, bodyweightKg);
    const performedMap = new Map<string, SetRow>();
    for (const s of sets) {
      const key = `${s.exerciseName.trim().toLowerCase()}#${s.setNumber}`;
      if (!performedMap.has(key)) performedMap.set(key, s);
    }

    const rows = plannedRows.map((p) => {
      const key = `${p.exerciseName.trim().toLowerCase()}#${p.setNumber}`;
      const actual = performedMap.get(key) ?? null;
      return {
        exerciseName: p.exerciseName,
        setNumber: p.setNumber,
        planned: p,
        actual,
      };
    });

    const plannedKeySet = new Set(rows.map((r) => `${r.exerciseName.trim().toLowerCase()}#${r.setNumber}`));
    const extras = sets
      .filter((s) => !plannedKeySet.has(`${s.exerciseName.trim().toLowerCase()}#${s.setNumber}`))
      .map((s) => ({
        exerciseName: s.exerciseName,
        setNumber: s.setNumber,
        planned: null,
        actual: s,
      }));

    return [...rows, ...extras];
  }, [bodyweightKg, sets, snapshot]);

  return (
    <div
      className="native-page native-page-enter tab-screen tab-screen-wide app-dashboard-screen momentum-scroll"
      {...pullToRefresh.bind}
    >
      <PullToRefreshIndicator
        pullOffset={pullToRefresh.pullOffset}
        progress={pullToRefresh.progress}
        status={pullToRefresh.status}
        refreshingLabel="운동 데이터 새로고침 중..."
        completeLabel="운동 데이터 갱신 완료"
      />

      <div className="motion-card rounded-2xl border p-4 space-y-3" data-pull-refresh-trigger="true">
        <div className="ios-section-heading">기록 모드</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`haptic-tap rounded-xl border px-4 py-3 text-sm font-medium ${
              focusMode === "BEGINNER" ? "bg-bg-elevated" : ""
            }`}
            type="button"
            onClick={() => setFocusModeWithTracking("BEGINNER", "toggle")}
          >
            기본 모드
          </button>
          <button
            className={`haptic-tap rounded-xl border px-4 py-3 text-sm font-medium ${
              focusMode === "POWER" ? "bg-bg-elevated" : ""
            }`}
            type="button"
            onClick={() => setFocusModeWithTracking("POWER", "toggle")}
          >
            고급 모드
          </button>
        </div>
        <NoticeStateRows
          message={
            isPowerMode
              ? "고급 생성/오버라이드/스냅샷/비교 기능이 모두 표시됩니다."
              : "기본 흐름만 보입니다. 필요하면 고급 모드로 전환해 세부 제어를 사용하세요."
          }
          label="현재 모드"
          tone="neutral"
        />
      </div>

      {guidedHint ? (
        <div className="motion-card rounded-2xl border p-4 space-y-3">
          <div className="ios-section-heading">실행 가이드</div>
          <div className="text-sm font-semibold">{guidedHint.title}</div>
          <button className="haptic-tap workout-action-pill is-primary w-full" type="button" onClick={runGuidedHintAction}>
            {guidedHint.actionLabel}
          </button>
        </div>
      ) : null}

      <div className="motion-card rounded-2xl border p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`ui-badge ${isOfflineMode ? "ui-badge-warning" : "ui-badge-success"}`}
          >
            {isOfflineMode ? "오프라인" : "온라인"}
          </span>
          {pendingSyncCount > 0 && (
            <span className="ui-badge ui-badge-info">
              동기화 대기: {pendingSyncCount}
            </span>
          )}
          {isSyncingPending && (
            <span className="ui-badge ui-badge-neutral">
              동기화 중...
            </span>
          )}
          {!isSyncingPending && syncNotice && (
            <span className="ui-badge ui-badge-neutral">
              {syncNotice}
            </span>
          )}
          {isUxSyncing && (
            <span className="ui-badge ui-badge-neutral">
              행동 로그 동기화 중...
            </span>
          )}
          {!isUxSyncing && uxSyncNotice && (
            <span className="ui-badge ui-badge-neutral">
              {uxSyncNotice}
            </span>
          )}
          {!isOfflineMode && pendingSyncCount > 0 && (
            <button
              className="haptic-tap rounded-full border px-2.5 py-1 font-medium"
              onClick={() => {
                setError(null);
                setSuccess(null);
                void syncPendingQueuedLogs();
              }}
              disabled={isSyncingPending}
            >
              지금 동기화
            </button>
          )}
          {!isOfflineMode && (
            <button
              className="haptic-tap rounded-full border px-2.5 py-1 font-medium"
              onClick={() => {
                void syncUxEventsWithServer("manual");
              }}
              disabled={isUxSyncing}
            >
              행동 로그 동기화
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AppSelect
            label="플랜"
            wrapperClassName="md:col-span-2"
            value={planId}
            onChange={(e) => {
              const nextPlanId = e.target.value;
              setPlanId(nextPlanId);
              trackEvent("workout_plan_changed", { hasPlan: Boolean(nextPlanId) });
            }}
          >
            {plans.length === 0 && <option value="">(플랜 없음)</option>}
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} [{p.type}]
              </option>
            ))}
          </AppSelect>
          <label className="flex flex-col gap-1">
            <span className="ui-card-label">세션 날짜</span>
            <AppTextInput
              variant="compact"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </label>
        </div>

        <AccordionSection
          title="세션 컨텍스트"
          description="최근 세션과 고급 생성 키를 확인합니다."
          summarySlot={<span className="ui-card-label">{planId ? "플랜 선택됨" : "플랜 없음"}</span>}
        >
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">userId</span>
              <AppTextInput
                variant="compact"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </label>

            <div
              className="flex flex-col gap-1 md:col-span-4 recent-session-swipe"
              onTouchStart={onRecentSessionSwipeStart}
              onTouchEnd={onRecentSessionSwipeEnd}
            >
              <span className="ui-card-label">최근 세션(좌우 스와이프)</span>
              <div className="grid grid-cols-[auto,1fr,auto] gap-2">
                <button
                  className="haptic-tap rounded-lg border px-3 py-2 text-sm"
                  onClick={() => selectAdjacentRecentSession(-1)}
                  disabled={recentSessions.length === 0}
                  type="button"
                >
                  이전
                </button>
                <AppSelect
                  variant="compact"
                  value={selectedRecentSessionId}
                  onChange={(e) => applyRecentSessionSelection(e.target.value)}
                >
                  <option value="">(선택)</option>
                  {recentSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSessionKeyLabel(s.sessionKey)} - {new Date(s.updatedAt).toLocaleString()}
                    </option>
                  ))}
                </AppSelect>
                <button
                  className="haptic-tap rounded-lg border px-3 py-2 text-sm"
                  onClick={() => selectAdjacentRecentSession(1)}
                  disabled={recentSessions.length === 0}
                  type="button"
                >
                  다음
                </button>
              </div>
            </div>

            <div className="md:col-span-6">
              <LoadingStateRows
                active={loadingPlans || loadingRecentSessions}
                label="불러오는 중"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="ui-card-label">시간대</span>
              <AppTextInput
                variant="compact"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="ui-card-label">주차(고급)</span>
              <NumberPickerField
                label="주차"
                value={week}
                min={1}
                max={52}
                step={1}
                variant="workout-number"
                onChange={(v) => setWeek(v)}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <span className="ui-card-label">일차(고급)</span>
              <NumberPickerField
                label="일차"
                value={day}
                min={1}
                max={7}
                step={1}
                variant="workout-number"
                onChange={(v) => setDay(v)}
              />
            </div>
            <div className="ui-card-label">선택된 플랜 ID: {planId || "(없음)"}</div>
            <div className="ui-card-label">운동 옵션 수: {exerciseOptions.length}</div>
          </div>
        </AccordionSection>

        <div className="workout-action-panel workout-action-panel-quick">
          <div className="workout-action-head">
            <div className="workout-action-title">빠른 시작</div>
          </div>
          <div className="workout-action-grid">
            <button
              className="haptic-tap workout-action-pill is-primary"
              type="button"
              onClick={() => {
                setSuccess(null);
                setError(null);
                runGenerateAndApply(sessionDate, "quick").catch((e) => setError(e.message));
              }}
              disabled={!planId}
            >
              1) 세션 생성/적용
            </button>

            <button
              className="haptic-tap workout-action-pill is-primary"
              type="button"
              onClick={handleSaveLog}
              disabled={!planId || sets.length === 0}
            >
              3) 운동 기록 저장
            </button>

            <button
              className="haptic-tap workout-action-pill is-primary"
              type="button"
              onClick={() => {
                setSuccess(null);
                setError(null);
                openAddExerciseSheet("quick");
              }}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <span>2)</span>
                <AppPlusMinusIcon kind="plus" />
                <span>운동 추가</span>
              </span>
            </button>

            <button
              className="haptic-tap workout-action-pill is-secondary"
              type="button"
              onClick={() => {
                setSuccess(null);
                setError(null);
                runRepeatLastWorkout("quick").catch((e) => setError(e.message));
              }}
            >
              지난 운동 반복
            </button>

            <button className="haptic-tap workout-action-pill is-secondary" type="button" onClick={addSetRow}>
              빈 로그 시작(+ 기본 세트)
            </button>
          </div>
        </div>

        {isPowerMode ? (
          <AccordionSection
            title="고급 동작"
            description="수동 생성, 유틸리티, 세션 오버라이드를 제공합니다."
            summarySlot={<span className="ui-card-label">{generatedSession ? "세션 준비됨" : "수동 제어"}</span>}
          >
            <div className="workout-action-panel">
              <div className="workout-action-grid">
                <button
                  className="haptic-tap workout-action-pill is-primary"
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    setError(null);
                    generateForToday().catch((e) => setError(e.message));
                  }}
                  disabled={!planId}
                >
                  오늘 기준 생성
                </button>

                <button
                  className="haptic-tap workout-action-pill is-primary"
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    setError(null);
                    generateForDate(sessionDate).catch((e) => setError(e.message));
                  }}
                  disabled={!planId}
                >
                  선택 날짜 생성
                </button>

                <button
                  className="haptic-tap workout-action-pill is-primary"
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    setError(null);
                    generateSession().catch((e) => setError(e.message));
                  }}
                  disabled={!planId}
                >
                  주차/일차 기준 생성
                </button>

                <button
                  className="haptic-tap workout-action-pill is-primary"
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    setError(null);
                    applyPlannedSets();
                  }}
                  disabled={!generatedSession}
                >
                  계획 세트 적용
                </button>

                <button className="haptic-tap workout-action-pill is-secondary inline-flex items-center justify-center gap-1.5" type="button" onClick={addSetRow}>
                  <AppPlusMinusIcon kind="plus" />
                  <span>세트 추가</span>
                </button>

                <button
                  className="haptic-tap workout-action-pill is-secondary inline-flex items-center justify-center gap-1.5"
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    setError(null);
                    openAddExerciseSheet("advanced");
                  }}
                >
                  <AppPlusMinusIcon kind="plus" />
                  <span>운동 추가</span>
                </button>

                <button
                  className="haptic-tap workout-action-pill is-secondary"
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    setError(null);
                    runRepeatLastWorkout("advanced").catch((e) => setError(e.message));
                  }}
                >
                  지난 운동 반복
                </button>

                <button
                  className="haptic-tap workout-action-pill is-secondary"
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    setError(null);
                    try {
                      quickAddFromSelected();
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                  disabled={selectedSetIdx === null}
                >
                  빠른 세트 추가
                </button>
                <button
                  className="haptic-tap workout-action-pill is-secondary"
                  type="button"
                  onClick={() => {
                    setShouldRenderOverridesSheet(true);
                    setOverridesSheetOpen(true);
                    trackEvent("workout_override_sheet_opened", { source: "advanced" });
                  }}
                  disabled={!planId}
                >
                  세션 오버라이드
                </button>
              </div>
            </div>
          </AccordionSection>
        ) : (
          <button
            className="haptic-tap workout-action-pill is-secondary w-full"
            type="button"
            onClick={() => setFocusModeWithTracking("POWER", "shortcut")}
          >
            고급 제어 열기
          </button>
        )}

        <ErrorStateRows
          message={error}
          onRetry={() => {
            setError(null);
            setProgressionSummary(null);
            void refreshPageData();
          }}
        />
        <NoticeStateRows message={success} tone="success" label="저장 상태" />
        <NoticeStateRows
          message={summarizeProgression(progressionSummary)}
          tone={progressionTone(progressionSummary)}
          label="자동 진행"
        />
        <DisabledStateRows
          when={initialPlanLoadDone && !planId}
          label="플랜 미선택"
          description="플랜을 선택하면 생성/저장/오버라이드 기능이 활성화됩니다."
        />
        <DisabledStateRows
          when={initialPlanLoadDone && planId.length > 0 && sets.length === 0}
          label="저장 비활성"
          description="저장할 세트가 없습니다. 생성/적용 또는 운동 추가를 먼저 실행하세요."
        />
        {lastSavedLogId && (
          <a
            className="text-sm underline"
            href={`/workout/session/${encodeURIComponent(lastSavedLogId)}`}
          >
            세션 상세 열기
          </a>
        )}
      </div>

      <div className={`grid grid-cols-1 ${isPowerMode ? "lg:grid-cols-2" : ""} gap-4`}>
        {isPowerMode ? (
          <div className="motion-card rounded-2xl border p-4 space-y-3">
            <AccordionSection
              title="생성 스냅샷"
              description="필요한 구조만 펼쳐서 확인하세요."
              summarySlot={<span className="ui-card-label">{generatedSession ? "준비됨" : "비어 있음"}</span>}
            >
              {generatedSession ? (
                <div className="space-y-3">
                  <div className="ui-card-label">generatedSessionId: {generatedSession.id}</div>

                  <InlineDisclosure label="계획 운동">
                    <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
                      {JSON.stringify(snapshot?.exercises ?? [], null, 2)}
                    </pre>
                  </InlineDisclosure>

                  <InlineDisclosure label="블록">
                    <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
                      {JSON.stringify(snapshot?.blocks ?? [], null, 2)}
                    </pre>
                  </InlineDisclosure>

                  <InlineDisclosure label="수동 세션">
                    <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
                      {JSON.stringify(snapshot?.manualSession ?? null, null, 2)}
                    </pre>
                  </InlineDisclosure>

                  <InlineDisclosure label="보조 운동">
                    <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
                      {JSON.stringify(snapshot?.accessories ?? [], null, 2)}
                    </pre>
                  </InlineDisclosure>
                </div>
              ) : (
                <EmptyStateRows
                  when
                  label="설정 값 없음"
                  description="먼저 생성을 실행하면 스냅샷 상세가 표시됩니다."
                />
              )}
            </AccordionSection>
          </div>
        ) : null}

        <div className="motion-card rounded-2xl border p-4 space-y-3">
          <div className="ios-section-heading">저장할 세트</div>

          {defaultExercisesFromSnapshot.length > 0 && (
            <div className="ui-card-label">
              추천 운동: {defaultExercisesFromSnapshot.join(", ")}
            </div>
          )}
          <div className="ui-card-label">
            키보드: Enter는 다음 세트 삽입, 방향키는 셀 이동
          </div>

          {sets.length === 0 ? (
            <div className="space-y-3">
              <EmptyStateRows
                when
                label="설정 값 없음"
                description="저장할 세트가 없습니다. 계획 세트를 불러오거나 빈 세트를 추가하세요."
              />
              <div className="workout-empty-actions">
                <button
                  className="haptic-tap workout-action-pill is-primary"
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    setError(null);
                    runGenerateAndApply(sessionDate, "empty").catch((e) => setError(e.message));
                  }}
                  disabled={!planId}
                >
                  생성 및 적용
                </button>
                <button
                  className="haptic-tap workout-action-pill is-secondary inline-flex items-center justify-center gap-1.5"
                  type="button"
                  onClick={() => openAddExerciseSheet("empty")}
                >
                  <AppPlusMinusIcon kind="plus" />
                  <span>운동 추가</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 ui-height-animate">
              {sets.map((s, idx) => (
                <WorkoutSetRow
                  key={s.id}
                  idx={idx}
                  row={s}
                  bodyweightKg={bodyweightKg}
                  setCellKey={setCellKey}
                  registerSetInputRef={registerSetInputRef}
                  handleSetGridKeyDown={handleSetGridKeyDown}
                  updateRow={updateSetRow}
                  onCompleteAndNext={completeSetAndAddNext}
                  onCopyPrevious={copyPreviousSet}
                  onInsertBelow={insertSetBelow}
                  onRemove={removeSetRow}
                  canCopyPrevious={idx !== 0}
                />
              ))}
            </div>
          )}
          <datalist id="exercise-options">
            {exerciseOptionList}
          </datalist>

          {isPowerMode ? (
            <div className="motion-card rounded-xl border p-3 space-y-2">
              <AccordionSection
                title="세션 상세 비교"
                description="계획 세트와 수행 세트를 비교합니다."
                summarySlot={<span className="ui-card-label">{compareRows.length}행</span>}
              >
                {compareRows.length === 0 ? (
                  <EmptyStateRows
                    when
                    label="설정 값 없음"
                    description="비교할 계획/수행 세트가 없습니다."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm ios-data-table">
                      <thead className="text-neutral-600">
                        <tr>
                          <th className="text-left py-1 pr-3">운동</th>
                          <th className="text-right py-1 px-3">세트</th>
                          <th className="text-right py-1 px-3">계획</th>
                          <th className="text-right py-1 px-3">수행</th>
                          <th className="text-right py-1 pl-3">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareRows.map((r, idx) => {
                          const plannedMeta =
                            r.planned && typeof r.planned.plannedRef?.note === "string" && r.planned.plannedRef.note.trim()
                              ? r.planned.plannedRef.note.trim()
                              : null;
                          const plannedPercent =
                            r.planned &&
                            typeof r.planned.plannedRef?.percent === "number" &&
                            Number.isFinite(r.planned.plannedRef.percent)
                              ? `${Math.round(r.planned.plannedRef.percent * 100)}%`
                              : null;
                          const plannedLoadText = r.planned
                            ? formatExerciseLoadLabel({
                                exerciseName: r.exerciseName,
                                weightKg:
                                  r.planned.plannedRef?.totalTargetWeightKg ??
                                  r.planned.plannedRef?.targetWeightKg ??
                                  r.planned.weightKg,
                                bodyweightKg,
                                source: r.planned.plannedRef?.totalTargetWeightKg !== undefined ? "total" : "external",
                              })
                            : "-";
                          const plannedText = r.planned
                            ? `${r.planned.reps || "-"}회 @ ${plannedLoadText}${
                                plannedPercent || plannedMeta
                                  ? ` (${[plannedPercent, plannedMeta].filter(Boolean).join(" · ")})`
                                  : ""
                              }`
                            : "-";
                          const performedText = r.actual
                            ? `${r.actual.reps || "-"}회 @ ${formatExerciseLoadLabel({
                                exerciseName: r.exerciseName,
                                weightKg: r.actual.weightKg,
                                bodyweightKg,
                                source: "external",
                              })}`
                            : "-";
                          const status = !r.planned
                            ? "추가"
                            : !r.actual
                              ? "누락"
                              : r.actual.completed
                                ? "완료"
                                : "대기";
                          return (
                            <tr key={`${r.exerciseName}-${r.setNumber}-${idx}`} className="border-t">
                              <td className="py-1 pr-3">{r.exerciseName}</td>
                              <td className="py-1 px-3 text-right">{r.setNumber}</td>
                              <td className="py-1 px-3 text-right">{plannedText}</td>
                              <td className="py-1 px-3 text-right">{performedText}</td>
                              <td className="py-1 pl-3 text-right">{status}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </AccordionSection>
            </div>
          ) : (
            <button
              className="haptic-tap workout-action-pill is-secondary w-full"
              type="button"
              onClick={() => setFocusModeWithTracking("POWER", "shortcut")}
            >
              세션 상세 비교 열기(고급 모드)
            </button>
          )}
        </div>
      </div>

      <div className="workout-save-dock">
        <PrimaryButton
          variant="primary"
          size="lg"
          fullWidth
          className="workout-save-button"
          onClick={handleSaveLog}
          disabled={!planId || sets.length === 0}
        >
          {isOfflineMode
            ? `오프라인 저장${pendingSyncCount > 0 ? ` (${pendingSyncCount}건 대기)` : ""}`
            : pendingSyncCount > 0
              ? `로그 저장 (${pendingSyncCount}건 대기)`
              : "로그 저장"}
        </PrimaryButton>
      </div>

      {shouldRenderAddExerciseSheet ? (
        <WorkoutAddExerciseSheet
          open={addExerciseSheetOpen}
          addExerciseQuery={addExerciseQuery}
          selectedAddExerciseName={selectedAddExerciseName}
          addExerciseCandidates={addExerciseCandidates}
          onClose={() => {
            setAddExerciseSheetOpen(false);
            setAddExerciseQuery("");
            setSelectedAddExerciseName("");
            trackEvent("workout_add_exercise_sheet_closed");
          }}
          onAddExerciseQueryChange={setAddExerciseQuery}
          onSelectAddExerciseName={setSelectedAddExerciseName}
          onClearAddExerciseQuery={() => setAddExerciseQuery("")}
          onAddSelectedExercise={() => addExerciseFromSheet(selectedAddExerciseName)}
          onAddExerciseFromQuery={() => addExerciseFromSheet(addExerciseQuery.trim())}
        />
      ) : null}

      {shouldRenderOverridesSheet ? (
        <WorkoutOverridesSheet
          open={overridesSheetOpen}
          sessionKeyLabel={formatSessionKeyLabel(sessionKey)}
          selectedSetIdx={selectedSetIdx}
          sets={sets}
          blockTarget={blockTarget}
          replacementExerciseName={replacementExerciseName}
          onClose={() => setOverridesSheetOpen(false)}
          onSelectSetIdx={setSelectedSetIdx}
          onMakeAccessoryPermanent={() => {
            setSuccess(null);
            setError(null);
            void makeAccessoryPermanent().catch((e) => setError(e.message));
          }}
          onBlockTargetChange={setBlockTarget}
          onReplacementExerciseNameChange={setReplacementExerciseName}
          onReplaceExercisePermanent={() => {
            setSuccess(null);
            setError(null);
            void replaceExercisePermanent().catch((e) => setError(e.message));
          }}
        />
      ) : null}

    </div>
  );
}
