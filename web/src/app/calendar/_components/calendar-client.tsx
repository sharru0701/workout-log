"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";

import { MonthYearPickerSheet } from "@/components/ui/month-year-picker-sheet";
import { SearchSelectSheet } from "@/components/ui/search-select-sheet";
import { apiGet } from "@/lib/api";
import {
  dateOnlyToUtcDate,
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

const WEEKDAY_SHORT_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WEEKDAY_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

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


function formatCalendarDay(dateOnly: string, locale: "ko" | "en") {
  const d = dayOfMonth(dateOnly);
  const dow = getDayOfWeek(dateOnly);
  return locale === "ko" ? `${d}일 ${WEEKDAY_SHORT_KO[dow]}요일` : `${WEEKDAY_SHORT_EN[dow]}, ${d}`;
}

function formatCalendarDateAria(dateOnly: string, locale: "ko" | "en") {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "UTC",
  }).format(dateOnlyToUtcDate(dateOnly));
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

type CalendarClientProps = {
  initialPlans?: Plan[];
  initialSessions?: RecentGeneratedSession[];
  initialLogs?: WorkoutLogSummary[];
  initialTimezone?: string;
  initialToday?: string;
};

export default function CalendarPage({
  initialPlans,
  initialSessions,
  initialLogs,
  initialTimezone,
  initialToday,
}: CalendarClientProps = {}) {
  const { copy, locale } = useLocale();
  // 서버가 타임존을 내려준 경우 우선 사용, 없으면 브라우저에서 읽음 (SSR hydration 안정성 확보)
  const timezone = useMemo(
    () => initialTimezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
    [initialTimezone],
  );
  const today = useMemo(
    () => initialToday ?? dateOnlyInTimezone(new Date(), timezone),
    [initialToday, timezone],
  );

  const [anchorDate, setAnchorDate] = useState(() => initialToday ?? dateOnlyInTimezone(new Date(), timezone));
  const [selectedDate, setSelectedDate] = useState(() => initialToday ?? dateOnlyInTimezone(new Date(), timezone));
  const [plans, setPlans] = useState<Plan[]>(initialPlans ?? []);
  const [planId, setPlanId] = useState(() => initialPlans?.[0]?.id ?? "");
  const [recentSessions, setRecentSessions] = useState<RecentGeneratedSession[]>(initialSessions ?? []);
  const [allPlanLogs, setAllPlanLogs] = useState<WorkoutLogSummary[]>(initialLogs ?? []);
  const [selectedLog, setSelectedLog] = useState<WorkoutLogForDate | null>(null);
  const [selectedLogKey, setSelectedLogKey] = useState("");
  const [selectedLogLoading, setSelectedLogLoading] = useState(false);
  const [completedLogKey, setCompletedLogKey] = useState("");
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<GeneratedSessionDetail | null>(null);
  const [, setSelectedSessionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // PERF: 서버가 초기 데이터를 제공한 경우 loading=false로 시작 (스켈레톤 깜빡임 방지)
  const [loading, setLoading] = useState(initialPlans == null);
  const plansLoadedRef = useRef(initialPlans != null);
  const logFetchCacheRef = useRef<Set<string>>(new Set());
  const sessionDetailCacheRef = useRef<Set<string>>(new Set());
  // PERF: 서버에서 내려온 초기 플랜 ID — 해당 플랜의 초기 세션/로그는 re-fetch 스킵
  const initialPlanId = initialPlans?.[0]?.id ?? "";

  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [planQuery, setPlanQuery] = useState("");
  const [refreshTick, _setRefreshTick] = useState(0);
  const [monthNavFeedback, setMonthNavFeedback] = useState<"" | "prev" | "next">("");
  const monthNavFeedbackTimerRef = useRef<number | null>(null);

  const currentLogKey = planId ? `${planId}|${selectedDate}` : "";
  const currentSelectedLog = selectedLogKey === currentLogKey ? selectedLog : null;

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


  // Load plans
  useEffect(() => {
    // PERF: 서버가 초기 플랜 데이터를 내려준 경우(refreshTick=0) 클라이언트 fetch 스킵
    if (initialPlans != null && refreshTick === 0) return;
    let cancelled = false;
    (async () => {
      try {
        if (!plansLoadedRef.current) setLoading(true);
        const res = await apiGet<{ items: Plan[] }>("/api/plans");
        if (cancelled) return;
        plansLoadedRef.current = true;
        setPlans(res.items);
        setPlanId((prev) => {
          if (prev && res.items.some((p) => p.id === prev)) return prev;
          return res.items[0]?.id ?? "";
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? (locale === "ko" ? "플랜을 불러오지 못했습니다." : "Could not load plans."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, refreshTick]);

  // Load sessions for selected plan
  useEffect(() => {
    if (!planId) {
      setRecentSessions([]);
      return;
    }
    // PERF: 서버가 초기 세션 데이터를 내려준 경우 초기 플랜에 한해 fetch 스킵
    if (initialSessions != null && planId === initialPlanId && refreshTick === 0) return;
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
        if (!cancelled) setError(e?.message ?? (locale === "ko" ? "세션을 불러오지 못했습니다." : "Could not load sessions."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, planId, refreshTick]);

  useEffect(() => {
    if (!planId) {
      setSelectedLog(null);
      setSelectedLogKey("");
      setCompletedLogKey("");
      setSelectedLogLoading(false);
      return;
    }

    let cancelled = false;
    const fetchKey = `${planId}|${selectedDate}`;

    (async () => {
      try {
        if (!logFetchCacheRef.current.has(fetchKey)) setSelectedLogLoading(true);
        setError(null);
        const sp = new URLSearchParams();
        sp.set("planId", planId);
        sp.set("date", selectedDate);
        sp.set("timezone", timezone);
        sp.set("limit", "1");
        sp.set("includeGeneratedSession", "0");
        sp.set("includeProgression", "0");
        const res = await apiGet<{ items: WorkoutLogForDate[] }>(`/api/logs?${sp.toString()}`);
        if (cancelled) return;
        logFetchCacheRef.current.add(fetchKey);
        setSelectedLog(res.items[0] ?? null);
        setSelectedLogKey(fetchKey);
        setCompletedLogKey(fetchKey);
      } catch (e: any) {
        if (!cancelled) {
          setSelectedLog(null);
          setSelectedLogKey(fetchKey);
          setCompletedLogKey(fetchKey);
          setError(e?.message ?? (locale === "ko" ? "운동기록을 불러오지 못했습니다." : "Could not load workout logs."));
        }
      } finally {
        if (!cancelled) setSelectedLogLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale, planId, refreshTick, selectedDate, timezone]);

  // Load all logs for selected plan (used for dot indicators and next session label)
  useEffect(() => {
    if (!planId) {
      setAllPlanLogs([]);
      return;
    }
    // PERF: 서버가 초기 로그 데이터를 내려준 경우 초기 플랜에 한해 fetch 스킵
    if (initialLogs != null && planId === initialPlanId && refreshTick === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const sp = new URLSearchParams();
        sp.set("planId", planId);
        sp.set("limit", "200");
        sp.set("includeSets", "0");
        sp.set("includeGeneratedSession", "0");
        sp.set("includeProgression", "0");
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
    const mode = String(selectedPlan?.params?.sessionKeyMode ?? "").toUpperCase();
    const isAutoProgression = selectedPlan?.params?.autoProgression === true;

    let session: RecentGeneratedSession | null = null;
    if (mode === "DATE") {
      session = generatedByDate.get(dateOnly) ?? null;
    } else {
      const ctx = computePlanContextForDate(selectedPlan, dateOnly);
      if (!ctx) return null;
      session = generatedByKey.get(ctx.sessionKey) ?? null;
    }
    if (!session) return null;

    // If this session was logged on a different date, don't show it here
    const loggedDate = sessionLoggedDateMap.get(session.id);
    if (loggedDate && loggedDate !== dateOnly) return null;

    // For auto-progression plans: hide unlogged sessions when progression has already moved past this date.
    if (!loggedDate && isAutoProgression) {
      const hasLaterLog = Array.from(logDates).some((d) => d > dateOnly);
      if (dateOnly < today || hasLaterLog) return null;
    }

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
    setMonthPickerOpen(false);
  }

  const selectedCtx = useMemo(
    () => computePlanContextForDate(selectedPlan, selectedDate),
    [selectedPlan, selectedDate],
  );
  const selectedSession = getSessionForDate(selectedDate);
  const isAutoProgressionPlan = selectedPlan?.params?.autoProgression === true;
  const isPastDate = selectedDate < today;
  const isPastDateCreationBlocked = isAutoProgressionPlan && isPastDate && !currentSelectedLog;
  const loggedSummary = useMemo(
    () => buildLoggedExercisePreview(currentSelectedLog?.sets ?? []),
    [currentSelectedLog],
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
    if (!currentSelectedLog?.generatedSessionId) return selectedDayLabel;
    return sessionKeyToWDLabel(generatedById.get(currentSelectedLog.generatedSessionId)?.sessionKey ?? "") ?? selectedDayLabel;
  }, [currentSelectedLog, generatedById, selectedDayLabel]);

  // WxDy label for a generated-but-unlogged session
  const selectedSessionWDLabel = useMemo(() => {
    if (!selectedSession) return null;
    return sessionKeyToWDLabel(selectedSession.sessionKey);
  }, [selectedSession]);

  const workoutHref = currentSelectedLog
    ? buildTodayLogHref({ planId, date: selectedDate, logId: currentSelectedLog.id })
    : planId
      ? buildTodayLogHref({ planId, date: selectedDate, autoGenerate: false })
      : APP_ROUTES.todayLog;

  useEffect(() => {
    if (!selectedSession?.id || currentSelectedLog) {
      setSelectedSessionDetail(null);
      setSelectedSessionLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const fetchKey = selectedSession.id;
        if (!sessionDetailCacheRef.current.has(fetchKey)) setSelectedSessionLoading(true);
        const sp = new URLSearchParams();
        sp.set("id", selectedSession.id);
        sp.set("includeSnapshot", "1");
        sp.set("limit", "1");
        if (planId) sp.set("planId", planId);
        const res = await apiGet<{ items: GeneratedSessionDetail[] }>(
          `/api/generated-sessions?${sp.toString()}`,
        );
        if (cancelled) return;
        sessionDetailCacheRef.current.add(fetchKey);
        setSelectedSessionDetail(res.items[0] ?? null);
      } catch (e: any) {
        if (!cancelled) {
          setSelectedSessionDetail(null);
          setError(e?.message ?? (locale === "ko" ? "세션 상세를 불러오지 못했습니다." : "Could not load session details."));
        }
      } finally {
        if (!cancelled) setSelectedSessionLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentSelectedLog, locale, planId, selectedSession?.id]);

  useEffect(
    () => () => {
      if (monthNavFeedbackTimerRef.current === null) return;
      window.clearTimeout(monthNavFeedbackTimerRef.current);
      monthNavFeedbackTimerRef.current = null;
    },
    [],
  );

  // Recent past logs for the "최근 기록" section (excludes today, max 5)
  const recentPastLogs = useMemo(() => {
    return allPlanLogs
      .filter((log) => dateOnlyInTimezone(new Date(log.performedAt), timezone) !== today)
      .slice(0, 5);
  }, [allPlanLogs, timezone, today]);

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

          // Today: light primary tint + border (rect); Selected non-today: filled primary circle
          const cellBg = isToday
            ? "color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-container-low))"
            : isSelected
              ? "var(--color-primary)"
              : "transparent";
          const cellBorder = isToday
            ? "1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)"
            : "none";
          const cellColor = isToday
            ? "var(--color-primary-strong)"
            : isSelected
              ? "var(--color-text-on-primary)"
              : isOutside
                ? "var(--color-text-subtle)"
                : "var(--color-text)";
          const cellRadius = isToday ? "10px" : "50%";
          const dotColor = isSelected
            ? "var(--color-text-on-primary)"
            : "var(--color-calendar-dot)";

          return (
            <button
              key={dateOnly}
              role="gridcell"
              onClick={() => setSelectedDate(dateOnly)}
              aria-label={formatCalendarDateAria(dateOnly, locale)}
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
                border: cellBorder,
                background: cellBg,
                color: cellColor,
                borderRadius: cellRadius,
                transition: "background 0.15s ease, color 0.15s ease",
                fontWeight: isToday || isSelected ? 700 : 400,
                cursor: "pointer",
                position: "relative",
                fontSize: "14px",
                fontFamily: "var(--font-label-family)",
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
                    backgroundColor: dotColor,
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
    <>

      {/* ── Page Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "var(--space-sm)",
          marginBottom: "var(--space-lg)",
        }}
      >
        <h1 style={{
          fontFamily: "var(--font-headline-family)",
          fontSize: "20px",
          fontWeight: 700,
          letterSpacing: "-0.3px",
          color: "var(--color-text)",
          margin: 0,
        }}>
          {copy.calendar.title}
        </h1>
      </div>

      {/* ── Filter Bar ── */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "var(--space-lg)",
        }}
      >
        {/* Month picker chip */}
        <button
          type="button"
          onClick={() => setMonthPickerOpen(true)}
          aria-label={copy.calendar.openYearMonth}
          aria-haspopup="dialog"
          aria-expanded={monthPickerOpen}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexShrink: 0,
            background: "var(--color-surface-container-low)",
            border: "none",
            borderRadius: "12px",
            padding: "8px 14px",
            cursor: "pointer",
            fontFamily: "var(--font-label-family)",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
          }}
        >
          <span>
            {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
              year: "numeric",
              month: "long",
              timeZone: "UTC",
            }).format(dateOnlyToUtcDate(anchorDate))}
          </span>
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>expand_more</span>
        </button>

        {/* Plan selector chip */}
        {selectedPlan && (
          <button
            type="button"
            onClick={() => { setPlanQuery(""); setPlanSheetOpen(true); }}
            aria-label={locale === "ko" ? "플랜 변경" : "Change plan"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "6px",
              flex: 1,
              minWidth: 0,
              background: "var(--color-surface-container-low)",
              border: "none",
              borderRadius: "12px",
              padding: "8px 14px",
              cursor: "pointer",
              fontFamily: "var(--font-label-family)",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              overflow: "hidden",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedPlan.name}</span>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", flexShrink: 0 }}>filter_list</span>
          </button>
        )}
      </div>

      {/* ── Calendar Card ── */}
      <div
        style={{
          background: "var(--color-surface-container-low)",
          borderRadius: "24px",
          padding: "20px 16px",
          marginBottom: "var(--space-lg)",
        }}
      >
        {/* Weekday headers */}
        <div
          aria-hidden="true"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            textAlign: "center",
            marginBottom: "4px",
          }}
        >
          {(locale === "ko" ? WEEKDAY_SHORT_KO : WEEKDAY_SHORT_EN).map((name) => (
            <div
              key={name}
              style={{
                padding: "4px 0",
                fontFamily: "var(--font-label-family)",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
              }}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div
          role="grid"
          aria-label={locale === "ko" ? "날짜 선택" : "Select date"}
          className={monthNavFeedback ? `calendar-month-feedback-${monthNavFeedback}` : undefined}
        >
          {renderMonthRows(anchorDate, selectedDate)}
        </div>

        {/* Month navigation arrows */}
        <div
          className={monthNavFeedback ? `calendar-month-feedback-${monthNavFeedback}` : undefined}
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "4px",
            marginTop: "12px",
          }}
        >
          <button
            onClick={() => shiftMonthWithFeedback(-1)}
            aria-label={locale === "ko" ? "이전 달" : "Previous month"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "30px",
              height: "30px",
              background: "var(--color-surface-container-high)",
              border: "none",
              borderRadius: "50%",
              cursor: "pointer",
              color: "var(--color-text-muted)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_left</span>
          </button>
          <button
            onClick={() => shiftMonthWithFeedback(1)}
            aria-label={locale === "ko" ? "다음 달" : "Next month"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "30px",
              height: "30px",
              background: "var(--color-surface-container-high)",
              border: "none",
              borderRadius: "50%",
              cursor: "pointer",
              color: "var(--color-text-muted)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_right</span>
          </button>
        </div>
      </div>

      {/* ── Selected Date Section ── */}
      <section style={{ marginBottom: "var(--space-xl)" }}>
        {/* Section header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-md)",
        }}>
          <h2 style={{
            fontFamily: "var(--font-headline-family)",
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--color-text)",
            margin: 0,
          }}>
            {selectedDate === today ? (locale === "ko" ? "오늘" : "Today") : formatCalendarDay(selectedDate, locale)}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {selectedPlan && selectedDate !== today && (
              <span style={{
                fontFamily: "var(--font-label-family)",
                fontSize: "11px",
                color: "var(--color-text-muted)",
                maxWidth: "120px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {selectedPlan.name}
              </span>
            )}
            {selectedDate === today && (
              <span style={{
                fontFamily: "var(--font-label-family)",
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--color-text-on-primary)",
                background: "var(--color-primary)",
                padding: "4px 12px",
                borderRadius: "20px",
                letterSpacing: "0.04em",
              }}>
                {locale === "ko" ? "오늘" : "Today"}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div style={{
            color: "var(--color-danger)",
            marginBottom: "var(--space-sm)",
            fontFamily: "var(--font-label-family)",
            fontSize: "13px",
          }}>
            {error}
          </div>
        )}

        {loading || selectedLogLoading || (!!planId && completedLogKey !== currentLogKey) ? (
          <div style={{
            display: "flex",
            gap: "6px",
            justifyContent: "center",
            padding: "var(--space-xl)",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-outline-variant)", display: "inline-block" }} />
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-outline-variant)", display: "inline-block" }} />
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-outline-variant)", display: "inline-block" }} />
          </div>
        ) : !selectedPlan ? (
          <div style={{
            padding: "var(--space-xl)",
            textAlign: "center",
            background: "var(--color-surface-container-low)",
            borderRadius: "20px",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "var(--color-text-muted)", display: "block", marginBottom: "8px" }}>calendar_month</span>
            <p style={{
              fontFamily: "var(--font-label-family)",
              fontSize: "13px",
              color: "var(--color-text-muted)",
              margin: 0,
            }}>
              {copy.calendarMain.noPlanSelected}
            </p>
          </div>
        ) : currentSelectedLog ? (
          /* ── Logged session card ── */
          <div style={{ background: "var(--color-surface-container-low)", borderRadius: "24px", padding: "24px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "var(--color-success-weak)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--color-success)", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-headline-family)", fontSize: "15px", fontWeight: 700, color: "var(--color-text)" }}>
                    {selectedPlan.name}
                  </div>
                  <div style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginTop: "2px" }}>
                    {copy.calendarMain.completed}
                  </div>
                </div>
              </div>
              {loggedDayLabel && (
                <span style={{
                  fontFamily: "var(--font-label-family)", fontSize: "11px", fontWeight: 700,
                  color: "var(--color-primary)", background: "var(--color-primary-weak)",
                  padding: "4px 10px", borderRadius: "20px", flexShrink: 0,
                  border: "1px solid color-mix(in srgb, var(--color-primary) 28%, transparent)",
                }}>
                  {loggedDayLabel}
                </span>
              )}
            </div>

            {/* Exercise list */}
            {loggedSummary.exercises.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {loggedSummary.exercises.map((ex) => (
                  <div key={ex.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-headline-family)", fontSize: "14px", fontWeight: 700, color: "var(--color-text)" }}>{ex.name}</span>
                    <span style={{ fontFamily: "var(--font-label-family)", fontSize: "13px", color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>{ex.summary}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Stats row */}
            <div style={{ display: "flex", gap: "32px", borderTop: "1px solid var(--color-outline-variant)", paddingTop: "16px", marginBottom: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>{copy.calendarMain.sets}</span>
                <span style={{ fontFamily: "var(--font-label-family)", fontSize: "18px", fontWeight: 700, color: "var(--color-text)" }}>{loggedSummary.totalSets}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>{copy.calendarMain.volume}</span>
                <span style={{ fontFamily: "var(--font-label-family)", fontSize: "18px", fontWeight: 700, color: "var(--color-text)" }}>{formatVolume(loggedSummary.totalVolume)}</span>
              </div>
            </div>

            {/* CTA */}
            <a
              href={workoutHref}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                padding: "14px 20px", borderRadius: "14px",
                background: "var(--color-primary)", color: "var(--color-text-on-primary)",
                textDecoration: "none", fontFamily: "var(--font-headline-family)",
                fontSize: "15px", fontWeight: 700,
              }}
            >
              {copy.calendarMain.editLog}
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_right</span>
            </a>
          </div>
        ) : selectedSession ? (
          /* ── Planned session card ── */
          isPastDateCreationBlocked ? (
            <div style={{ padding: "24px 20px", borderRadius: "20px", background: "var(--color-surface-container-low)", textAlign: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "var(--color-text-muted)", display: "block", marginBottom: "10px" }}>block</span>
              <div style={{ fontFamily: "var(--font-headline-family)", fontSize: "14px", fontWeight: 700, color: "var(--color-text)", marginBottom: "6px" }}>{copy.calendarMain.blockedTitle}</div>
              <div style={{ fontFamily: "var(--font-label-family)", fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                {copy.calendarMain.blockedDescription}
              </div>
            </div>
          ) : (
            <div style={{ background: "var(--color-surface-container-low)", borderRadius: "24px", padding: "24px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: plannedExercises.length > 0 ? "16px" : "0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "50%",
                    background: "var(--color-primary-weak)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--color-primary)" }}>fitness_center</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-headline-family)", fontSize: "15px", fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {selectedPlan.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                      <span style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{copy.calendarMain.beforeStart}</span>
                      {selectedSessionWDLabel && (
                        <span style={{ fontFamily: "var(--font-label-family)", fontSize: "11px", fontWeight: 700, color: "var(--color-primary)", background: "var(--color-primary-weak)", padding: "2px 8px", borderRadius: "20px" }}>
                          {selectedSessionWDLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <a
                  href={workoutHref}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    padding: "10px 18px", borderRadius: "12px", flexShrink: 0, marginLeft: "12px",
                    background: "var(--color-primary)", color: "var(--color-text-on-primary)",
                    textDecoration: "none", fontFamily: "var(--font-headline-family)",
                    fontSize: "14px", fontWeight: 700,
                  }}
                >
                  {copy.calendarMain.startLogging}
                </a>
              </div>

              {/* Planned exercises */}
              {plannedExercises.length > 0 && (
                <div style={{ borderTop: "1px solid var(--color-outline-variant)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {plannedExercises.filter((ex) => ex.role === "MAIN").map((ex) => (
                    <div key={ex.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--font-headline-family)", fontSize: "14px", fontWeight: 700, color: "var(--color-text)" }}>{ex.name}</span>
                      <span style={{ fontFamily: "var(--font-label-family)", fontSize: "13px", color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>{ex.summary}</span>
                    </div>
                  ))}
                  {plannedExercises.filter((ex) => ex.role !== "MAIN").length > 0 && (
                    <div style={{ borderTop: "1px dashed var(--color-outline-variant)", paddingTop: "8px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {plannedExercises.filter((ex) => ex.role !== "MAIN").slice(0, 3).map((ex) => (
                        <div key={ex.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontFamily: "var(--font-label-family)", fontSize: "13px", color: "var(--color-text-muted)" }}>{ex.name}</span>
                          <span style={{ fontFamily: "var(--font-label-family)", fontSize: "13px", color: "var(--color-text-subtle)", fontVariantNumeric: "tabular-nums" }}>{ex.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          <div style={{
            padding: "24px 20px",
            borderRadius: "20px",
            background: "var(--color-surface-container-low)",
            textAlign: "center",
          }}>
            {isPastDateCreationBlocked ? (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "var(--color-text-muted)", display: "block", marginBottom: "10px" }}>block</span>
                <div style={{
                  fontFamily: "var(--font-headline-family)",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  marginBottom: "6px",
                }}>
                  {copy.calendarMain.blockedTitle}
                </div>
                <div style={{
                  fontFamily: "var(--font-label-family)",
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                  lineHeight: 1.5,
                }}>
                  {copy.calendarMain.blockedDescription}
                </div>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "var(--color-primary)", display: "block", marginBottom: "10px" }}>fitness_center</span>
                <div style={{
                  fontFamily: "var(--font-headline-family)",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  marginBottom: "6px",
                }}>
                  {selectedCtx?.planned ? (nextSessionLabel ?? copy.calendarMain.noSession) : copy.calendarMain.canLogImmediately}
                </div>
                <div style={{
                  fontFamily: "var(--font-label-family)",
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                  marginBottom: "18px",
                  lineHeight: 1.5,
                }}>
                  {selectedCtx?.planned
                    ? copy.calendarMain.plannedDescription
                    : copy.calendarMain.immediateDescription}
                </div>
                <a
                  href={workoutHref}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 22px",
                    borderRadius: "12px",
                    background: "var(--color-primary)",
                    color: "var(--color-text-on-primary)",
                    textDecoration: "none",
                    fontFamily: "var(--font-label-family)",
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
                  {copy.calendarMain.startLogging}
                </a>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── Recent Past Sessions ── */}
      {recentPastLogs.length > 0 && (
        <section style={{ marginBottom: "var(--space-xl)" }}>
          <h2 style={{
            fontFamily: "var(--font-headline-family)",
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--color-text)",
            margin: 0,
            marginBottom: "var(--space-md)",
          }}>
            {copy.calendarMain.recentLogs}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {recentPastLogs.map((log) => {
              const logDate = dateOnlyInTimezone(new Date(log.performedAt), timezone);
              const sessionLabel = log.generatedSessionId
                ? (sessionKeyToWDLabel(generatedById.get(log.generatedSessionId)?.sessionKey ?? "") ?? null)
                : null;
              return (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => {
                    setAnchorDate(logDate);
                    setSelectedDate(logDate);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "var(--color-surface-container-low)",
                    border: "none",
                    borderRadius: "20px",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "var(--color-success-weak)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "18px", color: "var(--color-success)", fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                    </div>
                    <div>
                      <div style={{
                        fontFamily: "var(--font-headline-family)",
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "var(--color-text)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}>
                        {selectedPlan?.name ?? (locale === "ko" ? "기록" : "Log")}
                        {sessionLabel && (
                          <span style={{
                            fontFamily: "var(--font-label-family)",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "var(--color-text-muted)",
                            background: "var(--color-surface-container-high)",
                            padding: "2px 8px",
                            borderRadius: "20px",
                          }}>
                            {sessionLabel}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontFamily: "var(--font-label-family)",
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--color-text-muted)",
                        marginTop: "2px",
                      }}>
                        {formatCalendarDay(logDate, locale)}
                      </div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--color-text-subtle)", flexShrink: 0 }}>
                    chevron_right
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <SearchSelectSheet
        open={planSheetOpen}
        title={copy.calendar.planSheetTitle}
        description={copy.calendar.planSheetDescription}
        onClose={() => {
          setPlanSheetOpen(false);
          setPlanQuery("");
        }}
        closeLabel={copy.calendar.close}
        query={planQuery}
        placeholder={copy.calendar.planSearchPlaceholder}
        onQueryChange={setPlanQuery}
        onQuerySubmit={() => {
          const first = filteredPlans[0] ?? null;
          if (!first) return;
          setPlanId(first.id);
          setPlanSheetOpen(false);
          setPlanQuery("");
        }}
        resultsAriaLabel={copy.calendar.planSearchResults}
        emptyText={copy.calendar.noMatchingPlans}
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
        title={copy.calendar.monthPickerTitle}
        year={getYear(anchorDate)}
        month={getMonth(anchorDate)}
        minYear={getYear(today) - 10}
        maxYear={getYear(today) + 10}
        onChange={handleMonthPickerChange}
      />
    </>
  );
}
