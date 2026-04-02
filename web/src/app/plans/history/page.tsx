"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { AppSelect } from "@/components/ui/form-controls";
import { EmptyStateRows, ErrorStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { apiDelete, apiGet } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { progressionTone, summarizeProgression, type ProgressionSummaryPayload } from "@/lib/progression/summary";
import { formatSessionKeyLabel } from "@/lib/session-key";


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
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function summarizeExercises(sets: LogSet[], locale: "ko" | "en") {
  const names: string[] = [];
  for (const set of sets) {
    const name = String(set.exerciseName ?? "").trim();
    if (!name || names.includes(name)) continue;
    names.push(name);
  }
  if (names.length === 0) return locale === "ko" ? "운동 정보 없음" : "No exercise info";
  if (names.length <= 3) return names.join(", ");
  return locale === "ko" ? `${names.slice(0, 3).join(", ")} 외 ${names.length - 3}개` : `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
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
      return "label progress-medium label-sm";
    case "warning":
      return "label progress-high label-sm";
    default:
      return "label progress-low label-sm";
  }
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
  const [refreshTick, setRefreshTick] = useState(0);
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



  const loadedLogCount = logs.length;
  const loadedSetCount = useMemo(
    () => logs.reduce((sum, log) => sum + countWorkSets(log.sets ?? []), 0),
    [logs],
  );

  async function deleteLog(log: LogItem) {
    const ok = await confirm({
      title: locale === "ko" ? "히스토리 삭제" : "Delete History",
      message: locale === "ko" ? `이 수행 로그를 삭제하시겠습니까?\n${formatDateTime(log.performedAt)}\n삭제 후 자동 진행 상태도 남은 로그 기준으로 다시 계산됩니다.` : `Delete this workout log?\n${formatDateTime(log.performedAt)}\nAuto progression will be recalculated from the remaining logs afterward.`,
      confirmText: locale === "ko" ? "삭제" : "Delete",
      cancelText: locale === "ko" ? "취소" : "Cancel",
      tone: "danger",
    });
    if (!ok) return;

    try {
      setDeletingLogId(log.id);
      setLogsError(null);

      // Optimistic UI: 삭제된 아이템 즉시 목록에서 제거
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
      // 에러 발생 시 원래 상태로 복구 (재조회)
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

      <section>
        <div style={{ marginBottom: "var(--space-xl)", paddingBottom: "var(--space-md)", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ fontFamily: "var(--font-label-family)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-primary)", marginBottom: "4px" }}>{copy.plansHistory.headerEyebrow}</div>
          <h1 style={{ fontFamily: "var(--font-headline-family)", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-text)", margin: "0 0 var(--space-sm)" }}>{copy.plansHistory.title}</h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>{copy.plansHistory.description}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>

        {plansLoading && (
          <div style={{ background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 10, height: 44 }} />
        )}
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

        {plans.length > 0 ? (
          <AppSelect
            label={copy.plansHistory.selectPlan}
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
        ) : null}

        {selectedPlan ? (
          <div style={{ background: "var(--color-surface-container)", borderRadius: 14, padding: "var(--space-md)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>{copy.plansHistory.selectedPlan}</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.2px" }}>{selectedPlan.name}</div>
              {selectedPlan.baseProgramName ? (
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", marginTop: "2px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {selectedPlan.baseProgramName}
                </div>
              ) : null}
            </div>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>{copy.plansHistory.recentPerformed}</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>{formatDateTime(selectedPlan.lastPerformedAt)}</div>
            </div>
          </div>
        ) : null}
        </div>
      </section>

      <section style={{ marginTop: "var(--space-lg)" }}>
        <div style={{ marginBottom: "var(--space-sm)" }}>
          <h2 style={{ fontFamily: "var(--font-headline-family)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>{copy.plansHistory.logsTitle}</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        <NoticeStateRows
          message={
            selectedPlan
              ? copy.plansHistory.summaryWithCounts(loadedLogCount, loadedSetCount)
              : copy.plansHistory.summarySelectPlan
          }
          tone="neutral"
          label={copy.plansHistory.summaryLabel}
          preferInline
        />

        {Boolean(selectedPlanId) && logsLoading && logs.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
                <div style={{ background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 16, width: "45%", marginBottom: 8 }} />
                <div style={{ background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 4, height: 13, width: "70%", marginBottom: 12 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-sm)" }}>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j}>
                      <div style={{ background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 4, height: 11, width: "60%", marginBottom: 4 }} />
                      <div style={{ background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 18, width: "80%" }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <ErrorStateRows
          message={logsError}
          title={copy.plansHistory.logsLoadError}
          onRetry={() => {
            if (!selectedPlanId) return;
            void loadLogs(selectedPlanId, null, false);
          }}
        />
        <EmptyStateRows
          when={Boolean(selectedPlanId) && !logsLoading && !logsError && logs.length === 0}
          label={copy.plansHistory.noLogs}
          description={copy.plansHistory.noLogsDescription}
        />

        {logs.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {logs.map((log) => {
              const workSetCount = countWorkSets(log.sets ?? []);
              const exerciseSummary = summarizeExercises(log.sets ?? [], locale);
              const volumeKg = estimateVolumeKg(log.sets ?? []);
              const noteText = shortenText(log.notes);
              const progressionText = summarizeProgression(log.progression ?? null);
              const progressionBadgeTone = progressionTone(log.progression ?? null);
              const sessionLabel = log.generatedSession?.sessionKey
                ? formatSessionKeyLabel(log.generatedSession.sessionKey)
                : null;

              return (
                <Card as="article" key={log.id} tone="inset" padding="sm" elevated={false}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-xs)" }}>
                    <div>
                      <strong style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "-0.2px", color: "var(--color-text)", display: "block" }}>{formatDateTime(log.performedAt)}</strong>
                      <span style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px", display: "block" }}>{exerciseSummary}</span>
                    </div>
                    {sessionLabel || progressionText ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)", justifyContent: "flex-end" }}>
                        {sessionLabel ? (
                          <span className="label label-program label-sm">{sessionLabel}</span>
                        ) : null}
                        {progressionText ? (
                          <span className={progressionBadgeClass(progressionBadgeTone)}>{progressionText}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-xs)", margin: "var(--space-sm) 0", background: "var(--color-surface-container)", borderRadius: 10, padding: "var(--space-sm)" }}>
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>{copy.plansHistory.sets}</div>
                      <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.3px", color: "var(--color-text)" }}>{workSetCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>{copy.plansHistory.time}</div>
                      <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.3px", color: "var(--color-text)" }}>
                        {(() => {
                          const duration = formatDuration(log.durationMinutes);
                          if (duration === null) return locale === "ko" ? "기록 없음" : "No record";
                          return locale === "ko" ? `${duration}분` : `${duration} min`;
                        })()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>{copy.plansHistory.volume}</div>
                      <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.3px", color: "var(--color-text)" }}>{volumeKg > 0 ? `${Math.round(volumeKg)}kg` : "-"}</div>
                    </div>
                  </div>

                  {noteText ? (
                    <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-xs)", marginBottom: "var(--space-xs)" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "2px" }}>{copy.plansHistory.note}</div>
                      <div style={{ fontSize: "13px", color: "var(--color-text)" }}>{noteText}</div>
                    </div>
                  ) : null}

                  <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                    <a
                      className="btn btn-inline-action btn-inline-action-primary"
                      href={`/workout/session/${encodeURIComponent(log.id)}`}
                    >
                      {copy.plansHistory.sessionDetail}
                    </a>
                    <button
                      type="button"
                      className="btn btn-inline-action btn-inline-action-danger"
                      disabled={deletingLogId === log.id}
                      onClick={() => {
                        void deleteLog(log);
                      }}
                    >
                      {deletingLogId === log.id ? copy.plansHistory.deleting : copy.plansHistory.deleteHistory}
                    </button>
                  </div>
                </Card>
              );
            })}

            {nextCursor ? (
              <button
                type="button"
                className="btn btn-secondary btn-full"
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
        </div>
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
