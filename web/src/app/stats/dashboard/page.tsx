"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "@/lib/api";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AccordionSection } from "@/components/ui/accordion-section";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";

type Plan = {
  id: string;
  name: string;
  type: "SINGLE" | "COMPOSITE" | "MANUAL";
};

type E1RMResp = {
  from: string;
  to: string;
  rangeDays: number;
  exercise: string;
  exerciseId?: string | null;
  best: { date: string; e1rm: number; weightKg: number; reps: number } | null;
  series: Array<{ date: string; e1rm: number; weightKg: number; reps: number }>;
};

type VolumeResp = {
  from: string;
  to: string;
  rangeDays: number;
  totals: { tonnage: number; reps: number; sets: number };
  previousTotals?: { tonnage: number; reps: number; sets: number };
  trend?: { tonnageDelta: number; repsDelta: number; setsDelta: number };
  byExercise: Array<{
    exerciseId?: string | null;
    exerciseName: string;
    tonnage: number;
    reps: number;
    sets: number;
  }>;
};

type VolumeSeriesResp = {
  from: string;
  to: string;
  rangeDays: number;
  bucket: "day" | "week" | "month";
  exerciseId?: string | null;
  exercise?: string | null;
  series: Array<{ period: string; tonnage: number; reps: number; sets: number }>;
  byExercise?: Array<{
    exerciseId: string | null;
    exerciseName: string;
    totals: { tonnage: number; reps: number; sets: number };
    series: Array<{ period: string; tonnage: number; reps: number; sets: number }>;
  }>;
};

type ComplianceResp = {
  from: string;
  to: string;
  rangeDays: number;
  planId: string | null;
  planned: number;
  done: number;
  compliance: number;
  byPlan: Array<{
    planId: string;
    planName: string;
    planned: number;
    done: number;
    compliance: number;
  }>;
  previous?: { planned: number; done: number; compliance: number };
  trend?: { complianceDelta: number; doneDelta: number };
};

type PRsResp = {
  from: string;
  to: string;
  rangeDays: number;
  items: Array<{
    exerciseId: string | null;
    exerciseName: string;
    best: { date: string; e1rm: number; weightKg: number; reps: number };
    latest: { date: string; e1rm: number; weightKg: number; reps: number };
    improvement: number;
  }>;
};

type TrendWindow = {
  days: 7 | 30 | 90;
  volume: VolumeResp;
  compliance: ComplianceResp;
};

const PRESET_RANGES: Array<7 | 30 | 90> = [7, 30, 90];

function toQuery(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function formatKg(v: number) {
  return `${Math.round(v).toLocaleString()} kg`;
}

function trendMeta(delta: number, digits = 1) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) {
    return { arrow: "→", className: "text-neutral-500", value: "0" };
  }
  if (delta > 0) {
    return {
      arrow: "↑",
      className: "text-emerald-700",
      value: `+${delta.toFixed(digits)}`,
    };
  }
  return {
    arrow: "↓",
    className: "text-red-700",
    value: delta.toFixed(digits),
  };
}

function MetricTile({
  label,
  value,
  detail,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: { text: string; className: string };
}) {
  return (
    <article className="motion-card rounded-2xl border bg-white p-4">
      <div className="ui-card-label ui-card-label-caps">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-neutral-600">{detail}</div>
      {trend ? <div className={`mt-2 text-sm ${trend.className}`}>{trend.text}</div> : null}
    </article>
  );
}

