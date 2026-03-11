"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import { SearchSelectSheet } from "@/components/ui/search-select-sheet";
import { apiGet } from "@/lib/api";
import { APP_ROUTES } from "@/lib/app-routes";
import { extractSessionDate, parseSessionKey } from "@/lib/session-key";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { buildTodayLogHref } from "@/lib/workout-links";

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

type SnapshotSet = {
  reps?: number;
  targetWeightKg?: number;
};

type SnapshotExercise = {
  exerciseName?: string;
  role?: "MAIN" | "ASSIST" | string;
  sets?: SnapshotSet[];
};

type GeneratedSessionDetail = RecentGeneratedSession & {
  snapshot: {
    exercises?: SnapshotExercise[];
  } | null;
};

type WorkoutLogSummary = {
  id: string;
  performedAt: string;
  generatedSessionId: string | null;
};

type WorkoutLogForDate = {
  id: string;
  performedAt: string;
  generatedSessionId: string | null;
  sets: Array<{
    exerciseName: string;
    reps: number | null;
    weightKg: number | null;
  }>;
};

const WEEKDAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"] as const;
const MONTH_NAMES = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
] as const;
const WEEKDAY_KOREAN = ["일", "월", "화", "수", "목", "금", "토"] as const;

type CalendarExercisePreviewItem = {
  name: string;
  role: "MAIN" | "ASSIST" | string;
  summary: string;
};

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

function dateOnlyToUtcDate(s: string) {
  return new Date(`${s}T00:00:00Z`);
}

function utcDateToDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateOnly: string, days: number) {
  const d = dateOnlyToUtcDate(dateOnly);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateToDateOnly(d);
}

