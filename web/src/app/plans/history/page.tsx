"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppSelect } from "@/components/ui/form-controls";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { apiGet } from "@/lib/api";
import { progressionTone, summarizeProgression, type ProgressionSummaryPayload } from "@/lib/progression/summary";
import { formatSessionKeyLabel } from "@/lib/session-key";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

type Plan = {
  id: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
  rootProgramVersionId: string | null;
  params: any;
  createdAt: string;
  baseProgramName?: string | null;
  lastPerformedAt?: string | null;
};

type LogSet = {
  id: string;
  exerciseName: string;
  reps: number | null;
  weightKg: number | null;
  isExtra: boolean;
};

type LogItem = {
  id: string;
  planId: string | null;
  generatedSessionId: string | null;
  performedAt: string;
  durationMinutes: number | null;
  notes: string | null;
  sets: LogSet[];
  generatedSession: {
    id: string;
    sessionKey: string;
  } | null;
  progression?: ProgressionSummaryPayload | null;
};

type LogsResponse = {
  items: LogItem[];
  nextCursor: string | null;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatDuration(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "기록 없음";
  return `${value}분`;
}

function summarizeExercises(sets: LogSet[]) {
  const names: string[] = [];
  for (const set of sets) {
    const name = String(set.exerciseName ?? "").trim();
    if (!name || names.includes(name)) continue;
    names.push(name);
  }
  if (names.length === 0) return "운동 정보 없음";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} 외 ${names.length - 3}개`;
}

function countWorkSets(sets: LogSet[]) {
  return sets.filter((set) => !set.isExtra).length;
}

function estimateVolumeKg(sets: LogSet[]) {
  return sets.reduce((sum, set) => {
    if (set.isExtra) return sum;
    const reps = Number(set.reps ?? 0);
    const weightKg = Number(set.weightKg ?? 0);
    if (!Number.isFinite(reps) || !Number.isFinite(weightKg) || reps <= 0 || weightKg <= 0) return sum;
    return sum + reps * weightKg;
  }, 0);
}

function shortenText(value: string | null | undefined, limit = 120) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function progressionBadgeClass(tone: ReturnType<typeof progressionTone>) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-700";
  }
}

function PlanHistoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPlanId = searchParams.get("planId")?.trim() ?? "";

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLoadingMore, setLogsLoadingMore] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const loadPlans = useCallback(async () => {
    try {
      setPlansLoading(true);
      setPlansError(null);
      const res = await apiGet<{ items: Plan[] }>("/api/plans", { cachePolicy: "network-only" });
      setPlans(res.items ?? []);
    } catch (e: any) {
      setPlansError(e?.message ?? "플랜 목록을 불러오지 못했습니다.");
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async (planId: string, cursor?: string | null, append = false) => {
    if (!planId) {
      setLogs([]);
      setNextCursor(null);
      return;
    }

    try {
      if (append) {
        setLogsLoadingMore(true);
      } else {
        setLogsLoading(true);
      }
      setLogsError(null);

      const sp = new URLSearchParams();
      sp.set("planId", planId);
      sp.set("limit", "12");
      if (cursor) sp.set("cursor", cursor);

      const res = await apiGet<LogsResponse>(`/api/logs?${sp.toString()}`, {
        cachePolicy: "network-only",
      });

      setLogs((prev) => {
        if (!append) return res.items ?? [];
        const seen = new Set(prev.map((item) => item.id));
        const incoming = (res.items ?? []).filter((item) => !seen.has(item.id));
        return [...prev, ...incoming];
      });
      setNextCursor(res.nextCursor ?? null);
    } catch (e: any) {
      setLogsError(e?.message ?? "수행 로그를 불러오지 못했습니다.");
      if (!append) {
        setLogs([]);
        setNextCursor(null);
      }
    } finally {
      setLogsLoading(false);
      setLogsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans, refreshTick]);

  useEffect(() => {
    if (plans.length === 0) {
      setSelectedPlanId("");
      return;
    }

    if (requestedPlanId && plans.some((plan) => plan.id === requestedPlanId)) {
      setSelectedPlanId((prev) => (prev === requestedPlanId ? prev : requestedPlanId));
      return;
    }

    if (selectedPlanId && plans.some((plan) => plan.id === selectedPlanId)) {
      return;
    }

    setSelectedPlanId(plans[0]?.id ?? "");
  }, [plans, requestedPlanId, selectedPlanId]);

  useEffect(() => {
    const currentQueryPlanId = searchParams.get("planId")?.trim() ?? "";
    const nextHref = selectedPlanId ? `/plans/history?planId=${encodeURIComponent(selectedPlanId)}` : "/plans/history";
    if (selectedPlanId !== currentQueryPlanId) {
      router.replace(nextHref, { scroll: false });
    }
  }, [router, searchParams, selectedPlanId]);

  useEffect(() => {
    if (!selectedPlanId) {
      setLogs([]);
      setNextCursor(null);
      return;
    }
    setLogs([]);
    setNextCursor(null);
    void loadLogs(selectedPlanId, null, false);
  }, [loadLogs, selectedPlanId, refreshTick]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      setRefreshTick((prev) => prev + 1);
    },
  });

  const loadedLogCount = logs.length;
  const loadedSetCount = useMemo(
    () => logs.reduce((sum, log) => sum + countWorkSets(log.sets ?? []), 0),
    [logs],
  );

  return (
    <div
      className="native-page native-page-enter tab-screen tab-screen-wide momentum-scroll"
      {...pullToRefresh.bind}
    >
      <div className="pull-refresh-indicator">
        {pullToRefresh.isRefreshing
          ? "플랜 히스토리 새로고침 중..."
          : pullToRefresh.pullOffset > 0
            ? "당겨서 새로고침"
            : ""}
      </div>

      <section className="grid gap-2">
        <div className="ios-section-heading">플랜 수행 히스토리</div>
        <p className="text-sm text-neutral-600">
          플랜별 수행 로그를 모아보고, 각 항목에서 세션 상세 화면으로 이동할 수 있습니다.
        </p>

        <LoadingStateRows active={plansLoading} label="플랜 목록 불러오는 중" />
        <ErrorStateRows
          message={plansError}
          title="플랜 목록 조회 실패"
          onRetry={() => {
            void loadPlans();
          }}
        />
        <EmptyStateRows
          when={!plansLoading && !plansError && plans.length === 0}
          label="플랜이 없습니다"
          description="프로그램 스토어에서 먼저 플랜을 생성하세요."
        />

        {plans.length > 0 ? (
          <label className="grid gap-1">
            <span className="ui-card-label">플랜 선택</span>
            <AppSelect
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(event.target.value)}
              disabled={plansLoading}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </AppSelect>
          </label>
        ) : null}

        {selectedPlan ? (
          <div className="motion-card rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="ui-card-label">플랜 이름</div>
              <div className="font-semibold">{selectedPlan.name}</div>
            </div>
            <div>
              <div className="ui-card-label">기반 프로그램</div>
              <div>{selectedPlan.baseProgramName ?? "-"}</div>
            </div>
            <div>
              <div className="ui-card-label">생성일</div>
              <div>{formatDateTime(selectedPlan.createdAt)}</div>
            </div>
            <div>
              <div className="ui-card-label">마지막 수행일</div>
              <div>{formatDateTime(selectedPlan.lastPerformedAt)}</div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-2">
        <div className="ios-section-heading">수행 로그</div>
        <NoticeStateRows
          message={
            selectedPlan
              ? `현재 ${loadedLogCount}개 로그 / ${loadedSetCount}세트를 표시합니다. 세션 상세에서 처방 대비와 자동 진행을 확인할 수 있습니다.`
              : "표시할 플랜을 선택하세요."
          }
          tone="neutral"
          label="히스토리 요약"
          preferInline
        />

        <LoadingStateRows
          active={Boolean(selectedPlanId) && logsLoading && logs.length === 0}
          label="수행 로그 불러오는 중"
        />
        <ErrorStateRows
          message={logsError}
          title="수행 로그 조회 실패"
          onRetry={() => {
            if (!selectedPlanId) return;
            void loadLogs(selectedPlanId, null, false);
          }}
        />
        <EmptyStateRows
          when={Boolean(selectedPlanId) && !logsLoading && !logsError && logs.length === 0}
          label="수행 로그가 없습니다"
          description="해당 플랜으로 운동을 기록하면 이 화면에 쌓입니다."
        />

        {logs.length > 0 ? (
          <div className="grid gap-3">
            {logs.map((log) => {
              const workSetCount = countWorkSets(log.sets ?? []);
              const exerciseSummary = summarizeExercises(log.sets ?? []);
              const volumeKg = estimateVolumeKg(log.sets ?? []);
              const noteText = shortenText(log.notes);
              const progressionText = summarizeProgression(log.progression ?? null);
              const progressionBadgeTone = progressionTone(log.progression ?? null);
              const sessionLabel = log.generatedSession?.sessionKey
                ? formatSessionKeyLabel(log.generatedSession.sessionKey)
                : null;

              return (
                <article key={log.id} className="motion-card rounded-2xl border p-4 grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <strong>{formatDateTime(log.performedAt)}</strong>
                      <span className="text-sm text-neutral-600">{exerciseSummary}</span>
                      {sessionLabel || progressionText ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {sessionLabel ? (
                            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
                              {sessionLabel}
                            </span>
                          ) : null}
                          {progressionText ? (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${progressionBadgeClass(progressionBadgeTone)}`}
                            >
                              {progressionText}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <a
                      className="haptic-tap rounded-xl border px-3 py-2 text-sm font-medium"
                      href={`/workout/session/${encodeURIComponent(log.id)}`}
                    >
                      세션 상세
                    </a>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="rounded-xl bg-neutral-50 px-3 py-2">
                      <div className="ui-card-label">작업 세트</div>
                      <div>{workSetCount}세트</div>
                    </div>
                    <div className="rounded-xl bg-neutral-50 px-3 py-2">
                      <div className="ui-card-label">추정 볼륨</div>
                      <div>{volumeKg > 0 ? `${Math.round(volumeKg)}kg` : "-"}</div>
                    </div>
                    <div className="rounded-xl bg-neutral-50 px-3 py-2">
                      <div className="ui-card-label">기록 시간</div>
                      <div>{formatDuration(log.durationMinutes)}</div>
                    </div>
                    <div className="rounded-xl bg-neutral-50 px-3 py-2">
                      <div className="ui-card-label">세션 타입</div>
                      <div>{sessionLabel ? "생성 세션 연결" : "수동 로그"}</div>
                    </div>
                  </div>

                  {noteText ? (
                    <div className="rounded-xl border border-dashed px-3 py-2 text-sm text-neutral-700">
                      <div className="ui-card-label">노트</div>
                      <div>{noteText}</div>
                    </div>
                  ) : null}
                </article>
              );
            })}

            {nextCursor ? (
              <button
                type="button"
                className="haptic-tap rounded-xl border px-4 py-3 text-sm font-semibold"
                disabled={logsLoadingMore}
                onClick={() => {
                  if (!selectedPlanId || !nextCursor) return;
                  void loadLogs(selectedPlanId, nextCursor, true);
                }}
              >
                {logsLoadingMore ? "더 불러오는 중..." : "로그 더 보기"}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function PlanHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="native-page native-page-enter tab-screen tab-screen-wide momentum-scroll">
          <section className="grid gap-2">
            <div className="ios-section-heading">플랜 수행 히스토리</div>
            <LoadingStateRows active label="히스토리 화면 준비 중" />
          </section>
        </div>
      }
    >
      <PlanHistoryPageContent />
    </Suspense>
  );
}
