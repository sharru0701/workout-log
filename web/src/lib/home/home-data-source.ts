import { apiGet } from "@/lib/api";
import type { AppLocale } from "@/lib/i18n/messages";
import { buildTodayLogHref, toLocalDateKey } from "@/lib/workout-links";
import { resolveLoggedTotalLoadKg } from "@/lib/bodyweight-load";

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
  hasPlan: boolean;
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

export type HomeDataLocale = AppLocale;

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
  meta?: Record<string, unknown> | null;
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

// ─── Intl formatter singletons ──────────────────────────────────────
// PERF: Intl.DateTimeFormat 인스턴스 생성은 비용이 크므로 모듈 레벨에서 한 번만 생성

const DATE_FORMATTERS = {
  ko: {
    withWeekday: new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }),
    monthDay: new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
    }),
    weekdayShort: new Intl.DateTimeFormat("ko-KR", {
      weekday: "short",
    }),
  },
  en: {
    withWeekday: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
    }),
    monthDay: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }),
    weekdayShort: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
    }),
  },
} as const;

const HOME_TEXT = {
  ko: {
    unknownDate: "날짜 미상",
    selectedProgram: "선택된 프로그램",
    planNeeded: "플랜 준비 필요",
    noPlanMeta: "오늘 운동은 플랜 기반으로 동작합니다. 먼저 프로그램을 선택하거나 커스텀 프로그램을 만드세요.",
    completedMeta: (sessionCount: number, setCount: number) => `오늘 ${sessionCount}개 세션 / ${setCount}세트 완료`,
    plannedMeta: (mainNames: string[], totalSets: number) => `${mainNames.join(", ")} 외 ${totalSets}세트`,
    plannedMetaFallback: (totalSets: number) => `${totalSets}세트 예정`,
    emptyPlanMeta: "준비된 플랜으로 오늘 세션을 생성하고 기록을 시작합니다.",
    todayHeadline: "오늘의 운동 요약",
    unassignedProgram: "프로그램 미지정",
    noExerciseData: "운동 정보 없음",
    recentDescription: (setCount: number, primaryExercise: string) => `${setCount}세트 / 대표 운동: ${primaryExercise}`,
  },
  en: {
    unknownDate: "Unknown date",
    selectedProgram: "Selected Program",
    planNeeded: "Plan Needed",
    noPlanMeta: "Today's workout runs from a plan. Pick a program first or create a custom plan.",
    completedMeta: (sessionCount: number, setCount: number) => `${sessionCount} session${sessionCount === 1 ? "" : "s"} today / ${setCount} sets completed`,
    plannedMeta: (mainNames: string[], totalSets: number) => `${mainNames.join(", ")} + ${totalSets} planned sets`,
    plannedMetaFallback: (totalSets: number) => `${totalSets} planned sets`,
    emptyPlanMeta: "Generate today's session from your plan and start logging.",
    todayHeadline: "Today's Workout",
    unassignedProgram: "No Program",
    noExerciseData: "No Exercise Data",
    recentDescription: (setCount: number, primaryExercise: string) => `${setCount} sets / Main exercise: ${primaryExercise}`,
  },
} as const;

// ─── Helpers ────────────────────────────────────────────────────────

function parseDateKey(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return toLocalDateKey(parsed);
}

function formatDate(iso: string, locale: HomeDataLocale) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return HOME_TEXT[locale].unknownDate;
  return DATE_FORMATTERS[locale].withWeekday.format(parsed);
}

function formatMonthDay(date: Date, locale: HomeDataLocale) {
  return DATE_FORMATTERS[locale].monthDay.format(date);
}

function formatWeekdayShort(date: Date, locale: HomeDataLocale) {
  return DATE_FORMATTERS[locale].weekdayShort.format(date);
}

function resolveHighlightedPlan(plans: PlanItem[], latestTodayLog: WorkoutLogItem | null) {
  // PERF: 기존 두 번의 배열 복사+정렬(O(n log n)) → 단일 순회(O(n))로 개선
  const todayPlanId = latestTodayLog?.planId ?? null;

  let planFromToday: PlanItem | null = null;
  let planByLastPerformed: PlanItem | null = null;
  let planByLastPerformedTime = -Infinity;
  let fallbackPlan: PlanItem | null = null;
  let fallbackPlanTime = -Infinity;

  for (const plan of plans) {
    if (todayPlanId && plan.id === todayPlanId) {
      planFromToday = plan;
    }
    if (plan.lastPerformedAt) {
      const t = new Date(plan.lastPerformedAt).getTime();
      if (t > planByLastPerformedTime) {
        planByLastPerformedTime = t;
        planByLastPerformed = plan;
      }
    }
    const createdTime = new Date(plan.createdAt).getTime();
    if (createdTime > fallbackPlanTime) {
      fallbackPlanTime = createdTime;
      fallbackPlan = plan;
    }
  }

  return planFromToday ?? planByLastPerformed ?? fallbackPlan;
}

