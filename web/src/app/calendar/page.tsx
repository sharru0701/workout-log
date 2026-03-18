"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import { MonthYearPickerSheet } from "@/components/ui/month-year-picker-sheet";
import { SearchSelectSheet } from "@/components/ui/search-select-sheet";
import { SessionCard } from "@/components/ui/session-card";
import { apiGet } from "@/lib/api";
import { 
  dateOnlyToUtcDate, 
  utcDateToDateOnly, 
  addDays, 
  monthStart, 
  monthGrid, 
  dayOfMonth, 
  getDayOfWeek,
  getYear,
  getMonth,
  setMonthOfDate,
  shiftDateByMonths
} from "@/lib/date-utils";
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


function formatKoreanDay(dateOnly: string) {
  const d = dayOfMonth(dateOnly);
  const dow = getDayOfWeek(dateOnly);
  return `${d}일 ${WEEKDAY_KOREAN[dow]}요일`;
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
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [planQuery, setPlanQuery] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [monthNavFeedback, setMonthNavFeedback] = useState<"" | "prev" | "next">("");
  const monthNavFeedbackTimerRef = useRef<number | null>(null);

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

  // For wave-mode sessions: maps generatedSessionId → the date it was actually logged
  const sessionLoggedDateMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of allPlanLogs) {
      if (log.generatedSessionId) {
        const logDate = dateOnlyInTimezone(new Date(log.performedAt), timezone);
        map.set(log.generatedSessionId, logDate);
      }
    }
    return map;
  }, [allPlanLogs, timezone]);

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
    if (!ctx) return null;
    const session = generatedByKey.get(ctx.sessionKey) ?? null;
    if (!session) return null;
    // Wave mode: if this session was already logged on a different date, don't show it here
    const loggedDate = sessionLoggedDateMap.get(session.id);
    if (loggedDate && loggedDate !== dateOnly) return null;
    return session;
  }

  function setCalendarMonth(value: { year: number; month: number }) {
    const currentMonthValue = getYear(anchorDate) * 12 + getMonth(anchorDate);
    const nextMonthValue = value.year * 12 + value.month;
    if (nextMonthValue === currentMonthValue) return;
    const nextAnchorDate = setMonthOfDate(anchorDate, value.year, value.month);
    const nextSelectedDate = setMonthOfDate(selectedDate, value.year, value.month);
    setAnchorDate(nextAnchorDate);
    setSelectedDate(nextSelectedDate);
  }

  function shiftMonth(delta: number) {
    const nextAnchorDate = shiftDateByMonths(anchorDate, delta);
    setCalendarMonth({ year: getYear(nextAnchorDate), month: getMonth(nextAnchorDate) });
  }

  function shiftMonthWithFeedback(delta: number) {
    setMonthNavFeedback(delta < 0 ? "prev" : "next");
    if (monthNavFeedbackTimerRef.current !== null) {
      window.clearTimeout(monthNavFeedbackTimerRef.current);
      monthNavFeedbackTimerRef.current = null;
    }
    monthNavFeedbackTimerRef.current = window.setTimeout(() => {
      setMonthNavFeedback("");
      monthNavFeedbackTimerRef.current = null;
    }, 240);
    shiftMonth(delta);
  }

  function handleMonthPickerChange(value: { year: number; month: number }) {
    setCalendarMonth(value);
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

  useEffect(
    () => () => {
      if (monthNavFeedbackTimerRef.current === null) return;
      window.clearTimeout(monthNavFeedbackTimerRef.current);
      monthNavFeedbackTimerRef.current = null;
    },
    [],
  );

  const renderMonthRows = (baseDate: string, selectedForGrid: string) => {
    const baseMonthKey = monthStart(baseDate).slice(0, 7);
    const cells = monthGrid(baseDate);
    return Array.from({ length: Math.ceil(cells.length / 7) }, (_, week) => (
      <div key={`${baseDate}-week-${week}`} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center" }}>
        {cells.slice(week * 7, week * 7 + 7).map((dateOnly) => {
          const isToday = dateOnly === today;
          const isSelected = dateOnly === selectedForGrid;
          const isOutside = !dateOnly.startsWith(baseMonthKey);
          const hasDot = !!selectedPlan && logDates.has(dateOnly);
          const dow = getDayOfWeek(dateOnly);

          return (
            <button
              key={dateOnly}
              role="gridcell"
              onClick={() => setSelectedDate(dateOnly)}
              aria-label={`${getYear(dateOnly)}년 ${getMonth(dateOnly)}월 ${dayOfMonth(dateOnly)}일`}
              aria-selected={isSelected}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                margin: "4px auto",
                padding: 0,
                border: isSelected ? "1px solid var(--color-selected-border)" : "1px solid transparent",
                background: isSelected ? "var(--color-selected-bg)" : "transparent",
                color: isSelected ? "var(--color-selected-text)" : isOutside ? "var(--color-text-subtle)" : dow === 0 ? "var(--color-danger)" : dow === 6 ? "var(--color-calendar-saturday)" : "var(--color-text)",
                borderRadius: "50%",
                transform: isSelected ? "scale(1.01)" : "scale(1)",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                fontWeight: isToday || isSelected ? 700 : 400,
                cursor: "pointer",
                position: "relative",
                fontSize: "14px",
              }}
            >
              <span>{dayOfMonth(dateOnly)}</span>
              {hasDot ? (
                <span
                  aria-hidden="true"
                  style={{
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    backgroundColor: isSelected ? "var(--color-bg)" : "var(--color-calendar-dot)",
                    position: "absolute",
                    bottom: "3px",
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    ));
  };

  return (
    <div {...pullToRefresh.bind}>
      <PullToRefreshIndicator
        pullOffset={pullToRefresh.pullOffset}
        progress={pullToRefresh.progress}
        status={pullToRefresh.status}
        refreshingLabel="캘린더 새로고침 중..."
        completeLabel="캘린더 갱신 완료"
      />
      {/* Plan selector bar */}
      {plans.length > 0 && (
        <div data-pull-refresh-trigger="true" style={{ marginBottom: "var(--space-md)" }}>
          <button
            type="button"
            aria-label="플랜 선택 열기"
            aria-haspopup="dialog"
            aria-expanded={planSheetOpen}
            className="btn btn-secondary btn-full"
            onClick={() => {
              setPlanQuery("");
              setPlanSheetOpen(true);
            }}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", border: "1px solid var(--color-border)", borderRadius: "12px", backgroundColor: "var(--color-surface-secondary)", cursor: "pointer" }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "2px" }}>진행 중인 플랜</div>
              <div style={{ font: "var(--font-body)", fontWeight: 600 }}>{selectedPlan?.name ?? "플랜 선택"}</div>
            </div>
            <span aria-hidden="true" style={{ color: "var(--color-text-muted)" }}>
              <svg viewBox="0 0 12 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                <path d="M2 5.5L6 2L10 5.5" />
                <path d="M2 10.5L6 14L10 10.5" />
              </svg>
            </span>
          </button>
        </div>
      )}

      {/* Month navigation header */}
      <div>
      <div
        data-pull-refresh-trigger="true"
        className={monthNavFeedback ? `calendar-month-feedback-${monthNavFeedback}` : undefined}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)" }}
      >
        <div>
          <button
            type="button"
            onClick={() => setMonthPickerOpen(true)}
            aria-label="연도와 월 선택 열기"
            aria-haspopup="dialog"
            aria-expanded={monthPickerOpen}
            style={{ background: "none", border: "none", font: "var(--font-section-title)", cursor: "pointer", display: "flex", alignItems: "center", gap: "var(--space-xs)" }}
          >
            <span>{getYear(anchorDate)}년</span>
            <span>{MONTH_NAMES[getMonth(anchorDate) - 1]}</span>
          </button>
        </div>
        <div style={{ display: "flex", gap: "var(--space-xs)" }}>
          <button
            onClick={() => shiftMonthWithFeedback(-1)}
            aria-label="이전 달"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "var(--space-xs)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: "20px", height: "20px" }}
            >
              <path d="M6 15l6-6 6 6" />
            </svg>
          </button>
          <button
            onClick={() => shiftMonthWithFeedback(1)}
            aria-label="다음 달"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "var(--space-xs)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: "20px", height: "20px" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weekday header row */}
      <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>
        {WEEKDAY_SHORT.map((name) => (
          <div key={name} style={{ padding: "var(--space-xs) 0" }}>
            {name}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div
        role="grid"
        aria-label="날짜 선택"
        className={monthNavFeedback ? `calendar-month-feedback-${monthNavFeedback}` : undefined}
        style={{ marginBottom: "var(--space-md)" }}
      >
        {renderMonthRows(anchorDate, selectedDate)}
      </div>

      </div>{/* /ios-cal-gesture-area */}

      {/* Divider */}
      <div role="separator" />

      {/* Selected date detail panel */}
      <div style={{ marginTop: "var(--space-md)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
          <span style={{ font: "var(--font-section-title)" }}>{formatKoreanDay(selectedDate)}</span>
          {selectedDate === today && <span className="label label-status label-sm">오늘</span>}
        </div>

        {error && <div style={{ color: "var(--color-danger)", marginBottom: "var(--space-sm)", font: "var(--font-secondary)" }}>{error}</div>}

        {loading || selectedLogLoading || selectedSessionLoading ? (
          <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "center", padding: "var(--space-lg)" }}>
            <span />
            <span />
            <span />
          </div>
        ) : !selectedPlan ? (
          <div style={{ padding: "var(--space-lg)", textAlign: "center", color: "var(--color-text-muted)" }}>
            <p>플랜을 선택하면 날짜별 세션을 확인할 수 있습니다.</p>
          </div>
        ) : selectedLog ? (
          <SessionCard
            variant="today"
            title={selectedPlan.name}
            meta={`기록 있음 · ${loggedSummary.totalSets}세트 · ${formatVolume(loggedSummary.totalVolume)}`}
            badge={loggedDayLabel ?? undefined}
            exercises={loggedSummary.exercises}
            ctaLabel="기록수정"
            ctaHref={workoutHref}
          />
        ) : selectedSession ? (
          <SessionCard
            variant="today"
            title={selectedPlan.name}
            meta={`생성됨 · ${new Date(selectedSession.updatedAt).toLocaleDateString("ko-KR")}`}
            badge={selectedSessionWDLabel ?? undefined}
            exercises={plannedExercises}
            ctaLabel={isPastDateCreationBlocked ? undefined : "기록하기"}
            ctaHref={isPastDateCreationBlocked ? undefined : workoutHref}
            ctaNote={isPastDateCreationBlocked ? "자동 진행 플랜은 오늘 이전 날짜에 새 기록을 추가할 수 없습니다." : undefined}
          />
        ) : (
          /* No session yet */
          <div style={{ textAlign: "center", padding: "var(--space-lg)", color: "var(--color-text-muted)" }}>
            <div style={{ marginBottom: "var(--space-md)" }}>
              <div aria-hidden="true" />
              <div>
                {isPastDateCreationBlocked ? null : (
                  <span style={{ display: "block", fontWeight: 600 }}>
                    {selectedCtx?.planned ? (nextSessionLabel ?? "세션 없음") : "즉시 기록 가능"}
                  </span>
                )}
                <span style={{ display: "block", fontSize: "13px", marginTop: "var(--space-xs)" }}>
                  {isPastDateCreationBlocked
                    ? "자동 진행 플랜은 오늘 이전 날짜에 새 기록을 추가할 수 없습니다."
                    : selectedCtx?.planned
                    ? "기록하기를 누르면 이 날짜 세션을 준비하고 바로 기록을 시작합니다."
                    : "기록하기를 누르면 이 날짜 기록 화면으로 바로 이동합니다."}
                </span>
              </div>
            </div>
            {!isPastDateCreationBlocked ? (
              <div>
                <a href={workoutHref} className="btn btn-primary" style={{ display: "inline-flex" }}>
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
      <MonthYearPickerSheet
        open={monthPickerOpen}
        onClose={() => setMonthPickerOpen(false)}
        title="연도와 월 선택"
        year={getYear(anchorDate)}
        month={getMonth(anchorDate)}
        minYear={getYear(today) - 10}
        maxYear={getYear(today) + 10}
        onChange={handleMonthPickerChange}
      />
    </div>
  );
}
