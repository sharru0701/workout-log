"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

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

function MiniLineChart({
  points,
  labels,
  width = 900,
  height = 220,
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
  const pad = 16;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const coords = points.map((v, i) => {
    const x = pad + (points.length === 1 ? w / 2 : (i * w) / (points.length - 1));
    const y = pad + h - ((v - min) / span) * h;
    return { x, y };
  });

  const d = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full rounded-xl border border-neutral-200 bg-white">
      <path d={d} fill="none" stroke="#0f172a" strokeWidth="2.5" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3" fill="#0f172a" />
      ))}
      <text x={pad} y={height - pad} fontSize="11" fill="#525252">
        min {min.toFixed(1)}
      </text>
      <text x={width - pad} y={height - pad} textAnchor="end" fontSize="11" fill="#525252">
        {labels[labels.length - 1]} · max {max.toFixed(1)}
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
  }, [bucket, exercise, exerciseId, planId, rangeQuery]);

  const seriesPoints = useMemo(
    () => (series ? series.series.map((p) => Number(p.tonnage ?? 0)) : []),
    [series],
  );
  const seriesLabels = useMemo(
    () => (series ? series.series.map((p) => p.period) : []),
    [series],
  );

  const selectedPlanName = useMemo(() => plans.find((p) => p.id === planId)?.name ?? null, [plans, planId]);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Stats Dashboard</h1>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs text-neutral-600">plan (compliance filter)</span>
          <select className="rounded-lg border px-3 py-2" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">All plans</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} [{p.type}]
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 md:col-span-1">
          <span className="text-xs text-neutral-600">bucket</span>
          <select
            className="rounded-lg border px-3 py-2"
            value={bucket}
            onChange={(e) => setBucket(e.target.value as "day" | "week" | "month")}
          >
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 md:col-span-1">
          <span className="text-xs text-neutral-600">days (fallback)</span>
          <input
            type="number"
            min={1}
            className="rounded-lg border px-3 py-2"
            value={days}
            onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>

        <div className="md:col-span-1 flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => {
                setFrom("");
                setDays(d);
              }}
            >
              {d}d
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs text-neutral-600">from (optional)</span>
          <input type="date" className="rounded-lg border px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs text-neutral-600">to (optional)</span>
          <input type="date" className="rounded-lg border px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1 md:col-span-1">
          <span className="text-xs text-neutral-600">e1RM exerciseId</span>
          <input className="rounded-lg border px-3 py-2" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1 md:col-span-1">
          <span className="text-xs text-neutral-600">e1RM exercise</span>
          <input className="rounded-lg border px-3 py-2" value={exercise} onChange={(e) => setExercise(e.target.value)} />
        </label>

        <div className="md:col-span-6 text-sm text-neutral-600">
          {loading ? "Loading metrics..." : `Range ready · plan: ${selectedPlanName ?? "All"}`}
        </div>
        {error && <div className="md:col-span-6 text-sm text-red-600">{error}</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-xs text-neutral-600">Best e1RM</div>
          <div className="mt-2 text-2xl font-semibold">{e1rm?.best ? `${e1rm.best.e1rm} kg` : "—"}</div>
          <div className="text-sm text-neutral-600 mt-1">
            {e1rm?.best ? `${e1rm.best.date} · ${e1rm.best.weightKg}×${e1rm.best.reps}` : "No data"}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-xs text-neutral-600">Total Volume</div>
          <div className="mt-2 text-2xl font-semibold">{volume ? formatKg(volume.totals.tonnage) : "—"}</div>
          <div className="text-sm text-neutral-600 mt-1">
            {volume ? `reps ${volume.totals.reps} · sets ${volume.totals.sets}` : "No data"}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-xs text-neutral-600">Compliance</div>
          <div className="mt-2 text-2xl font-semibold">
            {compliance ? `${Math.round(compliance.compliance * 100)}%` : "—"}
          </div>
          <div className="text-sm text-neutral-600 mt-1">
            {compliance ? `planned ${compliance.planned} · done ${compliance.done}` : "No data"}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-xs text-neutral-600">Tracked PR Exercises</div>
          <div className="mt-2 text-2xl font-semibold">{prs?.items.length ?? 0}</div>
          <div className="text-sm text-neutral-600 mt-1">Best e1RM per exercise</div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
        <div className="text-sm font-medium">Last 7 / 30 / 90 days</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {trendWindows.map((t) => {
            const volTrend = trendMeta(t.volume.trend?.tonnageDelta ?? 0, 0);
            const compTrend = trendMeta((t.compliance.trend?.complianceDelta ?? 0) * 100, 1);
            return (
              <div key={t.days} className="rounded-xl border p-3 space-y-2">
                <div className="text-sm font-medium">Last {t.days} days</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">Volume</span>
                  <span className="font-medium">{formatKg(t.volume.totals.tonnage)}</span>
                </div>
                <div className={`text-sm ${volTrend.className}`}>
                  {volTrend.arrow} {volTrend.value} vs prior {t.days}d
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-neutral-600">Compliance</span>
                  <span className="font-medium">{Math.round(t.compliance.compliance * 100)}%</span>
                </div>
                <div className={`text-sm ${compTrend.className}`}>
                  {compTrend.arrow} {compTrend.value}pp vs prior {t.days}d
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-neutral-600">Volume Series</div>
            <div className="text-lg font-semibold">{series ? `${series.bucket} bucket` : "—"}</div>
          </div>
          <div className="text-xs text-neutral-600">points: {seriesPoints.length}</div>
        </div>
        <MiniLineChart points={seriesPoints} labels={seriesLabels} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm text-neutral-600 mb-3">Top exercise volume breakdown</div>
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
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm text-neutral-600 mb-3">Compliance by plan</div>
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
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm text-neutral-600 mb-3">PR tracking (best e1RM by exercise)</div>
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
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm text-neutral-600 mb-3">By exercise totals</div>
        {volume?.byExercise?.length ? (
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
                {volume.byExercise.map((r) => (
                  <tr key={r.exerciseId ?? r.exerciseName} className="border-t">
                    <td className="py-2 pr-4">{r.exerciseName}</td>
                    <td className="py-2 px-4 text-right">{Math.round(r.tonnage)}</td>
                    <td className="py-2 px-4 text-right">{r.reps}</td>
                    <td className="py-2 pl-4 text-right">{r.sets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-neutral-500">No volume rows</div>
        )}
      </div>
    </div>
  );
}
