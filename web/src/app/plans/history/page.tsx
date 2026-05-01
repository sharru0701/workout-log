"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";
import { apiDelete, apiGet } from "@/lib/api";
import { APP_ROUTES } from "@/lib/app-routes";

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
};

type LogsResponse = {
  items: LogItem[];
  nextCursor: string | null;
};

const MONTH_ABBR_KO = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const MONTH_ABBR_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatTimeOnly(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
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

function shortenText(value: string | null | undefined, limit = 140) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function formatRelativeDays(days: number | null, locale: "ko" | "en") {
  if (days === null) return locale === "ko" ? "기록 없음" : "No record";
  if (days <= 0) return locale === "ko" ? "오늘" : "Today";
  if (days === 1) return locale === "ko" ? "어제" : "Yesterday";
  if (days < 7) return locale === "ko" ? `${days}일 전` : `${days}d ago`;
  if (days < 30) return locale === "ko" ? `${Math.floor(days / 7)}주 전` : `${Math.floor(days / 7)}w ago`;
  if (days < 365) return locale === "ko" ? `${Math.floor(days / 30)}개월 전` : `${Math.floor(days / 30)}mo ago`;
  return locale === "ko" ? `${Math.floor(days / 365)}년 전` : `${Math.floor(days / 365)}y ago`;
}

function formatVolumeShort(kg: number) {
  if (kg <= 0) return "—";
  if (kg >= 1000) {
    const t = kg / 1000;
    return `${t % 1 === 0 ? t.toFixed(0) : t.toFixed(1)}t`;
  }
  return `${Math.round(kg)}kg`;
}

function formatDurationLabel(minutes: number | null | undefined, locale: "ko" | "en") {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return locale === "ko" ? `${minutes}분` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return locale === "ko" ? `${hours}시간 ${mins}분` : `${hours}h ${mins}m`;
}

type TopSet = { exerciseName: string; weightKg: number; reps: number };

function topSetsPerExercise(sets: LogSet[]): TopSet[] {
  const byExercise = new Map<string, TopSet>();
  for (const set of sets) {
    if (set.isExtra) continue;
    const name = String(set.exerciseName ?? "").trim();
    const reps = Number(set.reps ?? 0);
    const weightKg = Number(set.weightKg ?? 0);
    if (!name || !Number.isFinite(reps) || !Number.isFinite(weightKg) || reps <= 0 || weightKg <= 0) continue;
    const cur = byExercise.get(name);
    if (!cur || weightKg > cur.weightKg || (weightKg === cur.weightKg && reps > cur.reps)) {
      byExercise.set(name, { exerciseName: name, weightKg, reps });
    }
  }
  return Array.from(byExercise.values()).sort((a, b) => b.weightKg - a.weightKg);
}

function groupLogsByMonth(logs: LogItem[]) {
  const groups: Array<{ key: string; year: number; month: number; logs: LogItem[] }> = [];
  let current: { key: string; year: number; month: number; logs: LogItem[] } | null = null;

  for (const log of logs) {
    const date = new Date(log.performedAt);
    if (Number.isNaN(date.getTime())) continue;
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    if (!current || current.key !== key) {
      current = { key, year, month, logs: [] };
      groups.push(current);
    }
    current.logs.push(log);
  }

  return groups;
}

function PlanTabStrip({
  plans,
  selectedPlanId,
  onSelect,
  locale,
}: {
  plans: Plan[];
  selectedPlanId: string;
  onSelect: (planId: string) => void;
  locale: "ko" | "en";
}) {
  return (
    <div className="history-tab-strip" role="tablist" aria-label={locale === "ko" ? "플랜 선택" : "Select plan"}>
      {plans.map((plan) => {
        const days = daysSince(plan.lastPerformedAt);
        const sub = formatRelativeDays(days, locale);
        const isActive = plan.id === selectedPlanId;
        return (
          <button
            key={plan.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? "true" : "false"}
            className="history-tab-strip__item"
            onClick={() => onSelect(plan.id)}
          >
            <span className="history-tab-strip__name">{plan.name}</span>
            <span className="history-tab-strip__sub">{sub}</span>
          </button>
        );
      })}
    </div>
  );
}

function HistorySummaryCard({
  plan,
  logs,
  locale,
}: {
  plan: Plan;
  logs: LogItem[];
  locale: "ko" | "en";
}) {
  const sessionsCount = logs.length;
  const totalVolumeKg = logs.reduce((sum, log) => sum + estimateVolumeKg(log.sets ?? []), 0);
  const totalSets = logs.reduce((sum, log) => sum + countWorkSets(log.sets ?? []), 0);
  const durations = logs.map((l) => l.durationMinutes).filter((d): d is number => typeof d === "number" && d > 0);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  return (
    <div className="history-summary-v2">
      <div className="history-summary-v2__plan">
        <div className="history-summary-v2__plan-name">{plan.name}</div>
        {plan.baseProgramName ? (
          <div className="history-summary-v2__plan-program">{plan.baseProgramName}</div>
        ) : null}
      </div>
      <div className="history-summary-v2__stats">
        <div className="history-summary-v2__stat">
          <span className="history-summary-v2__stat-label">{locale === "ko" ? "세션" : "Sessions"}</span>
          <span className="history-summary-v2__stat-value">{sessionsCount}</span>
        </div>
        <div className="history-summary-v2__stat">
          <span className="history-summary-v2__stat-label">{locale === "ko" ? "총 볼륨" : "Volume"}</span>
          <span className="history-summary-v2__stat-value">{formatVolumeShort(totalVolumeKg)}</span>
        </div>
        <div className="history-summary-v2__stat">
          <span className="history-summary-v2__stat-label">{locale === "ko" ? "총 세트" : "Sets"}</span>
          <span className="history-summary-v2__stat-value">{totalSets}</span>
        </div>
        <div className="history-summary-v2__stat">
          <span className="history-summary-v2__stat-label">{locale === "ko" ? "평균 시간" : "Avg Time"}</span>
          <span className="history-summary-v2__stat-value">{formatDurationLabel(avgDuration, locale)}</span>
        </div>
      </div>
    </div>
  );
}

function LogCard({
  log,
  locale,
  copy,
  onDelete,
  isDeleting,
}: {
  log: LogItem;
  locale: "ko" | "en";
  copy: ReturnType<typeof useLocale>["copy"];
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const date = new Date(log.performedAt);
  const validDate = !Number.isNaN(date.getTime());
  const day = validDate ? date.getDate() : "-";
  const monthIdx = validDate ? date.getMonth() : 0;
  const monthLabel = locale === "ko" ? MONTH_ABBR_KO[monthIdx] : MONTH_ABBR_EN[monthIdx];
  const weekdayIdx = validDate ? date.getDay() : 0;
  const weekday = locale === "ko" ? WEEKDAY_KO[weekdayIdx] : WEEKDAY_EN[weekdayIdx];
  const isWeekend = weekdayIdx === 0 || weekdayIdx === 6;
  const time = formatTimeOnly(log.performedAt);

  const workSetCount = countWorkSets(log.sets ?? []);
  const volumeKg = estimateVolumeKg(log.sets ?? []);
  const noteText = shortenText(log.notes);
  const topSets = topSetsPerExercise(log.sets ?? []);
  const visibleTopSets = topSets.slice(0, 4);
  const remainingExercises = Math.max(0, topSets.length - visibleTopSets.length);
  const duration = formatDurationLabel(log.durationMinutes, locale);

  return (
    <article className="session-log-card">
      <div className="session-log-card__date" data-weekend={isWeekend ? "true" : "false"}>
        <span className="session-log-card__date-month">{monthLabel}</span>
        <span className="session-log-card__date-day">{day}</span>
        <span className="session-log-card__date-weekday">{weekday}</span>
      </div>

      <div className="session-log-card__body">
        <div className="session-log-card__head">
          <h4 className="session-log-card__title">
            {topSets.length > 0
              ? topSets[0].exerciseName
              : (locale === "ko" ? "기록된 세트 없음" : "No sets recorded")}
            {topSets.length > 1 ? (
              <span className="session-log-card__title-suffix">
                {locale === "ko" ? ` 외 ${topSets.length - 1}` : ` +${topSets.length - 1}`}
              </span>
            ) : null}
          </h4>
          {time ? <div className="session-log-card__time">{time}</div> : null}
        </div>

        {visibleTopSets.length > 0 ? (
          <ul className="session-log-card__top-sets">
            {visibleTopSets.map((row) => (
              <li key={row.exerciseName} className="session-log-card__top-set">
                <span className="session-log-card__top-set-name">{row.exerciseName}</span>
                <span className="session-log-card__top-set-value">
                  <span className="session-log-card__top-set-weight">{row.weightKg}</span>
                  <span className="session-log-card__top-set-unit">kg</span>
                  <span className="session-log-card__top-set-reps">×{row.reps}</span>
                </span>
              </li>
            ))}
            {remainingExercises > 0 ? (
              <li className="session-log-card__top-set session-log-card__top-set--more">
                {locale === "ko" ? `+${remainingExercises}개 운동 더` : `+${remainingExercises} more`}
              </li>
            ) : null}
          </ul>
        ) : null}

        <div className="session-log-card__stats">
          <div className="session-log-card__stat">
            <span className="session-log-card__stat-label">{copy.plansHistory.volume}</span>
            <span className="session-log-card__stat-value">{formatVolumeShort(volumeKg)}</span>
          </div>
          <div className="session-log-card__stat">
            <span className="session-log-card__stat-label">{copy.plansHistory.sets}</span>
            <span className="session-log-card__stat-value">{workSetCount}</span>
          </div>
          <div className="session-log-card__stat">
            <span className="session-log-card__stat-label">{copy.plansHistory.time}</span>
            <span className="session-log-card__stat-value">{duration}</span>
          </div>
        </div>

        {noteText ? (
          <div className="session-log-card__note">
            <span className="material-symbols-outlined" aria-hidden="true">
              format_quote
            </span>
            <span>{noteText}</span>
          </div>
        ) : null}

        <div className="session-log-card__actions">
          <Link
            className="session-log-card__action session-log-card__action--primary"
            href={`/workout/session/${encodeURIComponent(log.id)}`}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              fitness_center
            </span>
            {copy.plansHistory.sessionDetail}
          </Link>
          <button
            type="button"
            className="session-log-card__action session-log-card__action--danger"
            disabled={isDeleting}
            onClick={onDelete}
            aria-label={copy.plansHistory.deleteHistory}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              delete
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}

function PlanHistoryPageContent() {
  const { copy, locale } = useLocale();
  const { alert, confirm } = useAppDialog();
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
  const [refreshTick] = useState(0);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const plansLoadedRef = useRef(false);

  const loadPlans = useCallback(async (options?: { isRefresh?: boolean }) => {
    try {
      if (!plansLoadedRef.current && !options?.isRefresh) setPlansLoading(true);
      setPlansError(null);
      const res = await apiGet<{ items: Plan[] }>("/api/plans", { cachePolicy: "network-only" });
      plansLoadedRef.current = true;
      setPlans(res.items ?? []);
    } catch (e: any) {
      setPlansError(e?.message ?? (locale === "ko" ? "플랜 목록을 불러오지 못했습니다." : "Could not load plans."));
    } finally {
      setPlansLoading(false);
    }
  }, [locale]);

  const loadLogs = useCallback(async (planId: string, cursor?: string | null, append = false, silent = false) => {
    if (!planId) {
      setLogs([]);
      setNextCursor(null);
      return;
    }

    try {
      if (!silent) {
        if (append) {
          setLogsLoadingMore(true);
        } else {
          setLogsLoading(true);
        }
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
      setLogsError(e?.message ?? (locale === "ko" ? "수행 로그를 불러오지 못했습니다." : "Could not load workout logs."));
      if (!append) {
        setLogs([]);
        setNextCursor(null);
      }
    } finally {
      setLogsLoading(false);
      setLogsLoadingMore(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadPlans({ isRefresh: refreshTick > 0 });
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
    const nextHref = selectedPlanId
      ? `${APP_ROUTES.plansHistory}?planId=${encodeURIComponent(selectedPlanId)}`
      : APP_ROUTES.plansHistory;
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

  const groupedLogs = useMemo(() => groupLogsByMonth(logs), [logs]);

  async function deleteLog(log: LogItem) {
    const ok = await confirm({
      title: locale === "ko" ? "히스토리 삭제" : "Delete History",
      message:
        locale === "ko"
          ? `이 수행 로그를 삭제하시겠습니까?\n${formatDateTime(log.performedAt)}\n삭제 후 자동 진행 상태도 남은 로그 기준으로 다시 계산됩니다.`
          : `Delete this workout log?\n${formatDateTime(log.performedAt)}\nAuto progression will be recalculated from the remaining logs afterward.`,
      confirmText: locale === "ko" ? "삭제" : "Delete",
      cancelText: locale === "ko" ? "취소" : "Cancel",
      tone: "danger",
    });
    if (!ok) return;

    try {
      setDeletingLogId(log.id);
      setLogsError(null);

      setLogs((prev) => prev.filter((item) => item.id !== log.id));

      await apiDelete<{ deleted: boolean }>(`/api/logs/${encodeURIComponent(log.id)}`);
      await Promise.all([
        loadPlans({ isRefresh: true }),
        selectedPlanId ? loadLogs(selectedPlanId, null, false, true) : Promise.resolve(),
      ]);
      await alert({
        title: locale === "ko" ? "삭제 완료" : "Deleted",
        message: locale === "ko" ? "수행 로그가 삭제되었습니다." : "The workout log was deleted.",
        buttonText: locale === "ko" ? "확인" : "OK",
      });
    } catch (e: any) {
      if (selectedPlanId) void loadLogs(selectedPlanId, null, false, true);
      const message = e?.message ?? (locale === "ko" ? "수행 로그 삭제에 실패했습니다." : "Failed to delete the workout log.");
      setLogsError(message);
      await alert({
        title: locale === "ko" ? "삭제 실패" : "Delete Failed",
        message,
        buttonText: locale === "ko" ? "확인" : "OK",
        tone: "danger",
      });
    } finally {
      setDeletingLogId(null);
    }
  }

  return (
    <>
      <header className="plans-overview__header">
        <div className="plans-overview__title-block">
          <h1 className="plans-overview__title">{copy.plansHistory.title}</h1>
          <p className="plans-overview__subtitle">{copy.plansHistory.description}</p>
        </div>
        <Link href={APP_ROUTES.plansHome} className="plans-overview__add plans-overview__add--ghost">
          <span className="material-symbols-outlined" aria-hidden="true">
            arrow_back
          </span>
          {locale === "ko" ? "내 플랜" : "My Plans"}
        </Link>
      </header>

      <section>
        <ErrorStateRows
          message={plansError}
          title={copy.plansHistory.plansLoadError}
          onRetry={() => {
            void loadPlans();
          }}
        />
        <EmptyStateRows
          when={!plansLoading && !plansError && plans.length === 0}
          label={copy.plansHistory.noPlans}
          description={copy.plansHistory.noPlansDescription}
        />
        <LoadingStateRows active={plansLoading && !plansLoadedRef.current} label={locale === "ko" ? "플랜 로딩 중" : "Loading plans"} />

        {plans.length > 1 ? (
          <PlanTabStrip
            plans={plans}
            selectedPlanId={selectedPlanId}
            onSelect={setSelectedPlanId}
            locale={locale}
          />
        ) : null}

        {selectedPlan ? (
          <HistorySummaryCard plan={selectedPlan} logs={logs} locale={locale} />
        ) : null}
      </section>

      <section style={{ marginTop: "var(--space-md)" }}>
        <ErrorStateRows
          message={logsError}
          title={copy.plansHistory.logsLoadError}
          onRetry={() => {
            if (!selectedPlanId) return;
            void loadLogs(selectedPlanId, null, false);
          }}
        />
        <LoadingStateRows active={logsLoading} label={locale === "ko" ? "로그 불러오는 중" : "Loading logs"} />
        <EmptyStateRows
          when={Boolean(selectedPlanId) && !logsLoading && !logsError && logs.length === 0}
          label={copy.plansHistory.noLogs}
          description={copy.plansHistory.noLogsDescription}
        />

        {groupedLogs.length > 0 ? (
          <div className="session-log-timeline">
            {groupedLogs.map((group) => {
              const monthLabel = locale === "ko"
                ? `${group.year}년 ${MONTH_ABBR_KO[group.month]}`
                : `${MONTH_ABBR_EN[group.month]} ${group.year}`;
              return (
                <div key={group.key} className="session-log-timeline__group">
                  <div className="session-log-timeline__label">
                    <span>{monthLabel}</span>
                    <span className="session-log-timeline__label-count">
                      {locale === "ko" ? `${group.logs.length}회` : `${group.logs.length}`}
                    </span>
                  </div>
                  <div className="session-log-timeline__list">
                    {group.logs.map((log) => (
                      <LogCard
                        key={log.id}
                        log={log}
                        locale={locale}
                        copy={copy}
                        isDeleting={deletingLogId === log.id}
                        onDelete={() => {
                          void deleteLog(log);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {nextCursor ? (
              <button
                type="button"
                className="session-log-timeline__more"
                disabled={logsLoadingMore}
                onClick={() => {
                  if (!selectedPlanId || !nextCursor) return;
                  void loadLogs(selectedPlanId, nextCursor, true);
                }}
              >
                {logsLoadingMore ? copy.plansHistory.loadingMore : copy.plansHistory.loadMore}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}

export default function PlanHistoryPage() {
  return (
    <Suspense fallback={null}>
      <PlanHistoryPageContent />
    </Suspense>
  );
}
