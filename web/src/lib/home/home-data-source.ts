import { apiGet, apiPost } from "@/lib/api";
import { buildTodayLogHref, toLocalDateKey } from "@/lib/workout-links";

// ─── Types ──────────────────────────────────────────────────────────

export type HomeTodayExercise = {
  name: string;
  role: "MAIN" | "ASSIST" | string;
  totalSets: number;
  summary: string; // e.g. "3x5 @ 110kg"
};

export type HomeTodaySummary = {
  headline: string;
  programName: string;
  meta: string;
  completedSets: number;
  href: string;
  loggedExercises: HomeTodayLoggedExercise[];
  plannedExercises: HomeTodayExercise[];
  totalPlannedSets: number;
};

export type HomeTodayLoggedExercise = {
  name: string;
  bestSet: string;
};

export type HomeRecentSession = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  href: string;
};

export type HomePlanOverview = {
  totalPlans: number;
  highlightedPlanId: string | null;
  highlightedPlanName: string | null;
  highlightedProgramName: string | null;
  lastPerformedAtLabel: string | null;
};

export type HomeWeeklyDay = {
  key: string;
  shortLabel: string;
  dateLabel: string;
  hasWorkout: boolean;
  isToday: boolean;
};

export type HomeWeeklySummary = {
  activeDays: number;
  restDays: number;
  sessionCount: number;
  completedSets: number;
  days: HomeWeeklyDay[];
};

export type HomeLastSessionExercise = {
  name: string;
  sets: number;
  bestSet: string;
  weightDelta: number | null; // compared to today's planned weight
};

export type HomeLastSession = {
  id: string;
  planName: string;
  date: string;
  totalSets: number;
  totalVolume: number;
  exercises: HomeLastSessionExercise[];
  href: string;
};

export type HomeStrengthItem = {
  exerciseName: string;
  exerciseId: string | null;
  bestE1rm: number;
  latestE1rm: number;
  improvement: number;
  trend: "up" | "down" | "flat";
};

export type HomeVolumeTrendPoint = {
  period: string;
  label: string;
  tonnage: number;
  sets: number;
  reps: number;
};

export type HomeQuickStats = {
  totalSessions: number;
  totalVolume: number;
  currentStreak: number;
  thisMonthSessions: number;
};

export type HomeData = {
  today: HomeTodaySummary;
  planOverview: HomePlanOverview;
  weeklySummary: HomeWeeklySummary;
  recentLimit: number;
  recentSessions: HomeRecentSession[];
  lastSession: HomeLastSession | null;
  strengthProgress: HomeStrengthItem[];
  volumeTrend: HomeVolumeTrendPoint[];
  quickStats: HomeQuickStats;
};

export interface HomeDataSource {
  load(): Promise<HomeData>;
}

// ─── Internal types ─────────────────────────────────────────────────

type PlanItem = {
  id: string;
  name: string;
  createdAt: string;
  baseProgramName?: string | null;
  lastPerformedAt?: string | null;
};

type WorkoutSetItem = {
  exerciseName: string;
  reps: number | null;
  weightKg: number | null;
};

type WorkoutLogItem = {
  id: string;
  planId: string | null;
  performedAt: string;
  sets: WorkoutSetItem[];
};

type PrApiItem = {
  exerciseId: string | null;
  exerciseName: string;
  best: { date: string; e1rm: number; weightKg: number; reps: number };
  latest: { date: string; e1rm: number; weightKg: number; reps: number };
  improvement: number;
};

type VolumeSeriesPoint = {
  period: string;
  tonnage: number;
  reps: number;
  sets: number;
};

type SnapshotSet = {
  reps?: number;
  targetWeightKg?: number;
  percent?: number;
  rpe?: number;
  note?: string;
};

type SnapshotExercise = {
  exerciseId?: string | null;
  exerciseName: string;
  role: "MAIN" | "ASSIST" | string;
  sets: SnapshotSet[];
  sourceBlockTarget?: string;
  progressionTarget?: string | null;
};