// ─── Builders ───────────────────────────────────────────────────────

function buildPlanOverview(
  plans: PlanItem[],
  latestTodayLog: WorkoutLogItem | null,
  locale: HomeDataLocale,
): HomePlanOverview {
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
    lastPerformedAtLabel: highlightedPlan.lastPerformedAt ? formatDate(highlightedPlan.lastPerformedAt, locale) : null,
  };
}

function buildWeeklySummary(logs: WorkoutLogItem[], locale: HomeDataLocale): HomeWeeklySummary {
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
      shortLabel: formatWeekdayShort(day, locale),
      dateLabel: formatMonthDay(day, locale),
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

    // 풀업 등 맨몸 운동은 meta.totalLoadKg(체중+추가중량)를 사용
    const weight = Number(resolveLoggedTotalLoadKg({ exerciseName: name, weightKg: set.weightKg, meta: set.meta }) ?? set.weightKg ?? 0);
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
  locale: HomeDataLocale,
): HomeTodaySummary {
  const copy = HOME_TEXT[locale];
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
  const activePlanId = latestToday?.planId ?? highlightedPlan?.id ?? null;
  const selectedProgramName = latestToday?.planId
    ? plansById.get(latestToday.planId) ?? copy.selectedProgram
    : highlightedPlan?.name ?? copy.planNeeded;

  let meta: string;
  if (!activePlanId) {
    meta = copy.noPlanMeta;
  } else if (todayLogCount > 0) {
    meta = copy.completedMeta(todayLogCount, completedSets);
  } else if (plannedExercises.length > 0) {
    const mainExercises = plannedExercises.filter((e) => e.role === "MAIN");
    const mainNames = mainExercises.slice(0, 3).map((e) => e.name);
    meta = mainNames.length > 0
      ? copy.plannedMeta(mainNames, totalPlannedSets)
      : copy.plannedMetaFallback(totalPlannedSets);
  } else {
    meta = copy.emptyPlanMeta;
  }

  return {
    headline: copy.todayHeadline,
    programName: selectedProgramName,
    hasPlan: Boolean(activePlanId),
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

function buildRecentSessions(
  plans: PlanItem[],
  logs: WorkoutLogItem[],
  recentLimit: number,
  locale: HomeDataLocale,
): HomeRecentSession[] {
  const copy = HOME_TEXT[locale];
  const nowKey = toLocalDateKey(new Date());
  const plansById = new Map(plans.map((entry) => [entry.id, entry.name]));

  return logs
    .filter((entry) => parseDateKey(entry.performedAt) !== nowKey)
    .slice(0, recentLimit)
    .map((entry) => {
      const planName = entry.planId ? plansById.get(entry.planId) ?? copy.unassignedProgram : copy.unassignedProgram;
      const primaryExercise = entry.sets[0]?.exerciseName ?? copy.noExerciseData;
      const setCount = entry.sets.length;
      return {
        id: entry.id,
        title: planName,
        subtitle: formatDate(entry.performedAt, locale),
        description: copy.recentDescription(setCount, primaryExercise),
        href: `/workout/log?context=recent&logId=${encodeURIComponent(entry.id)}`,
      };
    });
}

function buildLastSession(
  plans: PlanItem[],
  logs: WorkoutLogItem[],
  plannedWeightByExercise: Map<string, number>,
  locale: HomeDataLocale,
): HomeLastSession | null {
  const copy = HOME_TEXT[locale];
  const nowKey = toLocalDateKey(new Date());
  const plansById = new Map(plans.map((entry) => [entry.id, entry.name]));

  const lastLog = logs.find((entry) => parseDateKey(entry.performedAt) !== nowKey);
  if (!lastLog) return null;

  const planName = lastLog.planId ? plansById.get(lastLog.planId) ?? copy.unassignedProgram : copy.unassignedProgram;
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
    date: formatDate(lastLog.performedAt, locale),
    totalSets,
    totalVolume: Math.round(totalVolume),
    exercises,
    href: `/workout/log?context=recent&logId=${encodeURIComponent(lastLog.id)}`,
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

function buildVolumeTrend(series: VolumeSeriesPoint[], locale: HomeDataLocale): HomeVolumeTrendPoint[] {
  return series.map((point) => ({
    period: point.period,
    label: formatSessionLabel(point.period, locale),
    tonnage: Math.round(point.tonnage),
    sets: Number(point.sets ?? 0),
    reps: Number(point.reps ?? 0),
  }));
}

function formatSessionLabel(period: string, locale: HomeDataLocale) {
  const date = new Date(period);
  if (Number.isNaN(date.getTime())) return period;
  return DATE_FORMATTERS[locale].monthDay.format(date);
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
  locale: HomeDataLocale = "ko",
): HomeData {
  const todayKey = toLocalDateKey(new Date());
  const latestTodayLog = logs.find((entry) => parseDateKey(entry.performedAt) === todayKey) ?? null;

  const { exercises: plannedExercises, totalSets: totalPlannedSets, plannedWeightByExercise } =
    buildPlannedExercises(snapshot);

  return {
    today: buildTodaySummary(plans, logs, plannedExercises, totalPlannedSets, locale),
    planOverview: buildPlanOverview(plans, latestTodayLog, locale),
    weeklySummary: buildWeeklySummary(logs, locale),
    recentLimit,
    recentSessions: buildRecentSessions(plans, logs, recentLimit, locale),
    lastSession: buildLastSession(plans, logs, plannedWeightByExercise, locale),
    strengthProgress: buildStrengthProgress(prItems),
    volumeTrend: buildVolumeTrend(volumeSeries, locale),
    quickStats: buildQuickStats(logs),
  };
}

// ─── Preview Data ───────────────────────────────────────────────────

export function getHomePreviewData(locale: HomeDataLocale = "ko"): HomeData {
  const formatPreviewDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? HOME_TEXT[locale].unknownDate : DATE_FORMATTERS[locale].withWeekday.format(date);
  };
  const formatPreviewDay = (value: string) => {
    const date = new Date(value);
    return {
      shortLabel: DATE_FORMATTERS[locale].weekdayShort.format(date),
      dateLabel: DATE_FORMATTERS[locale].monthDay.format(date),
    };
  };

  const weeklyDates = [
    { key: "2026-02-25", hasWorkout: true, isToday: false },
    { key: "2026-02-26", hasWorkout: false, isToday: false },
    { key: "2026-02-27", hasWorkout: true, isToday: false },
    { key: "2026-02-28", hasWorkout: true, isToday: false },
    { key: "2026-03-01", hasWorkout: false, isToday: false },
    { key: "2026-03-02", hasWorkout: true, isToday: false },
    { key: "2026-03-03", hasWorkout: true, isToday: true },
  ];

  return {
  today: {
    headline: HOME_TEXT[locale].todayHeadline,
    programName: "5/3/1 BBB",
    hasPlan: true,
    meta: locale === "ko" ? "Back Squat, Bench Press 외 16세트" : "Back Squat, Bench Press + 16 planned sets",
    completedSets: 0,
    href: "/workout/log?planId=preview-plan-531&date=2026-03-03",
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
    lastPerformedAtLabel: formatPreviewDate("2026-03-02"),
  },
  weeklySummary: {
    activeDays: 4,
    restDays: 3,
    sessionCount: 5,
    completedSets: 62,
    days: weeklyDates.map((day) => ({ ...day, ...formatPreviewDay(day.key) })),
  },
  recentLimit: DEFAULT_RECENT_LIMIT,
  recentSessions: [
    { id: "preview-1", title: "5/3/1 BBB", subtitle: formatPreviewDate("2026-03-02"), description: HOME_TEXT[locale].recentDescription(16, "Back Squat"), href: "/workout/log?context=recent&logId=preview-1" },
    { id: "preview-2", title: "My A/B Strength", subtitle: formatPreviewDate("2026-03-01"), description: HOME_TEXT[locale].recentDescription(12, "Deadlift"), href: "/workout/log?context=recent&logId=preview-2" },
    { id: "preview-3", title: "StrongLifts 5x5", subtitle: formatPreviewDate("2026-02-28"), description: HOME_TEXT[locale].recentDescription(15, "Bench Press"), href: "/workout/log?context=recent&logId=preview-3" },
  ],
  lastSession: {
    id: "preview-1",
    planName: "5/3/1 BBB",
    date: formatPreviewDate("2026-03-02"),
    totalSets: 16,
    totalVolume: 8450,
    exercises: [
      { name: "Back Squat", sets: 8, bestSet: "8x3 @ 120kg", weightDelta: -10 },
      { name: "Leg Press", sets: 5, bestSet: "5x10 @ 180kg", weightDelta: null },
      { name: "Leg Curl", sets: 3, bestSet: "3x12 @ 40kg", weightDelta: null },
    ],
    href: "/workout/log?context=recent&logId=preview-1",
  },
  strengthProgress: [
    { exerciseName: "Back Squat", exerciseId: "ex-squat", bestE1rm: 145, latestE1rm: 140, improvement: 12, trend: "up" },
    { exerciseName: "Bench Press", exerciseId: "ex-bench", bestE1rm: 105, latestE1rm: 105, improvement: 8, trend: "up" },
    { exerciseName: "Deadlift", exerciseId: "ex-dl", bestE1rm: 180, latestE1rm: 175, improvement: 15, trend: "up" },
    { exerciseName: "Overhead Press", exerciseId: "ex-ohp", bestE1rm: 68, latestE1rm: 68, improvement: 0, trend: "flat" },
  ],
  volumeTrend: [
    { period: "2026-02-10", label: DATE_FORMATTERS[locale].monthDay.format(new Date("2026-02-10")), tonnage: 18200, sets: 48, reps: 320 },
    { period: "2026-02-17", label: DATE_FORMATTERS[locale].monthDay.format(new Date("2026-02-17")), tonnage: 21500, sets: 56, reps: 385 },
    { period: "2026-02-24", label: DATE_FORMATTERS[locale].monthDay.format(new Date("2026-02-24")), tonnage: 19800, sets: 52, reps: 350 },
    { period: "2026-03-03", label: DATE_FORMATTERS[locale].monthDay.format(new Date("2026-03-03")), tonnage: 22100, sets: 58, reps: 400 },
  ],
  quickStats: {
    totalSessions: 47,
    totalVolume: 312500,
    currentStreak: 3,
    thisMonthSessions: 5,
  },
  };
}

export const HOME_PREVIEW_DATA: HomeData = getHomePreviewData("ko");

// ─── Data Sources ───────────────────────────────────────────────────

export class PreviewHomeDataSource implements HomeDataSource {
  constructor(private readonly previewData: HomeData = HOME_PREVIEW_DATA) {}

  async load(): Promise<HomeData> {
    return this.previewData;
  }
}

export class ApiHomeDataSource implements HomeDataSource {
  constructor(
    private readonly recentLimit = DEFAULT_RECENT_LIMIT,
    private readonly locale: HomeDataLocale = "ko",
  ) {}

  async load(): Promise<HomeData> {
    // PERF: 기존 5개 HTTP 요청(4개 병렬 + 1개 순차) → 1개 요청으로 통합
    // /api/home이 서버에서 모든 DB 쿼리를 병렬 실행하고 snapshot도 서버 내부에서 생성
    // RTT 150ms 환경: 기존 300ms+ → 150ms로 단축
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // PERF: maxAgeMs를 60초로 확장 - 홈 데이터는 운동 기록 후에만 변경됨
    // mutation 시 apiInvalidateCache("/api/home")로 무효화되므로 stale 데이터 표시 없음
    const res = await apiGet<{
      plans: PlanItem[];
      logs: WorkoutLogItem[];
      prs: PrApiItem[];
      volumeSeries: VolumeSeriesPoint[];
      snapshot: GenerateSessionResponse["session"]["snapshot"] | null;
    }>(`/api/home?timezone=${encodeURIComponent(timezone)}`, {
      maxAgeMs: 60_000,           // 기본 8초 → 60초
      staleWhileRevalidateMs: 300_000, // 기본 52초 → 5분
    });

    return buildHomeData(
      res.plans ?? [],
      res.logs ?? [],
      res.prs ?? [],
      res.volumeSeries ?? [],
      res.snapshot ?? null,
      this.recentLimit,
      this.locale,
    );
  }
}
