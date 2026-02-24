"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import {
  enqueueWorkoutLog,
  getPendingWorkoutLogCount,
  isLikelyNetworkError,
  offlineQueueUpdateEventName,
  syncPendingWorkoutLogsViaApi,
  type WorkoutLogRequest,
} from "@/lib/offlineLogQueue";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

type SetRow = {
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
    reps?: number;
    targetWeightKg?: number;
    rpe?: number;
    note?: string;
  } | null;
};

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

const MOTION_DURATION_FAST_MS = 160;

function toSetRowsFromPlannedExercises(snapshot: any): SetRow[] {
  const planned = Array.isArray(snapshot?.exercises) ? snapshot.exercises : [];
  const rows: SetRow[] = [];

  for (const ex of planned) {
    const exerciseName = String(ex?.exerciseName ?? "").trim();
    if (!exerciseName) continue;
    const sets = Array.isArray(ex?.sets) && ex.sets.length > 0 ? ex.sets : [{}];
    sets.forEach((s: any, idx: number) => {
      const reps = Number(s?.reps ?? 0);
      const weightKg = Number(s?.targetWeightKg ?? 0);
      const rpe = Number(s?.rpe ?? 0);
      rows.push({
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
          reps: Number.isFinite(reps) ? reps : undefined,
          targetWeightKg: Number.isFinite(weightKg) ? weightKg : undefined,
          rpe: Number.isFinite(rpe) ? rpe : undefined,
          note: typeof s?.note === "string" ? s.note : undefined,
        },
      });
    });
  }

  return rows;
}

function parseSessionKey(sessionKey: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(sessionKey)) {
    return {
      week: 1,
      day: 1,
      sessionDate: sessionKey,
    };
  }

  const m = /^W(\d+)D(\d+)$/.exec(sessionKey);
  if (!m) return null;
  return {
    week: Number(m[1]),
    day: Number(m[2]),
    sessionDate: null,
  };
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

