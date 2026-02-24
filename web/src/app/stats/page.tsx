"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "@/lib/api";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AccordionSection } from "@/components/ui/accordion-section";

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
      <div className="text-xs uppercase tracking-[0.08em] text-neutral-600">{label}</div>
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
  if (!points.length) return <div className="text-sm text-neutral-500">No data</div>;

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
          ? "Refreshing stats..."
          : pullToRefresh.pullOffset > 0
            ? "Pull to refresh"
            : ""}
      </div>
      <div className="tab-screen-header">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="tab-screen-title">Stats Dashboard</h1>
            <p className="tab-screen-caption">
              {loading ? "Loading metrics..." : `Range ready · plan: ${selectedPlanName ?? "All plans"}`}
            </p>
          </div>
          <button className="haptic-tap rounded-xl border px-4 py-2 text-sm font-semibold" onClick={() => setFiltersOpen(true)}>
            Filters
          </button>
        </div>
      </div>

      <section className="motion-card rounded-2xl border bg-white p-4 space-y-3 ui-height-animate">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-neutral-600">Active filters</div>
            <div className="mt-1 text-sm text-neutral-600">Tap Filters to edit range, plan and exercise scope.</div>
          </div>
          <button className="haptic-tap rounded-xl border px-3 py-2 text-sm font-medium" onClick={() => setFiltersOpen(true)}>
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border px-3 py-2">Plan: {selectedPlanName ?? "All plans"}</div>
          <div className="rounded-lg border px-3 py-2">Bucket: {bucket}</div>
          <div className="rounded-lg border px-3 py-2">Range: {from ? `${from} → ${to || todayDateOnly()}` : `${days} days`}</div>
          <div className="rounded-lg border px-3 py-2">Exercise: {exerciseId || exercise || "—"}</div>
        </div>
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </section>

      <section
        className="motion-card rounded-2xl border bg-white p-4 space-y-3 touch-pan-y ui-height-animate"
        onTouchStart={onRangeSwipeStart}
        onTouchEnd={onRangeSwipeEnd}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-neutral-600">Range</div>
            <div className="text-lg font-semibold">{activePresetDays} days</div>
          </div>
          <div className="text-xs text-neutral-600">Swipe left/right</div>
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
            <div className="text-neutral-600">Volume ({activePresetDays}d)</div>
            <div className="text-lg font-semibold">{activeTrend ? formatKg(activeTrend.volume.totals.tonnage) : "—"}</div>
            {activeTrend ? (
              <div className={activeVolumeTrend.className}>
                {activeVolumeTrend.arrow} {activeVolumeTrend.value}
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-neutral-600">Compliance ({activePresetDays}d)</div>
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
          detail={e1rm?.best ? `${e1rm.best.date} · ${e1rm.best.weightKg}×${e1rm.best.reps}` : "No data"}
        />
        <MetricTile
          label="Volume"
          value={volume ? formatKg(volume.totals.tonnage) : "—"}
          detail={volume ? `reps ${volume.totals.reps} · sets ${volume.totals.sets}` : "No data"}
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
          label="Compliance"
          value={compliance ? `${Math.round(compliance.compliance * 100)}%` : "—"}
          detail={compliance ? `planned ${compliance.planned} · done ${compliance.done}` : "No data"}
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
            <div className="text-sm text-neutral-600">Volume Sparkline</div>
            <div className="text-lg font-semibold">{series ? `${series.bucket} bucket` : "—"}</div>
          </div>
          <div className="text-xs text-neutral-600">points: {seriesPoints.length}</div>
        </div>
        <SparklineChart points={seriesPoints} labels={seriesLabels} />
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 ui-height-animate">
        <AccordionSection
          title="Top exercise volume breakdown"
          description="Per-exercise tonnage and set distribution"
          summarySlot={<span className="text-xs text-neutral-600">{series?.byExercise?.length ?? 0} items</span>}
        >
          {series?.byExercise?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-neutral-600">
                  <tr>
                    <th className="text-left py-2 pr-4">Exercise</th>
                    <th className="text-right py-2 px-4">Tonnage</th>
                    <th className="text-right py-2 px-4">Reps</th>
                    <th className="text-right py-2 pl-4">Sets</th>
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
            <div className="text-sm text-neutral-500">No per-exercise series data</div>
          )}
        </AccordionSection>
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 ui-height-animate">
        <AccordionSection
          title="Compliance by plan"
          description="Planned sessions versus completion counts"
          summarySlot={<span className="text-xs text-neutral-600">{compliance?.byPlan?.length ?? 0} plans</span>}
        >
          {compliance?.byPlan?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-neutral-600">
                  <tr>
                    <th className="text-left py-2 pr-4">Plan</th>
                    <th className="text-right py-2 px-4">Planned</th>
                    <th className="text-right py-2 px-4">Done</th>
                    <th className="text-right py-2 pl-4">Compliance</th>
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
            <div className="text-sm text-neutral-500">No compliance data in this range</div>
          )}
        </AccordionSection>
      </section>

      <section className="motion-card rounded-2xl border bg-white p-4 ui-height-animate">
        <AccordionSection
          title="PR tracking"
          description="Best versus latest e1RM by exercise"
          summarySlot={<span className="text-xs text-neutral-600">{prs?.items?.length ?? 0} records</span>}
        >
          {prs?.items?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-neutral-600">
                  <tr>
                    <th className="text-left py-2 pr-4">Exercise</th>
                    <th className="text-right py-2 px-4">Best e1RM</th>
                    <th className="text-right py-2 px-4">Latest e1RM</th>
                    <th className="text-right py-2 px-4">Improvement</th>
                    <th className="text-right py-2 pl-4">Best date</th>
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
            <div className="text-sm text-neutral-500">No PR data</div>
          )}
        </AccordionSection>
      </section>

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Stats Filters"
        description="Scope and compare trend windows."
      >
        <div className="space-y-4 pb-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">Plan</span>
              <select className="rounded-lg border px-3 py-3 text-base" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">All plans</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.type}]
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">Bucket</span>
              <select
                className="rounded-lg border px-3 py-3 text-base"
                value={bucket}
                onChange={(e) => setBucket(e.target.value as "day" | "week" | "month")}
              >
                <option value="day">day</option>
                <option value="week">week</option>
                <option value="month">month</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">From (optional)</span>
              <input type="date" className="rounded-lg border px-3 py-3 text-base" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">To (optional)</span>
              <input type="date" className="rounded-lg border px-3 py-3 text-base" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">e1RM exerciseId</span>
              <input className="rounded-lg border px-3 py-3 text-base" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">e1RM exercise</span>
              <input className="rounded-lg border px-3 py-3 text-base" value={exercise} onChange={(e) => setExercise(e.target.value)} />
            </label>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