type GenerateSessionResponse = {
  session: {
    id: string;
    sessionKey: string;
    snapshot: {
      schemaVersion: number;
      exercises: SnapshotExercise[];
      week?: number;
      day?: number;
    } | null;
  };
};

// ─── Constants ──────────────────────────────────────────────────────

const DEFAULT_RECENT_LIMIT = 3;
const WEEKLY_WINDOW_DAYS = 7;

// ─── Helpers ────────────────────────────────────────────────────────

function parseDateKey(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return toLocalDateKey(parsed);
}

function formatDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "날짜 미상";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(parsed);
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatWeekdayShort(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
  }).format(date);
}

function formatWeekLabel(period: string) {
  const date = new Date(period);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function resolveHighlightedPlan(plans: PlanItem[], latestTodayLog: WorkoutLogItem | null) {
  const planFromToday = latestTodayLog?.planId ? plans.find((entry) => entry.id === latestTodayLog.planId) ?? null : null;
  const planByLastPerformed = [...plans]
    .filter((entry) => entry.lastPerformedAt)
    .sort((a, b) => {
      const aValue = new Date(a.lastPerformedAt ?? 0).getTime();
      const bValue = new Date(b.lastPerformedAt ?? 0).getTime();
      return bValue - aValue;
    })[0];
  const fallbackPlan =
    [...plans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  return planFromToday ?? planByLastPerformed ?? fallbackPlan;
}

// ─── Builders ───────────────────────────────────────────────────────

function buildPlanOverview(plans: PlanItem[], latestTodayLog: WorkoutLogItem | null): HomePlanOverview {
  if (plans.length === 0) {
    return {
      totalPlans: 0,
      highlightedPlanId: null,
      highlightedPlanName: null,
      highlightedProgramName: null,
      lastPerformedAtLabel: null,
    };
  }

  const highlightedPlan = resolveHighlightedPlan(plans, latestTodayLog);

  if (!highlightedPlan) {
    return {
      totalPlans: plans.length,
      highlightedPlanId: null,
      highlightedPlanName: null,
      highlightedProgramName: null,
      lastPerformedAtLabel: null,
    };
  }

  return {
    totalPlans: plans.length,
    highlightedPlanId: highlightedPlan.id,
    highlightedPlanName: highlightedPlan.name,
    highlightedProgramName: highlightedPlan.baseProgramName ?? null,
    lastPerformedAtLabel: highlightedPlan.lastPerformedAt ? formatDate(highlightedPlan.lastPerformedAt) : null,
  };
}

function buildWeeklySummary(logs: WorkoutLogItem[]): HomeWeeklySummary {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toLocalDateKey(today);
  const days: HomeWeeklyDay[] = [];

  for (let offset = WEEKLY_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = toLocalDateKey(day);
    days.push({
      key,
      shortLabel: formatWeekdayShort(day),
      dateLabel: formatMonthDay(day),
      hasWorkout: false,
      isToday: key === todayKey,
    });
  }

  const weeklyKeySet = new Set(days.map((entry) => entry.key));
  const workoutCountByDay = new Map<string, number>();
  let sessionCount = 0;
  let completedSets = 0;

  for (const log of logs) {
    const key = parseDateKey(log.performedAt);
    if (!weeklyKeySet.has(key)) continue;
    sessionCount += 1;
    completedSets += log.sets.length;
    workoutCountByDay.set(key, (workoutCountByDay.get(key) ?? 0) + 1);
  }

  const resolvedDays = days.map((entry) => ({
    ...entry,
    hasWorkout: (workoutCountByDay.get(entry.key) ?? 0) > 0,
  }));
  const activeDays = resolvedDays.filter((entry) => entry.hasWorkout).length;

  return {
    activeDays,
    restDays: WEEKLY_WINDOW_DAYS - activeDays,
    sessionCount,
    completedSets,
    days: resolvedDays,
  };
}

function buildPlannedExercises(snapshot: GenerateSessionResponse["session"]["snapshot"]): {
  exercises: HomeTodayExercise[];
  totalSets: number;
  plannedWeightByExercise: Map<string, number>;
} {
  const empty = { exercises: [], totalSets: 0, plannedWeightByExercise: new Map<string, number>() };
  if (!snapshot?.exercises) return empty;

  let totalSets = 0;
  const plannedWeightByExercise = new Map<string, number>();
  const exercises: HomeTodayExercise[] = [];

  for (const ex of snapshot.exercises) {
    const sets = ex.sets ?? [];
    totalSets += sets.length;

    // Find max target weight for this exercise
    let maxWeight = 0;
    for (const s of sets) {
      if (s.targetWeightKg && s.targetWeightKg > maxWeight) {
        maxWeight = s.targetWeightKg;
      }
    }
    if (maxWeight > 0) {
      const key = ex.exerciseName.toLowerCase();
      const existing = plannedWeightByExercise.get(key);
      if (!existing || maxWeight > existing) {
        plannedWeightByExercise.set(key, maxWeight);
      }
    }

    // Build summary string
    const summary = summarizeSets(sets);

    exercises.push({
      name: ex.exerciseName,
      role: ex.role,
      totalSets: sets.length,
      summary,
    });
  }

  return { exercises, totalSets, plannedWeightByExercise };
}

function summarizeSets(sets: SnapshotSet[]): string {
  if (sets.length === 0) return "";

  // Group consecutive sets with same reps/weight
  const groups: Array<{ reps: number; weight: number; count: number }> = [];
  for (const s of sets) {
    const reps = s.reps ?? 0;
    const weight = s.targetWeightKg ?? 0;
    const last = groups[groups.length - 1];
    if (last && last.reps === reps && last.weight === weight) {
      last.count += 1;
    } else {
      groups.push({ reps, weight, count: 1 });
    }
  }

  // If all sets are the same pattern
  if (groups.length === 1) {
    const g = groups[0];
    const weightStr = g.weight > 0 ? ` @ ${g.weight}kg` : "";
    return `${g.count}x${g.reps}${weightStr}`;
  }

  // Multiple patterns: show count x reps for each, with weight range
  const maxWeight = Math.max(...groups.map((g) => g.weight));
  const parts = groups.map((g) => `${g.count}x${g.reps}`);
  const weightStr = maxWeight > 0 ? ` (max ${maxWeight}kg)` : "";
  return parts.join(", ") + weightStr;
}

function groupLoggedExercises(sets: WorkoutSetItem[]): Array<{
  name: string;
  sets: number;
  bestWeight: number;
  bestReps: number;
}> {
  const grouped = new Map<string, { sets: number; bestWeight: number; bestReps: number }>();

  for (const set of sets) {
    const name = String(set.exerciseName ?? "").trim();
    if (!name) continue;

    const weight = Number(set.weightKg ?? 0);
    const reps = Number(set.reps ?? 0);
    const current = grouped.get(name);

    if (!current) {
      grouped.set(name, { sets: 1, bestWeight: weight, bestReps: reps });
      continue;
    }

    current.sets += 1;
    if (weight > current.bestWeight || (weight === current.bestWeight && reps > current.bestReps)) {
      current.bestWeight = weight;
      current.bestReps = reps;
    }
  }

  return Array.from(grouped.entries()).map(([name, data]) => ({
    name,
    sets: data.sets,
    bestWeight: data.bestWeight,
    bestReps: data.bestReps,
  }));
}

function formatLoggedBestSet(sets: number, bestReps: number, bestWeight: number) {
  return bestWeight > 0 ? `${sets}x${bestReps} @ ${bestWeight}kg` : `${sets}x${bestReps}`;
}

function buildTodaySummary(
  plans: PlanItem[],
  logs: WorkoutLogItem[],
  plannedExercises: HomeTodayExercise[],
  totalPlannedSets: number,
): HomeTodaySummary {
  const nowKey = toLocalDateKey(new Date());
  const plansById = new Map(plans.map((entry) => [entry.id, entry.name]));
  const todayLogs = logs.filter((entry) => parseDateKey(entry.performedAt) === nowKey);
  const todaySets = todayLogs.flatMap((entry) => entry.sets);

  const completedSets = todaySets.length;
  const todayLogCount = todayLogs.length;
  const latestToday = todayLogs[0] ?? null;
  const loggedExercises = groupLoggedExercises(todaySets).map((exercise) => ({
    name: exercise.name,
    bestSet: formatLoggedBestSet(exercise.sets, exercise.bestReps, exercise.bestWeight),
  }));
  const highlightedPlan = resolveHighlightedPlan(plans, latestToday);
  const selectedProgramName = latestToday?.planId
    ? plansById.get(latestToday.planId) ?? "선택된 프로그램"
    : highlightedPlan?.name ?? "플랜 준비 필요";

  const activePlanId = latestToday?.planId ?? highlightedPlan?.id ?? null;

  let meta: string;
  if (!activePlanId) {
    meta = "오늘 운동은 플랜 기반으로 동작합니다. 먼저 프로그램을 선택하거나 커스텀 프로그램을 만드세요.";
  } else if (todayLogCount > 0) {
    meta = `오늘 ${todayLogCount}개 세션 / ${completedSets}세트 완료`;
  } else if (plannedExercises.length > 0) {
    const mainExercises = plannedExercises.filter((e) => e.role === "MAIN");
    const mainNames = mainExercises.slice(0, 3).map((e) => e.name);
    meta = mainNames.length > 0
      ? `${mainNames.join(", ")} 외 ${totalPlannedSets}세트`
      : `${totalPlannedSets}세트 예정`;
  } else {
    meta = "준비된 플랜으로 오늘 세션을 생성하고 기록을 시작합니다.";
  }

  return {
    headline: "오늘의 운동 요약",
    programName: selectedProgramName,
    meta,
    completedSets,
    href: activePlanId
      ? buildTodayLogHref({
          planId: activePlanId,
          date: nowKey,
          autoGenerate: todayLogCount === 0,
        })
      : "/program-store",
    loggedExercises,
    plannedExercises,
    totalPlannedSets: totalPlannedSets,
  };
}

function buildRecentSessions(plans: PlanItem[], logs: WorkoutLogItem[], recentLimit: number): HomeRecentSession[] {
  const nowKey = toLocalDateKey(new Date());
  const plansById = new Map(plans.map((entry) => [entry.id, entry.name]));

  return logs
    .filter((entry) => parseDateKey(entry.performedAt) !== nowKey)
    .slice(0, recentLimit)
    .map((entry) => {
      const planName = entry.planId ? plansById.get(entry.planId) ?? "프로그램 미지정" : "프로그램 미지정";
      const primaryExercise = entry.sets[0]?.exerciseName ?? "운동 정보 없음";
      const setCount = entry.sets.length;
      return {
        id: entry.id,
        title: planName,
        subtitle: formatDate(entry.performedAt),
        description: `${setCount}세트 / 대표 운동: ${primaryExercise}`,
        href: `/workout-record?context=recent&logId=${encodeURIComponent(entry.id)}`,
      };
    });
}

function buildLastSession(
  plans: PlanItem[],
  logs: WorkoutLogItem[],
  plannedWeightByExercise: Map<string, number>,
): HomeLastSession | null {
  const nowKey = toLocalDateKey(new Date());
  const plansById = new Map(plans.map((entry) => [entry.id, entry.name]));

  const lastLog = logs.find((entry) => parseDateKey(entry.performedAt) !== nowKey);
  if (!lastLog) return null;

  const planName = lastLog.planId ? plansById.get(lastLog.planId) ?? "프로그램 미지정" : "프로그램 미지정";
  const totalSets = lastLog.sets.length;

  let totalVolume = 0;
  for (const set of lastLog.sets) {
    const w = set.weightKg ?? 0;
    const r = set.reps ?? 0;
    totalVolume += w * r;
  }

  const exercises: HomeLastSessionExercise[] = groupLoggedExercises(lastLog.sets).map((data) => {
    // Compute weight delta vs today's planned weight
    let weightDelta: number | null = null;
    const plannedWeight = plannedWeightByExercise.get(data.name.toLowerCase());
    if (plannedWeight !== undefined && data.bestWeight > 0) {
      weightDelta = plannedWeight - data.bestWeight;
    }

    return {
      name: data.name,
      sets: data.sets,
      bestSet: formatLoggedBestSet(data.sets, data.bestReps, data.bestWeight),
      weightDelta,
    };
  });

  return {
    id: lastLog.id,
    planName,
    date: formatDate(lastLog.performedAt),
    totalSets,
    totalVolume: Math.round(totalVolume),
    exercises,
    href: `/workout-record?context=recent&logId=${encodeURIComponent(lastLog.id)}`,
  };
}

function buildStrengthProgress(prItems: PrApiItem[]): HomeStrengthItem[] {
  return prItems.slice(0, 4).map((item) => {
    const threshold = 1;
    let trend: "up" | "down" | "flat" = "flat";
    if (item.improvement > threshold) trend = "up";
    else if (item.improvement < -threshold) trend = "down";

    return {
      exerciseName: item.exerciseName,
      exerciseId: item.exerciseId,
      bestE1rm: Math.round(item.best.e1rm),
      latestE1rm: Math.round(item.latest.e1rm),
      improvement: Math.round(item.improvement),
      trend,
    };
  });
}

function buildVolumeTrend(series: VolumeSeriesPoint[]): HomeVolumeTrendPoint[] {
  return series.map((point) => ({
    period: point.period,
    label: formatWeekLabel(point.period),
    tonnage: Math.round(point.tonnage),
    sets: Number(point.sets ?? 0),
    reps: Number(point.reps ?? 0),
  }));
}

function buildQuickStats(logs: WorkoutLogItem[]): HomeQuickStats {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const totalSessions = logs.length;
  let totalVolume = 0;
  let thisMonthSessions = 0;

  for (const log of logs) {
    for (const set of log.sets) {
      totalVolume += (set.weightKg ?? 0) * (set.reps ?? 0);
    }
    const logDate = new Date(log.performedAt);
    if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
      thisMonthSessions += 1;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const logDateKeys = new Set(logs.map((l) => parseDateKey(l.performedAt)));
  let streak = 0;
  const checkDate = new Date(today);

  const todayKey = toLocalDateKey(today);
  if (!logDateKeys.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const key = toLocalDateKey(checkDate);
    if (logDateKeys.has(key)) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    totalSessions,
    totalVolume: Math.round(totalVolume),
    currentStreak: streak,
    thisMonthSessions,
  };
}

function buildHomeData(
  plans: PlanItem[],
  logs: WorkoutLogItem[],
  prItems: PrApiItem[],
  volumeSeries: VolumeSeriesPoint[],
  snapshot: GenerateSessionResponse["session"]["snapshot"] | null,
  recentLimit = DEFAULT_RECENT_LIMIT,
): HomeData {
  const todayKey = toLocalDateKey(new Date());
  const latestTodayLog = logs.find((entry) => parseDateKey(entry.performedAt) === todayKey) ?? null;

  const { exercises: plannedExercises, totalSets: totalPlannedSets, plannedWeightByExercise } =
    buildPlannedExercises(snapshot);

  return {
    today: buildTodaySummary(plans, logs, plannedExercises, totalPlannedSets),
    planOverview: buildPlanOverview(plans, latestTodayLog),
    weeklySummary: buildWeeklySummary(logs),
    recentLimit,
    recentSessions: buildRecentSessions(plans, logs, recentLimit),
    lastSession: buildLastSession(plans, logs, plannedWeightByExercise),
    strengthProgress: buildStrengthProgress(prItems),
    volumeTrend: buildVolumeTrend(volumeSeries),
    quickStats: buildQuickStats(logs),
  };
}

// ─── Preview Data ───────────────────────────────────────────────────

export const HOME_PREVIEW_DATA: HomeData = {
  today: {
    headline: "오늘의 운동 요약",
    programName: "5/3/1 BBB",
    meta: "Back Squat, Bench Press 외 16세트",
    completedSets: 0,
    href: "/workout-record?planId=preview-plan-531&date=2026-03-03",
    loggedExercises: [],
    plannedExercises: [
      { name: "Back Squat", role: "MAIN", totalSets: 3, summary: "3x5 @ 110kg" },
      { name: "Bench Press", role: "MAIN", totalSets: 3, summary: "3x5 @ 80kg" },
      { name: "Back Squat (BBB)", role: "ASSIST", totalSets: 5, summary: "5x10 @ 65kg" },
      { name: "Dumbbell Row", role: "ASSIST", totalSets: 5, summary: "5x10 @ 30kg" },
    ],
    totalPlannedSets: 16,
  },
  planOverview: {
    totalPlans: 3,
    highlightedPlanId: "preview-plan-531",
    highlightedPlanName: "5/3/1 BBB",
    highlightedProgramName: "5/3/1",
    lastPerformedAtLabel: "3월 2일 (월)",
  },
  weeklySummary: {
    activeDays: 4,
    restDays: 3,
    sessionCount: 5,
    completedSets: 62,
    days: [
      { key: "2026-02-25", shortLabel: "수", dateLabel: "2월 25일", hasWorkout: true, isToday: false },
      { key: "2026-02-26", shortLabel: "목", dateLabel: "2월 26일", hasWorkout: false, isToday: false },
      { key: "2026-02-27", shortLabel: "금", dateLabel: "2월 27일", hasWorkout: true, isToday: false },
      { key: "2026-02-28", shortLabel: "토", dateLabel: "2월 28일", hasWorkout: true, isToday: false },
      { key: "2026-03-01", shortLabel: "일", dateLabel: "3월 1일", hasWorkout: false, isToday: false },
      { key: "2026-03-02", shortLabel: "월", dateLabel: "3월 2일", hasWorkout: true, isToday: false },
      { key: "2026-03-03", shortLabel: "화", dateLabel: "3월 3일", hasWorkout: true, isToday: true },
    ],
  },
  recentLimit: DEFAULT_RECENT_LIMIT,
  recentSessions: [
    { id: "preview-1", title: "5/3/1 BBB", subtitle: "3월 2일 (월)", description: "16세트 / 대표 운동: Back Squat", href: "/workout-record?context=recent&logId=preview-1" },
    { id: "preview-2", title: "My A/B Strength", subtitle: "3월 1일 (일)", description: "12세트 / 대표 운동: Deadlift", href: "/workout-record?context=recent&logId=preview-2" },
    { id: "preview-3", title: "StrongLifts 5x5", subtitle: "2월 28일 (토)", description: "15세트 / 대표 운동: Bench Press", href: "/workout-record?context=recent&logId=preview-3" },
  ],
  lastSession: {
    id: "preview-1",
    planName: "5/3/1 BBB",
    date: "3월 2일 (월)",
    totalSets: 16,
    totalVolume: 8450,
    exercises: [
      { name: "Back Squat", sets: 8, bestSet: "8x3 @ 120kg", weightDelta: -10 },
      { name: "Leg Press", sets: 5, bestSet: "5x10 @ 180kg", weightDelta: null },
      { name: "Leg Curl", sets: 3, bestSet: "3x12 @ 40kg", weightDelta: null },
    ],
    href: "/workout-record?context=recent&logId=preview-1",
  },
  strengthProgress: [
    { exerciseName: "Back Squat", exerciseId: "ex-squat", bestE1rm: 145, latestE1rm: 140, improvement: 12, trend: "up" },
    { exerciseName: "Bench Press", exerciseId: "ex-bench", bestE1rm: 105, latestE1rm: 105, improvement: 8, trend: "up" },
    { exerciseName: "Deadlift", exerciseId: "ex-dl", bestE1rm: 180, latestE1rm: 175, improvement: 15, trend: "up" },
    { exerciseName: "Overhead Press", exerciseId: "ex-ohp", bestE1rm: 68, latestE1rm: 68, improvement: 0, trend: "flat" },
  ],
  volumeTrend: [
    { period: "2026-02-10", label: "2월 10일", tonnage: 18200, sets: 48, reps: 320 },
    { period: "2026-02-17", label: "2월 17일", tonnage: 21500, sets: 56, reps: 385 },
    { period: "2026-02-24", label: "2월 24일", tonnage: 19800, sets: 52, reps: 350 },
    { period: "2026-03-03", label: "3월 3일", tonnage: 22100, sets: 58, reps: 400 },
  ],
  quickStats: {
    totalSessions: 47,
    totalVolume: 312500,
    currentStreak: 3,
    thisMonthSessions: 5,
  },
};

// ─── Data Sources ───────────────────────────────────────────────────

export class PreviewHomeDataSource implements HomeDataSource {
  constructor(private readonly previewData: HomeData = HOME_PREVIEW_DATA) {}

  async load(): Promise<HomeData> {
    return this.previewData;
  }
}

export class ApiHomeDataSource implements HomeDataSource {
  constructor(private readonly recentLimit = DEFAULT_RECENT_LIMIT) {}

  async load(): Promise<HomeData> {
    const [plansRes, logsRes, prsRes, volumeSeriesRes] = await Promise.all([
      apiGet<{ items: PlanItem[] }>("/api/plans"),
      apiGet<{ items: WorkoutLogItem[] }>(`/api/logs?limit=${Math.max(this.recentLimit + 14, 40)}`),
      apiGet<{ items: PrApiItem[] }>("/api/stats/prs?limit=4&rangeDays=365").catch(() => ({ items: [] as PrApiItem[] })),
      apiGet<{ series: VolumeSeriesPoint[] }>("/api/stats/volume-series?bucket=week&rangeDays=28").catch(() => ({ series: [] as VolumeSeriesPoint[] })),
    ]);

    const plans = plansRes.items ?? [];
    const logs = logsRes.items ?? [];

    // Resolve highlighted plan for session generation
    const nowKey = toLocalDateKey(new Date());
    const latestTodayLog = logs.find((entry) => parseDateKey(entry.performedAt) === nowKey) ?? null;
    const highlightedPlan = resolveHighlightedPlan(plans, latestTodayLog);

    // Generate today's session to get exercise preview (idempotent upsert)
    let snapshot: GenerateSessionResponse["session"]["snapshot"] | null = null;
    if (highlightedPlan) {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await apiPost<GenerateSessionResponse>(
          `/api/plans/${encodeURIComponent(highlightedPlan.id)}/generate`,
          { sessionDate: nowKey, timezone },
          { invalidateCache: false },
        );
        snapshot = res.session?.snapshot ?? null;
      } catch {
        // Non-critical: fall back to no exercise preview
      }
    }

    return buildHomeData(
      plans,
      logs,
      prsRes.items ?? [],
      volumeSeriesRes.series ?? [],
      snapshot,
      this.recentLimit,
    );
  }
}