function WorkoutSetRow({
  idx,
  row,
  setCellKey,
  setInputRefs,
  handleSetGridKeyDown,
  updateRow,
  onCompleteAndNext,
  onCopyPrevious,
  onInsertBelow,
  onRemove,
  canCopyPrevious,
}: {
  idx: number;
  row: SetRow;
  setCellKey: (row: number, col: number) => string;
  setInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  handleSetGridKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => void;
  updateRow: (updater: (row: SetRow) => SetRow) => void;
  onCompleteAndNext: () => void;
  onCopyPrevious: () => void;
  onInsertBelow: () => void;
  onRemove: () => void;
  canCopyPrevious: boolean;
}) {
  const [isRemoving, setIsRemoving] = useState(false);
  const removeTimerRef = useRef<number | null>(null);

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
      onRemove();
    }, MOTION_DURATION_FAST_MS);
  }

  return (
    <div className={`workout-swipe-shell ui-list-item motion-list-item ${isRemoving ? "is-removing" : ""}`}>
      <button className="workout-swipe-delete haptic-tap" type="button" onClick={handleRemoveWithMotion}>
        Delete
      </button>

      <article className="workout-set-card">
        <label className="flex flex-col gap-1">
          <span className="workout-set-label">exercise</span>
          <input
            className="workout-set-input workout-set-input-text"
            list="exercise-options"
            value={row.exerciseName}
            ref={(el) => {
              setInputRefs.current[setCellKey(idx, 0)] = el;
            }}
            onKeyDown={(e) => handleSetGridKeyDown(e, idx, 0)}
            onChange={(e) => updateRow((prev) => ({ ...prev, exerciseName: e.target.value }))}
          />
        </label>

        <div className="mt-2 grid grid-cols-4 gap-2">
          <label className="flex flex-col gap-1">
            <span className="workout-set-label">set#</span>
            <input
              className="workout-set-input workout-set-input-number"
              type="number"
              inputMode="numeric"
              value={row.setNumber}
              ref={(el) => {
                setInputRefs.current[setCellKey(idx, 1)] = el;
              }}
              onKeyDown={(e) => handleSetGridKeyDown(e, idx, 1)}
              onChange={(e) => updateRow((prev) => ({ ...prev, setNumber: Number(e.target.value) }))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="workout-set-label">reps</span>
            <input
              className="workout-set-input workout-set-input-number"
              type="number"
              inputMode="numeric"
              value={row.reps}
              ref={(el) => {
                setInputRefs.current[setCellKey(idx, 2)] = el;
              }}
              onKeyDown={(e) => handleSetGridKeyDown(e, idx, 2)}
              onChange={(e) => updateRow((prev) => ({ ...prev, reps: Number(e.target.value) }))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="workout-set-label">kg</span>
            <input
              className="workout-set-input workout-set-input-number"
              type="number"
              inputMode="decimal"
              value={row.weightKg}
              ref={(el) => {
                setInputRefs.current[setCellKey(idx, 3)] = el;
              }}
              onKeyDown={(e) => handleSetGridKeyDown(e, idx, 3)}
              onChange={(e) => updateRow((prev) => ({ ...prev, weightKg: Number(e.target.value) }))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="workout-set-label">RPE</span>
            <input
              className="workout-set-input workout-set-input-number"
              type="number"
              inputMode="decimal"
              value={row.rpe}
              ref={(el) => {
                setInputRefs.current[setCellKey(idx, 4)] = el;
              }}
              onKeyDown={(e) => handleSetGridKeyDown(e, idx, 4)}
              onChange={(e) => updateRow((prev) => ({ ...prev, rpe: Number(e.target.value) }))}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="workout-toggle">
            <input
              type="checkbox"
              checked={row.isExtra}
              onChange={(e) =>
                updateRow((prev) => ({
                  ...prev,
                  isExtra: e.target.checked,
                  isPlanned: e.target.checked ? false : prev.isPlanned,
                }))
              }
            />
            <span>extra</span>
          </label>

          <label className="workout-toggle">
            <input
              type="checkbox"
              checked={row.completed}
              onChange={(e) => updateRow((prev) => ({ ...prev, completed: e.target.checked }))}
            />
            <span>complete</span>
          </label>

          <span className="text-xs text-neutral-600">
            {row.isExtra ? "extra" : row.isPlanned ? "planned" : "custom"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button className="haptic-tap workout-action-pill rounded-xl border px-3 py-2 text-sm" onClick={onCompleteAndNext}>
            Complete + next
          </button>
          <button
            className="haptic-tap workout-action-pill rounded-xl border px-3 py-2 text-sm"
            onClick={onCopyPrevious}
            disabled={!canCopyPrevious}
          >
            Copy prev
          </button>
          <button className="haptic-tap workout-action-pill rounded-xl border px-3 py-2 text-sm" onClick={onInsertBelow}>
            Insert below
          </button>
        </div>
      </article>
    </div>
  );
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

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [recentSessions, setRecentSessions] = useState<RecentGeneratedSession[]>([]);
  const [loadingRecentSessions, setLoadingRecentSessions] = useState(false);
  const [selectedRecentSessionId, setSelectedRecentSessionId] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  const [generatedSession, setGeneratedSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSavedLogId, setLastSavedLogId] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncingPending, setIsSyncingPending] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const [sets, setSets] = useState<SetRow[]>([
    {
      exerciseName: "Back Squat",
      setNumber: 1,
      reps: 5,
      weightKg: 100,
      rpe: 8,
      isExtra: false,
      isPlanned: false,
      completed: false,
      plannedRef: null,
    },
  ]);
  const [selectedSetIdx, setSelectedSetIdx] = useState<number | null>(null);
  const [blockTarget, setBlockTarget] = useState("BENCH");
  const [replacementExerciseName, setReplacementExerciseName] = useState("");
  const [autoGeneratedFromQuery, setAutoGeneratedFromQuery] = useState(false);
  const [queryAutoGenerate, setQueryAutoGenerate] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<{ row: number; col: number } | null>(null);
  const setInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingSyncInFlight = useRef(false);
  const sessionSwipeStartX = useRef<number | null>(null);

  const derivedGeneratedId = generatedSession?.id as string | undefined;
  const snapshot = generatedSession?.snapshot;
  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId]);
  const planType = snapshot?.plan?.type ?? selectedPlan?.type;
  const sessionKeyMode = String(selectedPlan?.params?.sessionKeyMode ?? "").toUpperCase();
  const sessionKey =
    generatedSession?.sessionKey ??
    snapshot?.sessionKey ??
    (sessionKeyMode === "DATE" ? sessionDate : `W${week}D${day}`);

  const setCellKey = (row: number, col: number) => `${row}:${col}`;
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
    setSyncNotice("Syncing pending logs...");
    try {
      const result = await syncPendingWorkoutLogsViaApi();
      setPendingSyncCount(result.remaining);
      if (result.synced > 0) {
        if (result.lastSyncedLogId) setLastSavedLogId(result.lastSyncedLogId);
        setSyncNotice(`Synced ${result.synced} queued log${result.synced > 1 ? "s" : ""}`);
      } else if (result.failed > 0) {
        setSyncNotice(`Pending sync: ${result.remaining}`);
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
  }, []);
  const pullToRefresh = usePullToRefresh({ onRefresh: refreshPageData });

  function applyRecentSessionSelection(id: string) {
    setSelectedRecentSessionId(id);
    const picked = recentSessions.find((s) => s.id === id);
    if (!picked) return;
    const parsed = parseSessionKey(picked.sessionKey);
    if (!parsed) return;
    setWeek(parsed.week);
    setDay(parsed.day);
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
    };

    const handleOffline = () => {
      setIsOfflineMode(true);
      setSyncNotice("Offline mode");
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
      .catch((e: any) => setError(e?.message ?? "Failed to auto-generate from calendar"));
  }, [autoGeneratedFromQuery, planId, queryAutoGenerate, sessionDate]);

  useEffect(() => {
    const tz = selectedPlan?.params?.timezone;
    if (typeof tz === "string" && tz.trim()) {
      setTimezone(tz);
    }
  }, [selectedPlan?.id, selectedPlan?.params?.timezone]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPlans(true);
        const res = await apiGet<{ items: Plan[] }>("/api/plans");
        if (cancelled) return;
        setPlans(res.items);
        setPlanId((prev) => {
          if (prev && res.items.some((p) => p.id === prev)) return prev;
          return res.items[0]?.id ?? "";
        });
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load plans");
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingRecentSessions(true);
        const sp = new URLSearchParams();
        sp.set("limit", "20");
        if (planId) sp.set("planId", planId);

        const res = await apiGet<{ items: RecentGeneratedSession[] }>(`/api/generated-sessions?${sp.toString()}`);
        if (cancelled) return;
        setRecentSessions(res.items);
        setSelectedRecentSessionId((prev) => (res.items.some((s) => s.id === prev) ? prev : ""));
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load recent sessions");
      } finally {
        if (!cancelled) setLoadingRecentSessions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ items: ExerciseOption[] }>("/api/exercises?limit=200");
        if (!cancelled) setExerciseOptions(res.items);
      } catch {
        if (!cancelled) setExerciseOptions([]);
      }
    })();
    return () => {
      cancelled = true;
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

  function applyGeneratedSession(session: any) {
    setGeneratedSession(session);
    const sKey = typeof session?.sessionKey === "string" ? session.sessionKey : null;
    if (sKey && /^\d{4}-\d{2}-\d{2}$/.test(sKey)) {
      setSessionDate(sKey);
    }
    const nextWeek = Number(session?.snapshot?.week);
    const nextDay = Number(session?.snapshot?.day);
    if (Number.isFinite(nextWeek) && nextWeek >= 1) setWeek(nextWeek);
    if (Number.isFinite(nextDay) && nextDay >= 1) setDay(nextDay);
  }

  async function generateSessionAt(nextWeek: number, nextDay: number, opts?: { date?: string }) {
    if (!planId) throw new Error("planId required");
    const dateValue = opts?.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : undefined;
    const res = await apiPost<{ session: any }>(`/api/plans/${planId}/generate`, {
      week: dateValue ? undefined : nextWeek,
      day: dateValue ? undefined : nextDay,
      sessionDate: dateValue,
      timezone,
    });
    applyGeneratedSession(res.session);
  }

  async function generateSession() {
    await generateSessionAt(week, day);
  }

  async function generateForDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");
    setSessionDate(date);
    await generateSessionAt(week, day, { date });
  }

  async function generateForToday() {
    if (!planId) throw new Error("planId required");
    const today = dateOnlyInTimezone(new Date(), timezone);
    await generateForDate(today);
    setSuccess(`Generated for today: ${today}`);
  }

  function makeNextSetFromRow(baseRow: SetRow, rows: SetRow[]): SetRow {
    const nextSetNumber =
      rows
        .filter((r) => r.exerciseName.trim().toLowerCase() === baseRow.exerciseName.trim().toLowerCase())
        .reduce((max, r) => Math.max(max, r.setNumber), 0) + 1;

    return {
      exerciseName: baseRow.exerciseName,
      setNumber: nextSetNumber,
      reps: baseRow.reps,
      weightKg: baseRow.weightKg,
      rpe: baseRow.rpe,
      isExtra: baseRow.isExtra,
      isPlanned: false,
      completed: false,
      plannedRef: null,
    };
  }

  function moveFocusInSetGrid(row: number, col: number) {
    if (row < 0 || row >= sets.length) return;
    const safeCol = Math.max(0, Math.min(setGridColCount - 1, col));
    setPendingFocus({ row, col: safeCol });
  }

  function insertSetBelow(idx: number, focusCol = 0) {
    setSets((prev) => {
      const row = prev[idx];
      if (!row) return prev;
      const next = [...prev];
      next.splice(idx + 1, 0, makeNextSetFromRow(row, next));
      return next;
    });
    setPendingFocus({ row: idx + 1, col: focusCol });
  }

  function handleSetGridKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number,
  ) {
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
  }

  function addSetRow() {
    const ex = defaultExercisesFromSnapshot[0] ?? "Accessory";
    setSets((s) => [
      ...s,
      {
        exerciseName: ex,
        setNumber: 1,
        reps: 10,
        weightKg: 0,
        rpe: 8,
        isExtra: true,
        isPlanned: false,
        completed: false,
        plannedRef: null,
      },
    ]);
    setPendingFocus({ row: sets.length, col: 0 });
  }

  function applyPlannedSets() {
    const generatedRows = toSetRowsFromPlannedExercises(snapshot);
    if (generatedRows.length === 0) throw new Error("No planned exercises in snapshot");
    setSets(generatedRows);
    setSelectedSetIdx(null);
    setSuccess(`Applied ${generatedRows.length} planned sets`);
  }

  function completeSetAndAddNext(idx: number) {
    setSets((prev) => {
      const row = prev[idx];
      if (!row) return prev;

      const next = [...prev];
      const wasCompleted = row.completed;
      next[idx] = { ...row, completed: true };
      if (wasCompleted) return next;
      next.push(makeNextSetFromRow(row, next));
      return next;
    });
    setPendingFocus({ row: sets.length, col: 0 });
  }

  function copyPreviousSet(idx: number) {
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
  }

  function quickAddFromSelected() {
    if (selectedSetIdx === null) throw new Error("Select a set row first");
    const row = sets[selectedSetIdx];
    if (!row) throw new Error("Selected row not found");

    setSets((prev) => [
      ...prev,
      makeNextSetFromRow(row, prev),
    ]);
    setPendingFocus({ row: sets.length, col: 0 });
  }

  function updateSetRow(idx: number, updater: (row: SetRow) => SetRow) {
    setSets((prev) => {
      if (!prev[idx]) return prev;
      const copy = [...prev];
      copy[idx] = updater(copy[idx]);
      return copy;
    });
  }

  async function repeatLastWorkout() {
    const sp = new URLSearchParams();
    sp.set("limit", "1");
    if (planId) sp.set("planId", planId);

    const res = await apiGet<{ items: Array<{ id: string; performedAt: string; sets: any[] }> }>(
      `/api/logs?${sp.toString()}`,
    );

    const last = res.items[0];
    if (!last) throw new Error("No previous workout found");

    const rows: SetRow[] = (last.sets ?? []).map((s: any) => ({
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

    if (rows.length === 0) throw new Error("Last workout has no sets");
    setSets(rows);
    setSelectedSetIdx(null);
    setGeneratedSession(null);
    setSuccess(`Repeated last workout from ${new Date(last.performedAt).toLocaleString()}`);
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
    if (!planId) throw new Error("planId required");
    if (!sets.length) throw new Error("sets required");
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
          ...s,
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
    const res = await apiPost<{ log: any }>(`/api/logs`, payload);
    return res.log;
  }

  async function handleSaveLog() {
    setSuccess(null);
    setError(null);
    setLastSavedLogId(null);
    setSyncNotice(null);

    try {
      const isOnline = typeof window === "undefined" ? true : navigator.onLine;
      const payload = await buildLogPayload({ allowRemoteLookup: isOnline });

      if (typeof window !== "undefined" && !isOnline) {
        enqueueWorkoutLog(payload);
        refreshPendingSyncCount();
        setIsOfflineMode(true);
        setSuccess("Saved offline. Will sync automatically when back online.");
        setSyncNotice("Pending sync");
        return;
      }

      try {
        const log = await saveLog(payload);
        setLastSavedLogId(log.id);
        setSuccess(`Saved log: ${log.id}`);
        setIsOfflineMode(false);
        refreshPendingSyncCount();
        void syncPendingQueuedLogs();
      } catch (error) {
        if (isLikelyNetworkError(error)) {
          enqueueWorkoutLog(payload);
          refreshPendingSyncCount();
          setIsOfflineMode(true);
          setSuccess("Network unavailable. Saved offline and queued.");
          setSyncNotice("Pending sync");
          return;
        }
        throw error;
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to save log");
    }
  }

  async function makeAccessoryPermanent() {
    if (!planId) throw new Error("planId required");
    if (selectedSetIdx === null) throw new Error("Select a set row first");

    const row = sets[selectedSetIdx];
    if (!row?.isExtra) throw new Error("Selected row must be marked extra");
    if (!row.exerciseName.trim()) throw new Error("exerciseName required");

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
      note: `Persist accessory ${row.exerciseName} for ${sessionKey}`,
    });

    await generateSessionAt(week, day, {
      date: sessionKeyMode === "DATE" ? sessionDate : undefined,
    });
    setSuccess(`Accessory override applied and regenerated: ${sessionKey}`);
  }

  async function replaceExercisePermanent() {
    if (!planId) throw new Error("planId required");
    if (!replacementExerciseName.trim()) throw new Error("replacement exerciseName required");

    await apiPost<{ override: any }>(`/api/plans/${planId}/overrides`, {
      scope: "SESSION",
      weekNumber: week,
      sessionKey,
      patch: {
        op: "REPLACE_EXERCISE",
        target: { blockTarget },
        value: { exerciseName: replacementExerciseName.trim() },
      },
      note: `Replace ${blockTarget} with ${replacementExerciseName.trim()} for ${sessionKey}`,
    });

    await generateSessionAt(week, day, {
      date: sessionKeyMode === "DATE" ? sessionDate : undefined,
    });
    setSuccess(`Replace exercise override applied and regenerated: ${sessionKey}`);
  }

  const compareRows = useMemo(() => {
    const plannedRows = toSetRowsFromPlannedExercises(snapshot);
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
  }, [sets, snapshot]);

  return (
    <div
      className="native-page native-page-enter tab-screen tab-screen-wide momentum-scroll"
      {...pullToRefresh.bind}
    >
      <div className="pull-refresh-indicator">
        {pullToRefresh.isRefreshing
          ? "Refreshing workout data..."
          : pullToRefresh.pullOffset > 0
            ? "Pull to refresh"
            : ""}
      </div>
      <div className="tab-screen-header">
        <h1 className="tab-screen-title">Workout Today</h1>
        <p className="tab-screen-caption">Generate, log, and sync today&apos;s session in one flow.</p>
      </div>

      <div className="motion-card rounded-2xl border p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`ui-badge ${isOfflineMode ? "ui-badge-warning" : "ui-badge-success"}`}
          >
            {isOfflineMode ? "Offline mode" : "Online"}
          </span>
          {pendingSyncCount > 0 && (
            <span className="ui-badge ui-badge-info">
              Pending sync: {pendingSyncCount}
            </span>
          )}
          {isSyncingPending && (
            <span className="ui-badge ui-badge-neutral">
              Syncing...
            </span>
          )}
          {!isSyncingPending && syncNotice && (
            <span className="ui-badge ui-badge-neutral">
              {syncNotice}
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
              Sync now
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-600">userId</span>
            <input
              className="rounded-lg border px-3 py-2"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs text-neutral-600">plan</span>
            <select
              className="rounded-lg border px-3 py-2"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              {plans.length === 0 && <option value="">(no plans)</option>}
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.type}]
                </option>
              ))}
            </select>
          </label>

          <div
            className="flex flex-col gap-1 md:col-span-2 recent-session-swipe"
            onTouchStart={onRecentSessionSwipeStart}
            onTouchEnd={onRecentSessionSwipeEnd}
          >
            <span className="text-xs text-neutral-600">recent sessions (swipe left/right)</span>
            <div className="grid grid-cols-[auto,1fr,auto] gap-2">
              <button
                className="haptic-tap rounded-lg border px-3 py-2 text-sm"
                onClick={() => selectAdjacentRecentSession(-1)}
                disabled={recentSessions.length === 0}
                type="button"
              >
                Prev
              </button>
              <select
                className="rounded-lg border px-3 py-2"
                value={selectedRecentSessionId}
                onChange={(e) => applyRecentSessionSelection(e.target.value)}
              >
                <option value="">(select)</option>
                {recentSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sessionKey} - {new Date(s.updatedAt).toLocaleString()}
                  </option>
                ))}
              </select>
              <button
                className="haptic-tap rounded-lg border px-3 py-2 text-sm"
                onClick={() => selectAdjacentRecentSession(1)}
                disabled={recentSessions.length === 0}
                type="button"
              >
                Next
              </button>
            </div>
          </div>

          <div className="text-xs text-neutral-600 self-end pb-2">
            {loadingPlans && "Loading plans... "}
            {loadingRecentSessions && "Loading sessions..."}
          </div>
        </div>

        <div className="text-xs text-neutral-600">
          Selected planId: {planId || "(none)"}
        </div>
        <div className="text-xs text-neutral-600">
          exercise options: {exerciseOptions.length}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-600">sessionDate</span>
            <input
              className="rounded-lg border px-3 py-2"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs text-neutral-600">timezone</span>
            <input
              className="rounded-lg border px-3 py-2"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-600">week (advanced)</span>
            <input
              className="rounded-lg border px-3 py-2"
              type="number"
              value={week}
              min={1}
              onChange={(e) => setWeek(Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-600">day (advanced)</span>
            <input
              className="rounded-lg border px-3 py-2"
              type="number"
              value={day}
              min={1}
              onChange={(e) => setDay(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="workout-action-panel">
          <div className="workout-action-head">
            <div className="workout-action-title">Session actions</div>
            <p className="workout-action-copy">Generate or update today&apos;s session from the selected plan/date.</p>
          </div>
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
            Generate for today
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
            Generate selected date
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
            Generate Session
          </button>

          <button className="haptic-tap workout-action-pill is-secondary" type="button" onClick={addSetRow}>
            + Add Set
          </button>

          <button
            className="haptic-tap workout-action-pill is-secondary"
            type="button"
            onClick={() => {
              setSuccess(null);
              setError(null);
              repeatLastWorkout().catch((e) => setError(e.message));
            }}
          >
            Repeat last workout
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
            Apply planned sets
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
            Quick add set
          </button>
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {success && <div className="text-sm text-green-700">{success}</div>}
        {lastSavedLogId && (
          <a
            className="text-sm underline"
            href={`/workout/session/${encodeURIComponent(lastSavedLogId)}`}
          >
            Open session detail
          </a>
        )}

        <div className="motion-card rounded-xl border p-3 space-y-3">
          <div className="text-sm font-medium">Session overrides ({sessionKey})</div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs text-neutral-600">Selected set row (must be extra)</span>
              <select
                className="rounded-lg border px-3 py-2"
                value={selectedSetIdx === null ? "" : String(selectedSetIdx)}
                onChange={(e) => {
                  setSelectedSetIdx(e.target.value === "" ? null : Number(e.target.value));
                }}
              >
                <option value="">(select row)</option>
                {sets.map((s, idx) => (
                  <option key={idx} value={idx}>
                    #{idx + 1} {s.exerciseName || "(empty)"} [{s.isExtra ? "extra" : s.isPlanned ? "planned" : "custom"}]
                  </option>
                ))}
              </select>
            </label>
            <button
              className="haptic-tap workout-action-pill is-secondary workout-inline-action"
              type="button"
              onClick={() => {
                setSuccess(null);
                setError(null);
                makeAccessoryPermanent().catch((e) => setError(e.message));
              }}
            >
              Make accessory permanent
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">blockTarget</span>
              <select
                className="rounded-lg border px-3 py-2"
                value={blockTarget}
                onChange={(e) => setBlockTarget(e.target.value)}
              >
                <option value="SQUAT">SQUAT</option>
                <option value="BENCH">BENCH</option>
                <option value="DEADLIFT">DEADLIFT</option>
                <option value="OHP">OHP</option>
                <option value="PULL">PULL</option>
                <option value="CUSTOM">CUSTOM</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs text-neutral-600">replacement exerciseName</span>
              <input
                className="rounded-lg border px-3 py-2"
                value={replacementExerciseName}
                onChange={(e) => setReplacementExerciseName(e.target.value)}
                placeholder="e.g. Paused Bench Press"
              />
            </label>
            <button
              className="haptic-tap workout-action-pill is-secondary workout-inline-action"
              type="button"
              onClick={() => {
                setSuccess(null);
                setError(null);
                replaceExercisePermanent().catch((e) => setError(e.message));
              }}
            >
              Replace exercise
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="motion-card rounded-2xl border p-4 space-y-3">
          <div className="font-medium">Generated snapshot</div>
          {generatedSession ? (
            <div className="space-y-3">
              <div className="text-xs text-neutral-600">generatedSessionId: {generatedSession.id}</div>

              <div className="space-y-1">
                <div className="text-sm font-medium">exercises (planned)</div>
                <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
                  {JSON.stringify(snapshot?.exercises ?? [], null, 2)}
                </pre>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">blocks</div>
                <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
                  {JSON.stringify(snapshot?.blocks ?? [], null, 2)}
                </pre>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">manualSession</div>
                <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
                  {JSON.stringify(snapshot?.manualSession ?? null, null, 2)}
                </pre>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">accessories</div>
                <pre className="rounded-xl border bg-neutral-50 p-3 overflow-auto text-xs">
                  {JSON.stringify(snapshot?.accessories ?? [], null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-sm text-neutral-600">Generate first.</div>
          )}
        </div>

        <div className="motion-card rounded-2xl border p-4 space-y-3">
          <div className="font-medium">Sets to save</div>

          {defaultExercisesFromSnapshot.length > 0 && (
            <div className="text-xs text-neutral-600">
              Suggestions: {defaultExercisesFromSnapshot.join(", ")}
            </div>
          )}
          <div className="text-xs text-neutral-600">
            Keyboard: Enter inserts next set, arrow keys move between cells.
          </div>

          <div className="space-y-3 ui-height-animate">
            {sets.map((s, idx) => (
              <WorkoutSetRow
                key={`${idx}-${s.exerciseName}-${s.setNumber}`}
                idx={idx}
                row={s}
                setCellKey={setCellKey}
                setInputRefs={setInputRefs}
                handleSetGridKeyDown={handleSetGridKeyDown}
                updateRow={(updater) => updateSetRow(idx, updater)}
                onCompleteAndNext={() => completeSetAndAddNext(idx)}
                onCopyPrevious={() => copyPreviousSet(idx)}
                onInsertBelow={() => insertSetBelow(idx, 0)}
                onRemove={() => setSets((prev) => prev.filter((_, i) => i !== idx))}
                canCopyPrevious={idx !== 0}
              />
            ))}
          </div>
          <datalist id="exercise-options">
            {exerciseOptions.flatMap((ex) => [
              <option key={`n-${ex.id}`} value={ex.name} />,
              ...ex.aliases.map((a) => <option key={`a-${ex.id}-${a}`} value={a} />),
            ])}
          </datalist>

          <div className="motion-card rounded-xl border p-3 space-y-2">
            <div className="font-medium">Session detail: Compare planned vs performed</div>
            {compareRows.length === 0 ? (
              <div className="text-sm text-neutral-600">No planned/performed rows to compare.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-neutral-600">
                    <tr>
                      <th className="text-left py-1 pr-3">Exercise</th>
                      <th className="text-right py-1 px-3">Set#</th>
                      <th className="text-right py-1 px-3">Planned</th>
                      <th className="text-right py-1 px-3">Performed</th>
                      <th className="text-right py-1 pl-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((r, idx) => {
                      const plannedText = r.planned
                        ? `${r.planned.reps || "-"} reps @ ${r.planned.weightKg || 0}kg`
                        : "-";
                      const performedText = r.actual
                        ? `${r.actual.reps || "-"} reps @ ${r.actual.weightKg || 0}kg`
                        : "-";
                      const status = !r.planned
                        ? "extra"
                        : !r.actual
                          ? "missing"
                          : r.actual.completed
                            ? "done"
                            : "pending";
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
          </div>
        </div>
      </div>

      <div className="workout-save-dock">
        <button
          className="ui-primary-button workout-save-button"
          onClick={handleSaveLog}
          disabled={!planId}
        >
          {isOfflineMode
            ? `Save Offline${pendingSyncCount > 0 ? ` (${pendingSyncCount} pending)` : ""}`
            : pendingSyncCount > 0
              ? `Save Log (${pendingSyncCount} pending)`
              : "Save Log"}
        </button>
      </div>

    </div>
  );
}
