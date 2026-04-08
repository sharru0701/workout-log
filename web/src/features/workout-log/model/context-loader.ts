import { apiGet, apiPost } from "@/shared/api";
import {
  createWorkoutRecordDraft,
  createWorkoutRecordDraftFromLog,
  prepareWorkoutRecordDraftForEntry,
  type WorkoutProgramExerciseEntryStateMap,
  type WorkoutRecordDraft,
} from "@/entities/workout-record";
import { type WorkoutPreferences } from "@/lib/settings/workout-preferences";
import { toDateKey } from "./query-context";
import {
  applyRecentWeightsToCustomExercises,
  buildLastSessionSummary,
} from "./last-session-summary";
import type {
  WorkoutLogDetailResponse,
  WorkoutLogDetailedLogItem,
  WorkoutLogGeneratedSessionResponse,
  WorkoutLogLastSessionSummary,
  WorkoutLogLogsResponse,
  WorkoutLogRecentLogItem,
} from "./types";

export type LoadWorkoutContextInput = {
  planId: string;
  planName: string;
  dateKey: string;
  preferences: WorkoutPreferences;
  planAutoProgression?: boolean;
  planSchedule?: unknown;
  planParams?: Record<string, unknown> | null;
  logId?: string | null;
  initialLog?: WorkoutLogDetailedLogItem | null;
};

type LoadWorkoutContextDependencies = {
  browserTimezone: string;
  locale: "ko" | "en";
  applyWeightRulesToDraft: (
    sourceDraft: WorkoutRecordDraft,
    preferences: WorkoutPreferences,
  ) => WorkoutRecordDraft;
};

export type LoadedWorkoutContextResult = {
  kind: "loaded";
  selectedPlanId: string;
  draft: WorkoutRecordDraft;
  programEntryState: WorkoutProgramExerciseEntryStateMap;
  recentLogItems: WorkoutLogRecentLogItem[];
  lastSession: WorkoutLogLastSessionSummary;
};

export type BlockedWorkoutContextResult = {
  kind: "blocked";
  message: string;
};

export type WorkoutContextResult =
  | LoadedWorkoutContextResult
  | BlockedWorkoutContextResult;

function buildRecentLogsPath(planId: string) {
  return planId
    ? `/api/logs?planId=${encodeURIComponent(planId)}&limit=6&includeProgression=0`
    : "/api/logs?limit=6&includeProgression=0";
}

export async function loadWorkoutContextData(
  input: LoadWorkoutContextInput,
  {
    browserTimezone,
    locale,
    applyWeightRulesToDraft,
  }: LoadWorkoutContextDependencies,
): Promise<WorkoutContextResult> {
  const recentLogsPath = buildRecentLogsPath(input.planId);

  if (input.logId) {
    const [logRes, logsRes] = await Promise.all([
      input.initialLog
        ? Promise.resolve({ item: input.initialLog })
        : apiGet<WorkoutLogDetailResponse>(`/api/logs/${encodeURIComponent(input.logId)}`),
      apiGet<WorkoutLogLogsResponse>(recentLogsPath),
    ]);

    const selectedPlanId =
      typeof logRes.item.planId === "string" && logRes.item.planId.trim()
        ? logRes.item.planId
        : input.planId;
    const draft = applyWeightRulesToDraft(
      createWorkoutRecordDraftFromLog(logRes.item, input.planName, {
        sessionDate: input.dateKey || undefined,
        timezone: browserTimezone,
        planSchedule: input.planSchedule,
        locale,
      }),
      input.preferences,
    );
    const summaryDateKey = input.dateKey || draft.session.sessionDate;

    return {
      kind: "loaded",
      selectedPlanId,
      draft,
      programEntryState: {},
      recentLogItems: logsRes.items ?? [],
      lastSession: buildLastSessionSummary(
        logsRes.items ?? [],
        summaryDateKey,
        input.planParams,
        input.preferences.bodyweightKg,
        locale,
      ),
    };
  }

  if (input.planId && input.dateKey) {
    const existingLogLookup = await apiGet<WorkoutLogLogsResponse>(
      `/api/logs?planId=${encodeURIComponent(input.planId)}&date=${encodeURIComponent(input.dateKey)}&timezone=${encodeURIComponent(browserTimezone)}&limit=1&includeSets=0&includeGeneratedSession=0&includeProgression=0`,
    );
    const existingLogId = existingLogLookup.items[0]?.id ?? null;
    if (existingLogId) {
      return loadWorkoutContextData(
        {
          ...input,
          logId: existingLogId,
        },
        {
          browserTimezone,
          locale,
          applyWeightRulesToDraft,
        },
      );
    }
  }

  const isPastAutoPlan =
    input.planAutoProgression === true &&
    Boolean(input.dateKey) &&
    input.dateKey < toDateKey(new Date());

  if (isPastAutoPlan) {
    return {
      kind: "blocked",
      message:
        locale === "ko"
          ? "자동 진행 플랜은 오늘 이전 날짜에 새 운동기록을 추가할 수 없습니다. 기존 기록만 수정할 수 있습니다."
          : "Auto-progression plans cannot create new workout logs before today. You can only edit existing logs.",
    };
  }

  const [sessionRes, logsRes] = await Promise.all([
    apiPost<WorkoutLogGeneratedSessionResponse>(`/api/plans/${encodeURIComponent(input.planId)}/generate`, {
      sessionDate: input.dateKey,
      timezone: browserTimezone,
    }),
    apiGet<WorkoutLogLogsResponse>(recentLogsPath),
  ]);

  const prepared = prepareWorkoutRecordDraftForEntry(
    applyRecentWeightsToCustomExercises(
      applyWeightRulesToDraft(
        createWorkoutRecordDraft(sessionRes.session, input.planName, {
          sessionDate: input.dateKey,
          timezone: browserTimezone,
          planSchedule: input.planSchedule,
          locale,
        }),
        input.preferences,
      ),
      logsRes.items ?? [],
    ),
  );

  return {
    kind: "loaded",
    selectedPlanId: input.planId,
    draft: prepared.draft,
    programEntryState: prepared.programEntryState,
    recentLogItems: logsRes.items ?? [],
    lastSession: buildLastSessionSummary(
      logsRes.items ?? [],
      input.dateKey,
      input.planParams,
      input.preferences.bodyweightKg,
      locale,
    ),
  };
}