function SparklineChart({
  points,
  labels,
  width = 320,
  height = 90,
}: {
  points: number[];
  labels: string[];
  width?: number;
  height?: number;
}) {
  if (!points.length) {
    return (
      <EmptyStateRows
        when
        label="설정 값 없음"
        description="선택한 범위에 표시할 볼륨 시계열 데이터가 없습니다."
      />
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1e-9, max - min);
  const pad = 10;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const coords = points.map((v, i) => {
    const x = pad + (points.length === 1 ? w / 2 : (i * w) / (points.length - 1));
    const y = pad + h - ((v - min) / span) * h;
    return { x, y };
  });

  const d = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  const area = `${d} L ${last.x.toFixed(1)} ${(height - pad).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(height - pad).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full rounded-xl border bg-white text-accent">
      <path d={area} fill="currentColor" fillOpacity="0.12" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx={last.x} cy={last.y} r="3.4" fill="currentColor" />
      <text x={pad} y={height - 4} fontSize="10" fill="currentColor">
        min {Math.round(min)}
      </text>
      <text x={width - pad} y={height - 4} textAnchor="end" fontSize="10" fill="currentColor">
        {labels[labels.length - 1]} · max {Math.round(max)}
      </text>
    </svg>
  );
}

export default function StatsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");

  const [exerciseId, setExerciseId] = useState("");
  const [exercise, setExercise] = useState("Back Squat");

  const [days, setDays] = useState(90);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayDateOnly());
  const [bucket, setBucket] = useState<"day" | "week" | "month">("week");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [e1rm, setE1rm] = useState<E1RMResp | null>(null);
  const [volume, setVolume] = useState<VolumeResp | null>(null);
  const [series, setSeries] = useState<VolumeSeriesResp | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResp | null>(null);
  const [prs, setPrs] = useState<PRsResp | null>(null);
  const [trendWindows, setTrendWindows] = useState<TrendWindow[]>([]);
  const [rangeIndex, setRangeIndex] = useState(2);
  const [refreshTick, setRefreshTick] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const swipeStartX = useRef<number | null>(null);

  const rangeQuery = useMemo(() => {
    if (from) {
      return {
        from,
        to: to || todayDateOnly(),
      };
    }
    return {
      days,
    };
  }, [days, from, to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ items: Plan[] }>("/api/plans");
        if (cancelled) return;
        setPlans(res.items);
        setPlanId((prev) => {
          if (prev && res.items.some((p) => p.id === prev)) return prev;
          return "";
        });
      } catch {
        if (!cancelled) setPlans([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const e1rmPath = `/api/stats/e1rm?${toQuery({
          ...rangeQuery,
          exerciseId: exerciseId || undefined,
          exercise: exerciseId ? undefined : exercise,
        })}`;

        const volumePath = `/api/stats/volume?${toQuery({
          ...rangeQuery,
          comparePrev: 1,
        })}`;

        const seriesPath = `/api/stats/volume-series?${toQuery({
          ...rangeQuery,
          bucket,
          perExercise: 1,
          maxExercises: 8,
        })}`;

        const compliancePath = `/api/stats/compliance?${toQuery({
          ...rangeQuery,
          planId: planId || undefined,
          comparePrev: 1,
        })}`;

        const prsPath = `/api/stats/prs?${toQuery({
          ...rangeQuery,
          limit: 20,
        })}`;

        const trendDays: Array<7 | 30 | 90> = [7, 30, 90];
        const trendCalls = trendDays.map(async (d) => {
          const [v, c] = await Promise.all([
            apiGet<VolumeResp>(`/api/stats/volume?${toQuery({ days: d, comparePrev: 1 })}`),
            apiGet<ComplianceResp>(
              `/api/stats/compliance?${toQuery({
                days: d,
                planId: planId || undefined,
                comparePrev: 1,
              })}`,
            ),
          ]);
          return { days: d, volume: v, compliance: c } satisfies TrendWindow;
        });

        const [e1rmRes, volRes, seriesRes, compRes, prsRes, trendRes] = await Promise.all([
          apiGet<E1RMResp>(e1rmPath),
          apiGet<VolumeResp>(volumePath),
          apiGet<VolumeSeriesResp>(seriesPath),
          apiGet<ComplianceResp>(compliancePath),
          apiGet<PRsResp>(prsPath),
          Promise.all(trendCalls),
        ]);

        if (cancelled) return;
        setE1rm(e1rmRes);
        setVolume(volRes);
        setSeries(seriesRes);
        setCompliance(compRes);
        setPrs(prsRes);
        setTrendWindows(trendRes);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bucket, exercise, exerciseId, planId, rangeQuery, refreshTick]);

  const seriesPoints = useMemo(
    () => (series ? series.series.map((p) => Number(p.tonnage ?? 0)) : []),
    [series],
  );
  const seriesLabels = useMemo(
    () => (series ? series.series.map((p) => p.period) : []),
    [series],
  );

  const selectedPlanName = useMemo(() => plans.find((p) => p.id === planId)?.name ?? null, [plans, planId]);
  const activePresetDays = PRESET_RANGES[rangeIndex];
  const activeTrend = useMemo(
    () => trendWindows.find((t) => t.days === activePresetDays) ?? null,
    [activePresetDays, trendWindows],
  );
  const activeVolumeTrend = trendMeta(activeTrend?.volume.trend?.tonnageDelta ?? 0, 0);
  const activeComplianceTrend = trendMeta((activeTrend?.compliance.trend?.complianceDelta ?? 0) * 100, 1);
  const volumeTrend = trendMeta(volume?.trend?.tonnageDelta ?? 0, 0);
  const complianceTrend = trendMeta((compliance?.trend?.complianceDelta ?? 0) * 100, 1);
  const refreshStatsPage = useCallback(async () => {
    setRefreshTick((prev) => prev + 1);
  }, []);
  const pullToRefresh = usePullToRefresh({ onRefresh: refreshStatsPage });

  useEffect(() => {
    if (from) return;
    const idx = PRESET_RANGES.indexOf(days as 7 | 30 | 90);
    if (idx >= 0) setRangeIndex(idx);
  }, [days, from]);

  function setPresetRange(next: 7 | 30 | 90) {
    setFrom("");
    setDays(next);
  }

  function resetFilters() {
    setPlanId("");
    setExerciseId("");
    setExercise("Back Squat");
    setFrom("");
    setTo(todayDateOnly());
    setBucket("week");
    setRangeIndex(2);
    setDays(90);
  }

  function onRangeSwipeStart(e: React.TouchEvent<HTMLDivElement>) {
    swipeStartX.current = e.changedTouches[0]?.clientX ?? null;
  }

  function onRangeSwipeEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (swipeStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? swipeStartX.current;
    const delta = endX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) < 36) return;

    const direction = delta < 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(PRESET_RANGES.length - 1, rangeIndex + direction));
    if (nextIndex === rangeIndex) return;

    setRangeIndex(nextIndex);
    setPresetRange(PRESET_RANGES[nextIndex]);
  }

  return (
    <div
      className="native-page native-page-enter tab-screen tab-screen-wide momentum-scroll"
      {...pullToRefresh.bind}
    >
      <div className="pull-refresh-indicator">
        {pullToRefresh.isRefreshing
          ? "통계 새로고침 중..."
          : pullToRefresh.pullOffset > 0
            ? "당겨서 새로고침"
            : ""}
      </div>
      <div className="tab-screen-header">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="tab-screen-title">통계 대시보드</h1>
            <p className="tab-screen-caption">{`조회 범위 준비 · 플랜: ${selectedPlanName ?? "전체 플랜"}`}</p>
          </div>
          <button className="haptic-tap rounded-xl border px-4 py-2 text-sm font-semibold" onClick={() => setFiltersOpen(true)}>
            필터
          </button>
        </div>
      </div>

      <section className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
        <div className="ios-section-heading">기본 흐름</div>
        <p className="text-sm text-neutral-600">1) 7/30/90일 선택 2) KPI 카드 확인 3) 필요 시 필터 조정</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESET_RANGES.map((d, idx) => (
            <button
              key={`core-${d}`}
              className={`haptic-tap rounded-xl border px-3 py-3 text-sm font-semibold ${
                idx === rangeIndex ? "bg-bg-elevated" : ""
              }`}
              onClick={() => {
                setRangeIndex(idx);
                setPresetRange(d);
              }}
            >
              {d}일
            </button>
          ))}
          <button className="haptic-tap rounded-xl border px-3 py-3 text-sm font-semibold col-span-2 sm:col-span-1" onClick={() => setFiltersOpen(true)}>
            필터
          </button>
        </div>
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="ui-card-label ui-card-label-caps">활성 필터</div>
            <div className="mt-1 text-sm text-neutral-600">플랜/범위/운동 조건을 세밀하게 바꿀 때만 필터를 사용하세요.</div>
          </div>
          <button className="haptic-tap rounded-xl border px-3 py-2 text-sm font-medium" onClick={() => setFiltersOpen(true)}>
            수정
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border px-3 py-2">플랜: {selectedPlanName ?? "전체 플랜"}</div>
          <div className="rounded-lg border px-3 py-2">집계 단위: {bucket}</div>
          <div className="rounded-lg border px-3 py-2">범위: {from ? `${from} → ${to || todayDateOnly()}` : `${days}일`}</div>
          <div className="rounded-lg border px-3 py-2">운동: {exerciseId || exercise || "—"}</div>
        </div>
        <LoadingStateRows
          active={loading}
          label="불러오는 중"
          description="통계 지표를 계산하고 있습니다."
        />
        <ErrorStateRows
          message={error}
          onRetry={() => {
            setError(null);
            setRefreshTick((prev) => prev + 1);
          }}
        />
      </section>

      <section
        className="motion-card rounded-2xl border bg-white p-4 space-y-3 touch-pan-y ui-height-animate"
        onTouchStart={onRangeSwipeStart}
        onTouchEnd={onRangeSwipeEnd}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="ui-card-label ui-card-label-caps">범위</div>
            <div className="text-lg font-semibold">{activePresetDays}일</div>
          </div>
          <div className="ui-card-label">버튼으로 선택하고 필요 시 스와이프하세요.</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PRESET_RANGES.map((d, idx) => (
            <button
              key={d}
              className={`haptic-tap rounded-xl border px-3 py-3 text-base font-semibold ${
                idx === rangeIndex ? "bg-bg-elevated" : ""
              }`}
              onClick={() => {
                setRangeIndex(idx);
                setPresetRange(d);
              }}
            >
              {d}d
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border p-3">
            <div className="text-neutral-600">볼륨 ({activePresetDays}d)</div>
            <div className="text-lg font-semibold">{activeTrend ? formatKg(activeTrend.volume.totals.tonnage) : "—"}</div>
            {activeTrend ? (
              <div className={activeVolumeTrend.className}>
                {activeVolumeTrend.arrow} {activeVolumeTrend.value}
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-neutral-600">준수율 ({activePresetDays}d)</div>
            <div className="text-lg font-semibold">
              {activeTrend ? `${Math.round(activeTrend.compliance.compliance * 100)}%` : "—"}
            </div>
            {activeTrend ? (
              <div className={activeComplianceTrend.className}>
                {activeComplianceTrend.arrow} {activeComplianceTrend.value}pp
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricTile
          label="e1RM"
          value={e1rm?.best ? `${e1rm.best.e1rm} kg` : "—"}
          detail={e1rm?.best ? `${e1rm.best.date} · ${e1rm.best.weightKg}×${e1rm.best.reps}` : "데이터 없음"}
        />
        <MetricTile
          label="볼륨"
          value={volume ? formatKg(volume.totals.tonnage) : "—"}
          detail={volume ? `반복 ${volume.totals.reps} · 세트 ${volume.totals.sets}` : "데이터 없음"}
          trend={
            volume
              ? {
                  text: `${volumeTrend.arrow} ${volumeTrend.value}`,
                  className: volumeTrend.className,
                }
              : undefined
          }
        />
        <MetricTile
          label="준수율"
          value={compliance ? `${Math.round(compliance.compliance * 100)}%` : "—"}
          detail={compliance ? `계획 ${compliance.planned} · 완료 ${compliance.done}` : "데이터 없음"}
          trend={
            compliance
              ? {
                  text: `${complianceTrend.arrow} ${complianceTrend.value}pp`,
                  className: complianceTrend.className,
                }
              : undefined
          }
        />
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-neutral-600">볼륨 추세선</div>
            <div className="text-lg font-semibold">{series ? `${series.bucket} 단위` : "—"}</div>
          </div>
          <div className="ui-card-label">포인트: {seriesPoints.length}</div>
        </div>
        <SparklineChart points={seriesPoints} labels={seriesLabels} />
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 ui-height-animate">
        <AccordionSection
          title="운동별 볼륨 분해"
          description="운동별 톤수와 세트 분포를 확인합니다."
          summarySlot={<span className="ui-card-label">{series?.byExercise?.length ?? 0}개</span>}
        >
          {series?.byExercise?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm ios-data-table">
                <thead className="text-neutral-600">
                  <tr>
                    <th className="text-left py-2 pr-4">운동</th>
                    <th className="text-right py-2 px-4">톤수</th>
                    <th className="text-right py-2 px-4">반복</th>
                    <th className="text-right py-2 pl-4">세트</th>
                  </tr>
                </thead>
                <tbody>
                  {series.byExercise.map((r) => (
                    <tr key={r.exerciseId ?? r.exerciseName} className="border-t">
                      <td className="py-2 pr-4">{r.exerciseName}</td>
                      <td className="py-2 px-4 text-right">{Math.round(r.totals.tonnage)}</td>
                      <td className="py-2 px-4 text-right">{r.totals.reps}</td>
                      <td className="py-2 pl-4 text-right">{r.totals.sets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyStateRows
              when
              label="설정 값 없음"
              description="기간 내 운동별 볼륨 데이터가 없습니다."
            />
          )}
        </AccordionSection>
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 ui-height-animate">
        <AccordionSection
          title="플랜별 준수율"
          description="계획 세션 대비 완료 수를 비교합니다."
          summarySlot={<span className="ui-card-label">{compliance?.byPlan?.length ?? 0}개 플랜</span>}
        >
          {compliance?.byPlan?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm ios-data-table">
                <thead className="text-neutral-600">
                  <tr>
                    <th className="text-left py-2 pr-4">플랜</th>
                    <th className="text-right py-2 px-4">계획</th>
                    <th className="text-right py-2 px-4">완료</th>
                    <th className="text-right py-2 pl-4">준수율</th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.byPlan.map((r) => (
                    <tr key={r.planId} className="border-t">
                      <td className="py-2 pr-4">{r.planName}</td>
                      <td className="py-2 px-4 text-right">{r.planned}</td>
                      <td className="py-2 px-4 text-right">{r.done}</td>
                      <td className="py-2 pl-4 text-right">{Math.round(r.compliance * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyStateRows
              when
              label="설정 값 없음"
              description="기간 내 준수율 데이터가 없습니다."
            />
          )}
        </AccordionSection>
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 ui-height-animate">
        <AccordionSection
          title="PR 추적"
          description="운동별 최고/최신 e1RM을 비교합니다."
          summarySlot={<span className="ui-card-label">{prs?.items?.length ?? 0}건</span>}
        >
          {prs?.items?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm ios-data-table">
                <thead className="text-neutral-600">
                  <tr>
                    <th className="text-left py-2 pr-4">운동</th>
                    <th className="text-right py-2 px-4">최고 e1RM</th>
                    <th className="text-right py-2 px-4">최신 e1RM</th>
                    <th className="text-right py-2 px-4">향상</th>
                    <th className="text-right py-2 pl-4">최고 기록일</th>
                  </tr>
                </thead>
                <tbody>
                  {prs.items.map((r) => {
                    const imp = trendMeta(r.improvement, 1);
                    return (
                      <tr key={r.exerciseId ?? r.exerciseName} className="border-t">
                        <td className="py-2 pr-4">{r.exerciseName}</td>
                        <td className="py-2 px-4 text-right">{r.best.e1rm}</td>
                        <td className="py-2 px-4 text-right">{r.latest.e1rm}</td>
                        <td className={`py-2 px-4 text-right ${imp.className}`}>
                          {imp.arrow} {imp.value}
                        </td>
                        <td className="py-2 pl-4 text-right">{r.best.date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyStateRows
              when
              label="설정 값 없음"
              description="기간 내 PR 기록이 없습니다."
            />
          )}
        </AccordionSection>
      </section>

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="통계 필터"
        description="범위를 정하고 추세 구간을 비교합니다."
      >
        <div className="space-y-4 pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button className="haptic-tap rounded-xl border px-3 py-3 text-sm font-medium" onClick={resetFilters}>
              기본값으로 재설정
            </button>
            <button className="haptic-tap rounded-xl border px-3 py-3 text-sm font-medium" onClick={() => setFiltersOpen(false)}>
              적용하고 닫기
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">플랜</span>
              <select className="rounded-lg border px-3 py-3 text-base" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">전체 플랜</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.type}]
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="ui-card-label">집계 단위</span>
              <select
                className="rounded-lg border px-3 py-3 text-base"
                value={bucket}
                onChange={(e) => setBucket(e.target.value as "day" | "week" | "month")}
              >
                <option value="day">일</option>
                <option value="week">주</option>
                <option value="month">월</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">시작일(선택)</span>
              <input type="date" className="rounded-lg border px-3 py-3 text-base" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">종료일(선택)</span>
              <input type="date" className="rounded-lg border px-3 py-3 text-base" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>

          <div className="rounded-xl border px-3 py-2 text-xs text-neutral-600">
            고급 e1RM 범위(선택): 정확히 지정할 때는 `exerciseId`, 이름 기준으로 찾을 때는 `exercise`를 사용합니다.
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">e1RM exerciseId</span>
              <input className="rounded-lg border px-3 py-3 text-base" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="ui-card-label">e1RM exercise</span>
              <input className="rounded-lg border px-3 py-3 text-base" value={exercise} onChange={(e) => setExercise(e.target.value)} />
            </label>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
