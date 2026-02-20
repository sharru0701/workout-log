import React from "react";

type E1RMResp = {
  exercise: string;
  best: { date: string; e1rm: number; weightKg: number; reps: number } | null;
  series: Array<{ date: string; e1rm: number; weightKg: number; reps: number }>;
};

type VolumeResp = {
  rangeDays: number;
  totals: { tonnage: number; reps: number; sets: number };
  byExercise: Array<{ exerciseName: string; tonnage: number; reps: number; sets: number }>;
};

type VolumeSeriesResp = {
  rangeDays: number;
  bucket: "day" | "week" | "month";
  series: Array<{ period: string; tonnage: number; reps: number; sets: number }>;
};

type ComplianceResp = {
  rangeDays: number;
  planId: string | null;
  planned: number;
  done: number;
  compliance: number;
};

function toQuery(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

function MiniLineChart({
  points,
  width = 640,
  height = 160,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (!points.length) return <div className="text-sm text-neutral-500">No data</div>;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1e-9, max - min);

  const pad = 8;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const coords = points.map((v, i) => {
    const x = pad + (points.length === 1 ? w / 2 : (i * w) / (points.length - 1));
    const y = pad + h - ((v - min) / span) * h;
    return { x, y };
  });

  const d = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg width={width} height={height} className="rounded-xl border border-neutral-200 bg-white">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3" fill="currentColor" />
      ))}
      <text x={pad} y={height - pad} fontSize="11" fill="currentColor" opacity="0.6">
        min {min.toFixed(1)} / max {max.toFixed(1)}
      </text>
    </svg>
  );
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const userId = typeof sp.userId === "string" ? sp.userId : "dev";
  const exercise = typeof sp.exercise === "string" ? sp.exercise : "Back Squat";
  const days = typeof sp.days === "string" ? Number(sp.days) : 365;
  const bucket = typeof sp.bucket === "string" ? (sp.bucket as "day" | "week" | "month") : "day";
  const planId = typeof sp.planId === "string" ? sp.planId : "";

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const e1rmUrl = `${base}/api/stats/e1rm?${toQuery({ userId, exercise, days })}`;
  const volUrl = `${base}/api/stats/volume?${toQuery({ userId, days })}`;
  const seriesUrl = `${base}/api/stats/volume-series?${toQuery({ userId, days, bucket })}`;
  const compUrl = `${base}/api/stats/compliance?${toQuery({ userId, days, planId: planId || undefined })}`;

  const [e1rm, vol, series, comp] = await Promise.all([
    fetch(e1rmUrl, { cache: "no-store" }).then((r) => r.json()) as Promise<E1RMResp | { error: string }>,
    fetch(volUrl, { cache: "no-store" }).then((r) => r.json()) as Promise<VolumeResp | { error: string }>,
    fetch(seriesUrl, { cache: "no-store" }).then((r) => r.json()) as Promise<VolumeSeriesResp | { error: string }>,
    fetch(compUrl, { cache: "no-store" }).then((r) => r.json()) as Promise<ComplianceResp | { error: string }>,
  ]);

  const isErr = (x: any): x is { error: string } => x && typeof x.error === "string";

  const seriesPoints =
    !isErr(series) ? series.series.map((p) => Number(p.tonnage ?? 0)) : [];

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Stats</h1>

      {/* Controls */}
      <form className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-2xl border border-neutral-200 p-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-600">userId</span>
          <input name="userId" defaultValue={userId} className="rounded-lg border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs text-neutral-600">exercise (for e1RM)</span>
          <input name="exercise" defaultValue={exercise} className="rounded-lg border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-600">days</span>
          <input name="days" type="number" defaultValue={days} className="rounded-lg border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-600">bucket</span>
          <select name="bucket" defaultValue={bucket} className="rounded-lg border px-3 py-2">
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 md:col-span-5">
          <span className="text-xs text-neutral-600">planId (optional, for compliance)</span>
          <input name="planId" defaultValue={planId} className="rounded-lg border px-3 py-2" />
        </label>

        <div className="md:col-span-5 flex gap-2">
          <button type="submit" className="rounded-xl border px-4 py-2 font-medium">
            Refresh
          </button>
          <a
            className="rounded-xl border px-4 py-2 font-medium"
            href={`/api/stats/volume-series?${toQuery({ userId, days, bucket })}`}
          >
            Open volume-series JSON
          </a>
        </div>
      </form>

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-neutral-200 p-4 bg-white">
          <div className="text-sm text-neutral-600">e1RM (Epley)</div>
          {isErr(e1rm) ? (
            <div className="mt-2 text-sm text-red-600">{e1rm.error}</div>
          ) : (
            <div className="mt-2">
              <div className="text-xl font-semibold">{e1rm.best?.e1rm ?? "—"} kg</div>
              <div className="text-sm text-neutral-600">
                best: {e1rm.best?.date ?? "—"} ({e1rm.best?.weightKg ?? "—"}×{e1rm.best?.reps ?? "—"})
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4 bg-white">
          <div className="text-sm text-neutral-600">Volume totals</div>
          {isErr(vol) ? (
            <div className="mt-2 text-sm text-red-600">{vol.error}</div>
          ) : (
            <div className="mt-2 space-y-1">
              <div className="text-xl font-semibold">{vol.totals.tonnage} kg</div>
              <div className="text-sm text-neutral-600">reps {vol.totals.reps} · sets {vol.totals.sets}</div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4 bg-white">
          <div className="text-sm text-neutral-600">Compliance</div>
          {isErr(comp) ? (
            <div className="mt-2 text-sm text-red-600">{comp.error}</div>
          ) : (
            <div className="mt-2 space-y-1">
              <div className="text-xl font-semibold">{Math.round(comp.compliance * 100)}%</div>
              <div className="text-sm text-neutral-600">
                planned {comp.planned} · done {comp.done}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-neutral-200 p-4 bg-white space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-sm text-neutral-600">Volume series</div>
            <div className="text-lg font-semibold">
              bucket: {isErr(series) ? "—" : series.bucket}
            </div>
          </div>
          <div className="text-xs text-neutral-600">
            points: {seriesPoints.length}
          </div>
        </div>

        {isErr(series) ? (
          <div className="text-sm text-red-600">{series.error}</div>
        ) : (
          <MiniLineChart points={seriesPoints} />
        )}
      </div>

      {/* Breakdown table */}
      <div className="rounded-2xl border border-neutral-200 p-4 bg-white">
        <div className="text-sm text-neutral-600 mb-3">By exercise</div>
        {isErr(vol) ? (
          <div className="text-sm text-red-600">{vol.error}</div>
        ) : (
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
                {vol.byExercise.map((r) => (
                  <tr key={r.exerciseName} className="border-t">
                    <td className="py-2 pr-4">{r.exerciseName}</td>
                    <td className="py-2 px-4 text-right">{r.tonnage}</td>
                    <td className="py-2 px-4 text-right">{r.reps}</td>
                    <td className="py-2 pl-4 text-right">{r.sets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}