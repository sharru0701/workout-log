import { requireAuthenticatedUserId } from "@/server/auth/user";
import { fetchStats1RMFilterOptions } from "@/server/stats/e1rm-service";
import { fetchPrsList, type PrItem } from "@/server/stats/prs-service";

export type PrHistoryDaysPreset = 30 | 90 | 365 | "all";

const VALID_PRESETS = new Set<PrHistoryDaysPreset | string>([
  "30",
  "90",
  "365",
  "all",
]);

const ALL_TIME_LOOKBACK_DAYS = 365 * 10;
const PR_LIMIT = 100;

export type PrHistoryBootstrap = {
  exercises: Array<{ id: string; name: string }>;
  selected: {
    exerciseId: string | null;
    days: PrHistoryDaysPreset;
  };
  rangeFrom: string;
  rangeTo: string;
  rangeDays: number;
  prs: PrItem[];
};

type SearchParams = Record<string, string | string[] | undefined>;

function readString(params: SearchParams, key: string) {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function parseDaysPreset(input: string | null): PrHistoryDaysPreset {
  if (!input || !VALID_PRESETS.has(input)) return 90;
  if (input === "all") return "all";
  return Number(input) as PrHistoryDaysPreset;
}

function rangeFromDaysPreset(days: PrHistoryDaysPreset): {
  from: Date;
  to: Date;
  rangeDays: number;
} {
  const to = new Date();
  if (days === "all") {
    const from = new Date(to.getTime() - ALL_TIME_LOOKBACK_DAYS * 86_400_000);
    return { from, to, rangeDays: ALL_TIME_LOOKBACK_DAYS };
  }
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from, to, rangeDays: days };
}

export async function getPrHistoryBootstrap(
  searchParams?: SearchParams,
): Promise<PrHistoryBootstrap> {
  const userId = await requireAuthenticatedUserId();
  const params = searchParams ?? {};
  const requestedExerciseId = readString(params, "exerciseId")?.trim() ?? "";
  const days = parseDaysPreset(readString(params, "days"));
  const { from, to, rangeDays } = rangeFromDaysPreset(days);

  const [filterOptions, prsResult] = await Promise.all([
    fetchStats1RMFilterOptions(userId),
    fetchPrsList({
      userId,
      from,
      to,
      rangeDays,
      exerciseId: requestedExerciseId || null,
      limit: PR_LIMIT,
    }),
  ]);

  return {
    exercises: filterOptions.exercises,
    selected: {
      exerciseId: prsResult.resolvedExerciseId ?? (requestedExerciseId || null),
      days,
    },
    rangeFrom: prsResult.from,
    rangeTo: prsResult.to,
    rangeDays: prsResult.rangeDays,
    prs: prsResult.items,
  };
}