function monthStart(dateOnly: string) {
  const d = dateOnlyToUtcDate(dateOnly);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function monthGrid(dateOnly: string) {
  const start = monthStart(dateOnly);
  const d = dateOnlyToUtcDate(start);
  const offset = d.getUTCDay(); // Sunday start
  const gridStart = addDays(start, -offset);
  return Array.from({ length: 35 }, (_, i) => addDays(gridStart, i));
}

function dayOfMonth(dateOnly: string) {
  return Number(dateOnly.slice(8, 10));
}

function getYear(dateOnly: string) {
  return Number(dateOnly.slice(0, 4));
}

function getMonth(dateOnly: string) {
  return Number(dateOnly.slice(5, 7));
}

function getDayOfWeek(dateOnly: string) {
  return dateOnlyToUtcDate(dateOnly).getUTCDay();
}

function formatKoreanDate(dateOnly: string) {
  const y = getYear(dateOnly);
  const m = getMonth(dateOnly);
  const d = dayOfMonth(dateOnly);
  const dow = getDayOfWeek(dateOnly);
  return `${y}년 ${m}월 ${d}일 ${WEEKDAY_KOREAN[dow]}요일`;
}

function daysBetween(aDateOnly: string, bDateOnly: string) {
  return Math.floor(
    (dateOnlyToUtcDate(aDateOnly).getTime() - dateOnlyToUtcDate(bDateOnly).getTime()) / 86_400_000,
  );
}

function normalizeSearchText(...values: Array<string | null | undefined>) {
  return values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function formatVolume(kg: number) {
  if (kg >= 1000) {
    const tons = kg / 1000;
    return Number.isInteger(tons) ? `${tons}t` : `${tons.toFixed(1)}t`;
  }
  return `${kg}kg`;
}

function summarizePlannedSets(sets: SnapshotSet[]) {
  if (sets.length === 0) return "";

  const groups: Array<{ reps: number; weight: number; count: number }> = [];
  for (const set of sets) {
    const reps = Number(set.reps ?? 0);
    const weight = Number(set.targetWeightKg ?? 0);
    const last = groups[groups.length - 1];
    if (last && last.reps === reps && last.weight === weight) {
      last.count += 1;
      continue;
    }
    groups.push({ reps, weight, count: 1 });
  }

  if (groups.length === 1) {
    const [group] = groups;
    const weightSuffix = group.weight > 0 ? ` @ ${group.weight}kg` : "";
    return `${group.count}x${group.reps}${weightSuffix}`;
  }

  const maxWeight = Math.max(...groups.map((group) => group.weight), 0);
  const weightSuffix = maxWeight > 0 ? ` (max ${maxWeight}kg)` : "";
  return `${groups.map((group) => `${group.count}x${group.reps}`).join(", ")}${weightSuffix}`;
}

function buildPlannedExercisePreview(snapshot: GeneratedSessionDetail["snapshot"]): CalendarExercisePreviewItem[] {
  const exercises = Array.isArray(snapshot?.exercises) ? snapshot.exercises : [];

  return exercises
    .map((exercise) => {
      const name = String(exercise?.exerciseName ?? "").trim();
      if (!name) return null;
      const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
      return {
        name,
        role: exercise?.role ?? "MAIN",
        summary: summarizePlannedSets(sets),
      } satisfies CalendarExercisePreviewItem;
    })
    .filter((exercise): exercise is CalendarExercisePreviewItem => exercise !== null);
}

function buildLoggedExercisePreview(sets: WorkoutLogForDate["sets"]): {
  exercises: CalendarExercisePreviewItem[];
  totalSets: number;
  totalVolume: number;
} {
  let totalVolume = 0;
  const grouped = new Map<string, { count: number; bestWeight: number; bestReps: number }>();

  for (const set of sets) {
    const name = String(set.exerciseName ?? "").trim();
    if (!name) continue;

    const reps = Number(set.reps ?? 0);
    const weight = Number(set.weightKg ?? 0);
    totalVolume += Math.max(0, reps) * Math.max(0, weight);

    const current = grouped.get(name);
    if (!current) {
      grouped.set(name, { count: 1, bestWeight: weight, bestReps: reps });
      continue;
    }

    current.count += 1;
    if (weight > current.bestWeight || (weight === current.bestWeight && reps > current.bestReps)) {
      current.bestWeight = weight;
      current.bestReps = reps;
    }
  }

  return {
    exercises: Array.from(grouped.entries()).map(([name, value]) => ({
      name,
      role: "MAIN",
      summary:
        value.bestWeight > 0
          ? `${value.count}x${value.bestReps} @ ${value.bestWeight}kg`
          : `${value.count}x${value.bestReps}`,
    })),
    totalSets: sets.length,
    totalVolume: Math.round(totalVolume),
  };
}

function CalendarExercisePreview({ exercises }: { exercises: CalendarExercisePreviewItem[] }) {
  if (exercises.length === 0) return null;

  const mainExercises = exercises.filter((exercise) => exercise.role === "MAIN");
  const assistExercises = exercises.filter((exercise) => exercise.role !== "MAIN");

  return (
    <div className="hd-today-exercises">
      {mainExercises.length > 0 && (
        <div className="hd-today-exercise-group">
          {mainExercises.map((exercise) => (
            <div key={exercise.name} className="hd-today-exercise hd-today-exercise--main">
              <span className="hd-today-exercise-name">{exercise.name}</span>
              <span className="hd-today-exercise-summary">{exercise.summary}</span>
            </div>
          ))}
        </div>
      )}
      {assistExercises.length > 0 && (
        <div className="hd-today-exercise-group">
          {assistExercises.slice(0, 3).map((exercise) => (
            <div key={exercise.name} className="hd-today-exercise">
              <span className="hd-today-exercise-name">{exercise.name}</span>
              <span className="hd-today-exercise-summary">{exercise.summary}</span>
            </div>
          ))}
          {assistExercises.length > 3 && (
            <div className="hd-today-exercise hd-today-exercise--more">
              +{assistExercises.length - 3}개 보조 운동
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function computePlanContextForDate(plan: Plan | null, dateOnly: string) {
  if (!plan) return null;
  const params = plan.params ?? {};
  const mode = String(params.sessionKeyMode ?? "").toUpperCase();
  const startDate =
    typeof params.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.startDate)
      ? params.startDate
      : null;

  let week = 1;
  let day = 1;
  let scheduleKey: string | null = null;
  let planned = true;

  if (startDate) {
    const delta = daysBetween(dateOnly, startDate);
    if (delta < 0) planned = false;
    const normalized = Math.max(0, delta);
    if (plan.type === "MANUAL") {
      const schedule = Array.isArray(params.schedule) ? params.schedule : [];
      const span = Math.max(1, schedule.length || 1);
      day = (normalized % span) + 1;
      week = Math.floor(normalized / span) + 1;
      if (schedule.length > 0) {
        scheduleKey = String(schedule[(day - 1) % schedule.length]);
      }
    } else {
      const sessionsPerWeek = Math.max(1, Number(params.sessionsPerWeek ?? 7));
      day = (normalized % sessionsPerWeek) + 1;
      week = Math.floor(normalized / sessionsPerWeek) + 1;
    }
  } else {
    planned = false;
  }

  const sessionKey = mode === "DATE" ? dateOnly : `W${week}D${day}`;
  return { planned, week, day, scheduleKey, sessionKey };
}

function sessionKeyToWDLabel(sessionKey: string): string | null {
  const parsed = parseSessionKey(sessionKey);
  if (!parsed || parsed.week === null || parsed.day === null) return null;
  return `W${parsed.week}D${parsed.day}`;
}

function getNextSessionLabel(sessionKey: string, sessionsPerWeek: number): string | null {
  const parsed = parseSessionKey(sessionKey);
  if (!parsed || parsed.week === null || parsed.day === null) return null;
  const nextDay = parsed.day < sessionsPerWeek ? parsed.day + 1 : 1;
  const nextWeek = parsed.day < sessionsPerWeek ? parsed.week : parsed.week + 1;
  return `W${nextWeek}D${nextDay}`;
}

export default function CalendarPage() {
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const today = useMemo(() => dateOnlyInTimezone(new Date(), timezone), [timezone]);

  const [anchorDate, setAnchorDate] = useState(() =>
    dateOnlyInTimezone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    dateOnlyInTimezone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
  );
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [recentSessions, setRecentSessions] = useState<RecentGeneratedSession[]>([]);
  const [allPlanLogs, setAllPlanLogs] = useState<WorkoutLogSummary[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkoutLogForDate | null>(null);
  const [selectedLogLoading, setSelectedLogLoading] = useState(false);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<GeneratedSessionDetail | null>(null);
  const [selectedSessionLoading, setSelectedSessionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [planQuery, setPlanQuery] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId]);
  const orderedPlans = useMemo(() => {
    if (!selectedPlan) return plans;
    return [selectedPlan, ...plans.filter((plan) => plan.id !== selectedPlan.id)];
  }, [plans, selectedPlan]);
  const filteredPlans = useMemo(() => {
    const normalizedQuery = planQuery.trim().toLowerCase();
    if (!normalizedQuery) return orderedPlans;
    return orderedPlans.filter((plan) =>
      normalizeSearchText(plan.name, plan.type).includes(normalizedQuery),
    );
  }, [orderedPlans, planQuery]);
  const anchorMonthKey = useMemo(() => monthStart(anchorDate).slice(0, 7), [anchorDate]);
  const cells = useMemo(() => monthGrid(anchorDate), [anchorDate]);
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      setRefreshTick((prev) => prev + 1);
    },
    triggerSelector: "[data-pull-refresh-trigger]",
  });

  // Load plans
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await apiGet<{ items: Plan[] }>("/api/plans");
        if (cancelled) return;
        setPlans(res.items);
        setPlanId((prev) => {
          if (prev && res.items.some((p) => p.id === prev)) return prev;
          return res.items[0]?.id ?? "";
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "플랜을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  // Load sessions for selected plan
  useEffect(() => {
    if (!planId) {
      setRecentSessions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sp = new URLSearchParams();
        sp.set("planId", planId);
        sp.set("limit", "200");
        const res = await apiGet<{ items: RecentGeneratedSession[] }>(
          `/api/generated-sessions?${sp.toString()}`,
        );
        if (!cancelled) setRecentSessions(res.items);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "세션을 불러오지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, refreshTick]);

  useEffect(() => {
    if (!planId) {
      setSelectedLog(null);
      setSelectedLogLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setSelectedLogLoading(true);
        setError(null);
        const sp = new URLSearchParams();
        sp.set("planId", planId);
        sp.set("date", selectedDate);
        sp.set("timezone", timezone);
        sp.set("limit", "1");
        const res = await apiGet<{ items: WorkoutLogForDate[] }>(`/api/logs?${sp.toString()}`);
        if (cancelled) return;
        setSelectedLog(res.items[0] ?? null);
      } catch (e: any) {
        if (!cancelled) {
          setSelectedLog(null);
          setError(e?.message ?? "운동기록을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setSelectedLogLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planId, refreshTick, selectedDate, timezone]);

  // Load all logs for selected plan (used for dot indicators and next session label)
  useEffect(() => {
    if (!planId) {
      setAllPlanLogs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sp = new URLSearchParams();
        sp.set("planId", planId);
        sp.set("limit", "200");
        const res = await apiGet<{ items: WorkoutLogSummary[] }>(`/api/logs?${sp.toString()}`);
        if (!cancelled) setAllPlanLogs(res.items);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, refreshTick]);

  // Build lookup maps
  const generatedByDate = useMemo(() => {
    const map = new Map<string, RecentGeneratedSession>();
    for (const session of recentSessions) {
      const dateOnly = extractSessionDate(session.sessionKey);
      if (!dateOnly) continue;
      const current = map.get(dateOnly);
      if (!current || new Date(current.updatedAt).getTime() < new Date(session.updatedAt).getTime()) {
        map.set(dateOnly, session);
      }
    }
    return map;
  }, [recentSessions]);

  const generatedByKey = useMemo(() => {
    const map = new Map<string, RecentGeneratedSession>();
    for (const session of recentSessions) {
      map.set(session.sessionKey, session);
    }
    return map;
  }, [recentSessions]);

  const generatedById = useMemo(() => {
    const map = new Map<string, RecentGeneratedSession>();
    for (const session of recentSessions) {
      map.set(session.id, session);
    }
    return map;
  }, [recentSessions]);

  // Dates that have actual logged workouts (used for dot indicators)
  const logDates = useMemo(() => {
    const set = new Set<string>();
    for (const log of allPlanLogs) {
      set.add(dateOnlyInTimezone(new Date(log.performedAt), timezone));
    }
    return set;
  }, [allPlanLogs, timezone]);

  // Session key of the most recently completed workout
  const lastLogSessionKey = useMemo(() => {
    const lastLog = allPlanLogs[0];
    if (!lastLog?.generatedSessionId) return null;
    return generatedById.get(lastLog.generatedSessionId)?.sessionKey ?? null;
  }, [allPlanLogs, generatedById]);

  function getSessionForDate(dateOnly: string): RecentGeneratedSession | null {
    const ctx = computePlanContextForDate(selectedPlan, dateOnly);
    const mode = String(selectedPlan?.params?.sessionKeyMode ?? "").toUpperCase();
    if (mode === "DATE") return generatedByDate.get(dateOnly) ?? null;
    return ctx ? (generatedByKey.get(ctx.sessionKey) ?? null) : null;
  }

  const [animKey, setAnimKey] = useState(0);
  const [animClass, setAnimClass] = useState<"" | "slide-from-below" | "slide-from-above">("");
  const swipeTouchRef = useRef<{ startY: number; startX: number } | null>(null);
  const calGestureRef = useRef<HTMLDivElement>(null);

  function shiftMonth(delta: number) {
    const d = dateOnlyToUtcDate(anchorDate);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setAnimClass(delta > 0 ? "slide-from-below" : "slide-from-above");
    setAnimKey((k) => k + 1);
    setAnchorDate(utcDateToDateOnly(d));
  }

  function handleCalSwipeTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    swipeTouchRef.current = { startY: t.clientY, startX: t.clientX };
  }

  function handleCalSwipeTouchEnd(e: React.TouchEvent) {
    if (!swipeTouchRef.current) return;
    const t = e.changedTouches[0];
    const dy = swipeTouchRef.current.startY - t.clientY;
    const dx = Math.abs(swipeTouchRef.current.startX - t.clientX);
    swipeTouchRef.current = null;
    if (Math.abs(dy) < 40 || dx > Math.abs(dy) * 0.8) return;
    shiftMonth(dy > 0 ? 1 : -1);
  }

  useEffect(() => {
    const el = calGestureRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (!swipeTouchRef.current) return;
      const t = e.touches[0];
      const dy = Math.abs(swipeTouchRef.current.startY - t.clientY);
      const dx = Math.abs(swipeTouchRef.current.startX - t.clientX);
      if (dy > dx && dy > 8) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  function goToToday() {
    setAnchorDate(today);
    setSelectedDate(today);
  }

  const selectedCtx = useMemo(
    () => computePlanContextForDate(selectedPlan, selectedDate),
    [selectedPlan, selectedDate],
  );
  const selectedSession = getSessionForDate(selectedDate);
  const isAutoProgressionPlan = selectedPlan?.params?.autoProgression === true;
  const isPastDate = selectedDate < today;
  const isPastDateCreationBlocked = isAutoProgressionPlan && isPastDate && !selectedLog;
  const loggedSummary = useMemo(
    () => buildLoggedExercisePreview(selectedLog?.sets ?? []),
    [selectedLog],
  );
  const plannedExercises = useMemo(
    () => buildPlannedExercisePreview(selectedSessionDetail?.snapshot ?? null),
    [selectedSessionDetail],
  );

  const selectedDayLabel = (() => {
    if (!selectedCtx) return null;
    if (selectedPlan?.type === "MANUAL" && selectedCtx.scheduleKey) return selectedCtx.scheduleKey;
    return `W${selectedCtx.week}D${selectedCtx.day}`;
  })();

  // WxDy label derived from the last completed log's session key (not calendar arithmetic)
  const nextSessionLabel = useMemo(() => {
    if (!lastLogSessionKey || !selectedPlan) return null;
    const sessionsPerWeek = Math.max(1, Number(selectedPlan.params?.sessionsPerWeek ?? 7));
    return getNextSessionLabel(lastLogSessionKey, sessionsPerWeek);
  }, [lastLogSessionKey, selectedPlan]);

  // WxDy label for the currently selected log (from actual session key, not calendar math)
  const loggedDayLabel = useMemo(() => {
    if (!selectedLog?.generatedSessionId) return selectedDayLabel;
    return sessionKeyToWDLabel(generatedById.get(selectedLog.generatedSessionId)?.sessionKey ?? "") ?? selectedDayLabel;
  }, [selectedLog, generatedById, selectedDayLabel]);

  // WxDy label for a generated-but-unlogged session
  const selectedSessionWDLabel = useMemo(() => {
    if (!selectedSession) return null;
    return sessionKeyToWDLabel(selectedSession.sessionKey);
  }, [selectedSession]);

  const workoutHref = selectedLog
    ? buildTodayLogHref({ planId, date: selectedDate, logId: selectedLog.id })
    : planId
      ? buildTodayLogHref({ planId, date: selectedDate, autoGenerate: false })
      : APP_ROUTES.todayLog;

  useEffect(() => {
    if (!selectedSession?.id || selectedLog) {
      setSelectedSessionDetail(null);
      setSelectedSessionLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setSelectedSessionLoading(true);
        const sp = new URLSearchParams();
        sp.set("id", selectedSession.id);
        sp.set("includeSnapshot", "1");
        sp.set("limit", "1");
        if (planId) sp.set("planId", planId);
        const res = await apiGet<{ items: GeneratedSessionDetail[] }>(
          `/api/generated-sessions?${sp.toString()}`,
        );
        if (cancelled) return;
        setSelectedSessionDetail(res.items[0] ?? null);
      } catch (e: any) {
        if (!cancelled) {
          setSelectedSessionDetail(null);
          setError(e?.message ?? "세션 상세를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setSelectedSessionLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planId, selectedLog, selectedSession?.id]);

  return (
    <div className="native-page native-page-enter tab-screen ios-cal-screen momentum-scroll" {...pullToRefresh.bind}>
      <PullToRefreshIndicator
        pullOffset={pullToRefresh.pullOffset}
        progress={pullToRefresh.progress}
        status={pullToRefresh.status}
        refreshingLabel="캘린더 새로고침 중..."
        completeLabel="캘린더 갱신 완료"
      />
      {/* Plan selector bar */}
      {plans.length > 0 && (
        <div className="ios-cal-plan-bar" data-pull-refresh-trigger="true">
          <button
            type="button"
            className="haptic-tap app-select-row app-select-row--standalone app-select-row-button ios-cal-plan-button"
            aria-label="플랜 선택 열기"
            aria-haspopup="dialog"
            aria-expanded={planSheetOpen}
            onClick={() => {
              setPlanQuery("");
              setPlanSheetOpen(true);
            }}
          >
            <span className="app-select-row-right">
              <span className="app-select-trigger-value">{selectedPlan?.name ?? "플랜 선택"}</span>
              <span className="app-select-row-chevron" aria-hidden="true">
                <svg viewBox="0 0 12 16" width="10" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                  <path d="M2 5.5L6 2L10 5.5" />
                  <path d="M2 10.5L6 14L10 10.5" />
                </svg>
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Month navigation header */}
      <div
        ref={calGestureRef}
        className="ios-cal-gesture-area"
        onTouchStart={handleCalSwipeTouchStart}
        onTouchEnd={handleCalSwipeTouchEnd}
      >
      <div
        className="ios-cal-header"
        data-pull-refresh-trigger="true"
      >
        <div className="ios-cal-header-left">
          <button className="ios-cal-month-label-large" onClick={goToToday} aria-label="오늘로 이동">
            {MONTH_NAMES[getMonth(anchorDate) - 1]}
          </button>
          <span className="ios-cal-year-label">{getYear(anchorDate)}년</span>
        </div>
        <div className="ios-cal-header-right">
          <button
            className="ios-cal-nav-btn"
            onClick={() => shiftMonth(-1)}
            aria-label="이전 달"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            className="ios-cal-nav-btn"
            onClick={() => shiftMonth(1)}
            aria-label="다음 달"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weekday header row */}
      <div className="ios-cal-weekdays" aria-hidden="true">
        {WEEKDAY_SHORT.map((name, i) => (
          <div key={name} className={`ios-cal-weekday${i === 0 ? " is-sun" : ""}`}>
            {name}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div
        key={animKey}
        className={`ios-cal-grid ${animClass}`}
        role="grid"
        aria-label="날짜 선택"
      >
        {Array.from({ length: 5 }, (_, week) => (
          <div key={week} className="ios-cal-week-row">
            {cells.slice(week * 7, week * 7 + 7).map((dateOnly) => {
              const isToday = dateOnly === today;
              const isSelected = dateOnly === selectedDate;
              const isOutside = !dateOnly.startsWith(anchorMonthKey);
              const hasDot = !!selectedPlan && logDates.has(dateOnly);
              const dow = getDayOfWeek(dateOnly);

              return (
                <button
                  key={dateOnly}
                  role="gridcell"
                  className={[
                    "ios-cal-day",
                    isToday ? "is-today" : "",
                    isSelected ? "is-selected" : "",
                    isOutside ? "is-outside" : "",
                    dow === 0 ? "is-sun" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelectedDate(dateOnly)}
                  aria-label={`${getYear(dateOnly)}년 ${getMonth(dateOnly)}월 ${dayOfMonth(dateOnly)}일`}
                  aria-selected={isSelected}
                >
                  <span className="ios-cal-day-num">{dayOfMonth(dateOnly)}</span>
                  {hasDot && <span className="ios-cal-day-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      </div>{/* /ios-cal-gesture-area */}

      {/* Divider */}
      <div className="ios-cal-divider" role="separator" />

      {/* Selected date detail panel */}
      <div className="ios-cal-detail">
        <div className="ios-cal-detail-header">
          <span className="ios-cal-detail-date">{formatKoreanDate(selectedDate)}</span>
          {selectedDate === today && <span className="ios-cal-today-badge">오늘</span>}
        </div>

        {error && <div className="ios-cal-error">{error}</div>}

        {loading || selectedLogLoading || selectedSessionLoading ? (
          <div className="ios-cal-loading">
            <span className="ios-cal-loading-dot" />
            <span className="ios-cal-loading-dot" />
            <span className="ios-cal-loading-dot" />
          </div>
        ) : !selectedPlan ? (
          <div className="ios-cal-empty-state">
            <p className="ios-cal-empty-text">플랜을 선택하면 날짜별 세션을 확인할 수 있습니다.</p>
          </div>
        ) : selectedLog ? (
          <div className="hd-today-card ios-cal-summary-card">
            <div className="hd-today-top">
              <div className="hd-today-left">
                <div className="hd-today-program">{selectedPlan.name}</div>
                <p className="hd-today-meta">
                  기록 있음 · {loggedSummary.totalSets}세트 · {formatVolume(loggedSummary.totalVolume)}
                </p>
              </div>
              {loggedDayLabel && <span className="hd-today-badge hd-today-badge--planned">{loggedDayLabel}</span>}
            </div>

            <CalendarExercisePreview exercises={loggedSummary.exercises} />

            <a className="hd-today-cta ios-cal-summary-cta" href={workoutHref}>
              <span className="hd-today-cta-text">기록수정</span>
              <svg className="hd-today-cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
          </div>
        ) : selectedSession ? (
          <div className="hd-today-card ios-cal-summary-card">
            <div className="hd-today-top">
              <div className="hd-today-left">
                <div className="hd-today-program">{selectedPlan.name}</div>
                <p className="hd-today-meta">
                  생성됨 · {new Date(selectedSession.updatedAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
              {selectedSessionWDLabel && <span className="hd-today-badge hd-today-badge--planned">{selectedSessionWDLabel}</span>}
            </div>

            <CalendarExercisePreview exercises={plannedExercises} />

            {isPastDateCreationBlocked ? (
              <p className="hd-today-meta ios-cal-summary-note">
                자동 진행 플랜은 오늘 이전 날짜에 새 기록을 추가할 수 없습니다.
              </p>
            ) : (
              <a className="hd-today-cta ios-cal-summary-cta" href={workoutHref}>
                <span className="hd-today-cta-text">기록하기</span>
                <svg className="hd-today-cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </a>
            )}
          </div>
        ) : (
          /* No session yet */
          <div className="ios-cal-no-session">
            <div className="ios-cal-session-card-left">
              <div className="ios-cal-session-dot-muted" aria-hidden="true" />
              <div className="ios-cal-session-info">
                {isPastDateCreationBlocked ? null : (
                  <span className="ios-cal-session-key ios-cal-session-key--muted">
                    {selectedCtx?.planned ? (nextSessionLabel ?? "세션 없음") : "즉시 기록 가능"}
                  </span>
                )}
                <span className="ios-cal-session-meta">
                  {isPastDateCreationBlocked
                    ? "자동 진행 플랜은 오늘 이전 날짜에 새 기록을 추가할 수 없습니다."
                    : selectedCtx?.planned
                    ? "기록하기를 누르면 이 날짜 세션을 준비하고 바로 기록을 시작합니다."
                    : "기록하기를 누르면 이 날짜 기록 화면으로 바로 이동합니다."}
                </span>
              </div>
            </div>
            {!isPastDateCreationBlocked ? (
              <div className="ios-cal-no-session-actions">
                <a className="ios-cal-action-btn ios-cal-action-btn--primary" href={workoutHref}>
                  기록하기
                </a>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <SearchSelectSheet
        open={planSheetOpen}
        title="플랜 선택"
        description="캘린더에 표시할 플랜을 검색해 전환합니다."
        onClose={() => {
          setPlanSheetOpen(false);
          setPlanQuery("");
        }}
        closeLabel="닫기"
        label="플랜 드롭다운 검색/선택"
        query={planQuery}
        placeholder="플랜 검색"
        onQueryChange={setPlanQuery}
        onQuerySubmit={() => {
          const first = filteredPlans[0] ?? null;
          if (!first) return;
          setPlanId(first.id);
          setPlanSheetOpen(false);
          setPlanQuery("");
        }}
        resultsAriaLabel="플랜 검색 결과"
        emptyText="검색 조건에 맞는 플랜이 없습니다."
        options={filteredPlans.map((plan) => ({
          key: plan.id,
          label: plan.name,
          active: plan.id === planId,
          ariaCurrent: plan.id === planId,
          onSelect: () => {
            setPlanId(plan.id);
            setPlanSheetOpen(false);
            setPlanQuery("");
          },
        }))}
      />
    </div>
  );
}
