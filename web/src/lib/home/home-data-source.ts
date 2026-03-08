import { apiGet } from "@/lib/api";
import { buildTodayLogHref, toLocalDateKey } from "@/lib/workout-links";

export type HomeTodaySummary = {
  headline: string;
  programName: string;
  meta: string;
  completedSets: number;
  estimatedE1rmKg: number | null;
  href: string;
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

export type HomeData = {
  today: HomeTodaySummary;
  planOverview: HomePlanOverview;
  weeklySummary: HomeWeeklySummary;
  recentLimit: number;
  recentSessions: HomeRecentSession[];
};

export interface HomeDataSource {
  load(): Promise<HomeData>;
}

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

const DEFAULT_RECENT_LIMIT = 3;
const WEEKLY_WINDOW_DAYS = 7;

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

function estimateE1rm(weightKg: number | null | undefined, reps: number | null | undefined) {
  if (weightKg === null || reps === null || weightKg === undefined || reps === undefined) return null;
  if (weightKg <= 0 || reps <= 0) return null;
  const effectiveReps = Math.min(reps, 15);
  return weightKg * (1 + effectiveReps / 30);
}

function formatE1rm(value: number | null) {
  if (value === null) return "-";
  return `${Math.round(value)}kg`;
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

function buildTodaySummary(plans: PlanItem[], logs: WorkoutLogItem[]): HomeTodaySummary {
  const nowKey = toLocalDateKey(new Date());
  const plansById = new Map(plans.map((entry) => [entry.id, entry.name]));
  const todayLogs = logs.filter((entry) => parseDateKey(entry.performedAt) === nowKey);
  const todaySets = todayLogs.flatMap((entry) => entry.sets);

  const completedSets = todaySets.length;
  const todayLogCount = todayLogs.length;
  const latestToday = todayLogs[0] ?? null;
  const highlightedPlan = resolveHighlightedPlan(plans, latestToday);
  const selectedProgramName = latestToday?.planId
    ? plansById.get(latestToday.planId) ?? "선택된 프로그램"
    : highlightedPlan?.name ?? "플랜 준비 필요";

  let estimatedE1rmKg: number | null = null;
  for (const set of todaySets) {
    const value = estimateE1rm(set.weightKg, set.reps);
    if (value === null) continue;
    if (estimatedE1rmKg === null || value > estimatedE1rmKg) {
      estimatedE1rmKg = value;
    }
  }

  const activePlanId = latestToday?.planId ?? highlightedPlan?.id ?? null;
  const meta = activePlanId
    ? todayLogCount > 0
      ? `오늘 ${todayLogCount}개 세션 / ${completedSets}세트 완료 / 예상 e1RM ${formatE1rm(estimatedE1rmKg)}`
      : "준비된 플랜으로 오늘 세션을 생성하고 기록을 시작합니다."
    : "오늘 운동은 플랜 기반으로 동작합니다. 먼저 프로그램을 선택하거나 커스텀 프로그램을 만드세요.";

  return {
    headline: "오늘의 운동 요약",
    programName: selectedProgramName,
    meta,
    completedSets,
    estimatedE1rmKg,
    href: activePlanId
      ? buildTodayLogHref({
          planId: activePlanId,
          date: nowKey,
          autoGenerate: todayLogCount === 0,
        })
      : "/program-store",
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

function buildHomeData(plans: PlanItem[], logs: WorkoutLogItem[], recentLimit = DEFAULT_RECENT_LIMIT): HomeData {
  const todayKey = toLocalDateKey(new Date());
  const latestTodayLog = logs.find((entry) => parseDateKey(entry.performedAt) === todayKey) ?? null;

  return {
    today: buildTodaySummary(plans, logs),
    planOverview: buildPlanOverview(plans, latestTodayLog),
    weeklySummary: buildWeeklySummary(logs),
    recentLimit,
    recentSessions: buildRecentSessions(plans, logs, recentLimit),
  };
}

export const HOME_PREVIEW_DATA: HomeData = {
  today: {
    headline: "오늘의 운동 요약",
    programName: "5/3/1 BBB",
    meta: "오늘 1개 세션 / 14세트 완료 / 예상 e1RM 132kg",
    completedSets: 14,
    estimatedE1rmKg: 132,
    href: "/workout-record?planId=preview-plan-531&date=2026-03-03",
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
    {
      id: "preview-1",
      title: "5/3/1 BBB",
      subtitle: "3월 2일 (월)",
      description: "16세트 / 대표 운동: Back Squat",
      href: "/workout-record?context=recent&logId=preview-1",
    },
    {
      id: "preview-2",
      title: "My A/B Strength",
      subtitle: "3월 1일 (일)",
      description: "12세트 / 대표 운동: Deadlift",
      href: "/workout-record?context=recent&logId=preview-2",
    },
    {
      id: "preview-3",
      title: "StrongLifts 5x5",
      subtitle: "2월 28일 (토)",
      description: "15세트 / 대표 운동: Bench Press",
      href: "/workout-record?context=recent&logId=preview-3",
    },
  ],
};

export class PreviewHomeDataSource implements HomeDataSource {
  constructor(private readonly previewData: HomeData = HOME_PREVIEW_DATA) {}

  async load(): Promise<HomeData> {
    return this.previewData;
  }
}

export class ApiHomeDataSource implements HomeDataSource {
  constructor(private readonly recentLimit = DEFAULT_RECENT_LIMIT) {}

  async load(): Promise<HomeData> {
    const [plansRes, logsRes] = await Promise.all([
      apiGet<{ items: PlanItem[] }>("/api/plans"),
      apiGet<{ items: WorkoutLogItem[] }>(`/api/logs?limit=${Math.max(this.recentLimit + 14, 40)}`),
    ]);

    return buildHomeData(plansRes.items ?? [], logsRes.items ?? [], this.recentLimit);
  }
}
