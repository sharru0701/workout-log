import { apiGet } from "@/lib/api";

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

export type HomeData = {
  today: HomeTodaySummary;
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

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return toDateKey(parsed);
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

function buildTodaySummary(plans: PlanItem[], logs: WorkoutLogItem[]): HomeTodaySummary {
  const nowKey = toDateKey(new Date());
  const plansById = new Map(plans.map((entry) => [entry.id, entry.name]));
  const todayLogs = logs.filter((entry) => parseDateKey(entry.performedAt) === nowKey);
  const todaySets = todayLogs.flatMap((entry) => entry.sets);

  const completedSets = todaySets.length;
  const todayLogCount = todayLogs.length;
  const latestToday = todayLogs[0] ?? null;
  const selectedProgramName = latestToday?.planId
    ? plansById.get(latestToday.planId) ?? "선택된 프로그램"
    : plans[0]?.name ?? "프로그램 미선택";

  let estimatedE1rmKg: number | null = null;
  for (const set of todaySets) {
    const value = estimateE1rm(set.weightKg, set.reps);
    if (value === null) continue;
    if (estimatedE1rmKg === null || value > estimatedE1rmKg) {
      estimatedE1rmKg = value;
    }
  }

  const params = new URLSearchParams({ context: "today", date: nowKey });
  if (latestToday?.planId) {
    params.set("planId", latestToday.planId);
  }

  const meta =
    todayLogCount > 0
      ? `오늘 ${todayLogCount}개 세션 / ${completedSets}세트 완료 / 예상 e1RM ${formatE1rm(estimatedE1rmKg)}`
      : "오늘 기록 없음. 탭해서 오늘 운동 기록을 시작하세요.";

  return {
    headline: "오늘의 운동 요약",
    programName: selectedProgramName,
    meta,
    completedSets,
    estimatedE1rmKg,
    href: `/workout-record?${params.toString()}`,
  };
}

function buildRecentSessions(plans: PlanItem[], logs: WorkoutLogItem[], recentLimit: number): HomeRecentSession[] {
  const nowKey = toDateKey(new Date());
  const plansById = new Map(plans.map((entry) => [entry.id, entry.name]));

  return logs
    .filter((entry) => parseDateKey(entry.performedAt) !== nowKey)
    .slice(0, recentLimit)
    .map((entry, index) => {
      const planName = entry.planId ? plansById.get(entry.planId) ?? "프로그램 미지정" : "프로그램 미지정";
      const primaryExercise = entry.sets[0]?.exerciseName ?? "운동 정보 없음";
      const setCount = entry.sets.length;
      return {
        id: entry.id,
        title: `${index + 1}. ${planName}`,
        subtitle: formatDate(entry.performedAt),
        description: `${setCount}세트 / 대표 운동: ${primaryExercise}`,
        href: `/workout-record?context=recent&logId=${encodeURIComponent(entry.id)}`,
      };
    });
}

function buildHomeData(plans: PlanItem[], logs: WorkoutLogItem[], recentLimit = DEFAULT_RECENT_LIMIT): HomeData {
  return {
    today: buildTodaySummary(plans, logs),
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
    href: "/workout-record?context=today&date=2026-03-03&planId=preview-plan-531",
  },
  recentLimit: DEFAULT_RECENT_LIMIT,
  recentSessions: [
    {
      id: "preview-1",
      title: "1. 5/3/1 BBB",
      subtitle: "3월 2일 (월)",
      description: "16세트 / 대표 운동: Back Squat",
      href: "/workout-record?context=recent&logId=preview-1",
    },
    {
      id: "preview-2",
      title: "2. My A/B Strength",
      subtitle: "3월 1일 (일)",
      description: "12세트 / 대표 운동: Deadlift",
      href: "/workout-record?context=recent&logId=preview-2",
    },
    {
      id: "preview-3",
      title: "3. StrongLifts 5x5",
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
      apiGet<{ items: WorkoutLogItem[] }>(`/api/logs?limit=${Math.max(this.recentLimit + 5, 20)}`),
    ]);

    return buildHomeData(plansRes.items ?? [], logsRes.items ?? [], this.recentLimit);
  }
}
