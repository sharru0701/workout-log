"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";

type PlannedRow = {
  exerciseName: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe: number;
};

type PerformedRow = {
  id: string;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe: number;
  isExtra: boolean;
  meta?: any;
};

type LogItem = {
  id: string;
  userId: string;
  planId: string | null;
  generatedSessionId: string | null;
  performedAt: string;
  durationMinutes: number | null;
  notes: string | null;
  sets: PerformedRow[];
  generatedSession: {
    id: string;
    sessionKey: string;
    snapshot: any;
    updatedAt: string;
  } | null;
};

function plannedRowsFromSnapshot(snapshot: any): PlannedRow[] {
  const planned = Array.isArray(snapshot?.exercises) ? snapshot.exercises : [];
  const rows: PlannedRow[] = [];

  for (const ex of planned) {
    const name = String(ex?.exerciseName ?? "").trim();
    if (!name) continue;

    const sets = Array.isArray(ex?.sets) && ex.sets.length > 0 ? ex.sets : [{}];
    sets.forEach((s: any, idx: number) => {
      rows.push({
        exerciseName: name,
        setNumber: idx + 1,
        reps: Number(s?.reps ?? 0) || 0,
        weightKg: Number(s?.targetWeightKg ?? 0) || 0,
        rpe: Number(s?.rpe ?? 0) || 0,
      });
    });
  }

  return rows;
}

export default function WorkoutSessionDetailPage() {
  const params = useParams<{ logId: string }>();
  const logId = String(params?.logId ?? "");

  const [item, setItem] = useState<LogItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!logId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiGet<{ item: LogItem }>(`/api/logs/${encodeURIComponent(logId)}`);
        if (!cancelled) setItem(res.item);
      } catch (e: any) {
        if (!cancelled) {
          setItem(null);
          setError(e?.message ?? "Failed to load session detail");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [logId]);

  const plannedRows = useMemo(() => plannedRowsFromSnapshot(item?.generatedSession?.snapshot), [item]);

  const compareRows = useMemo(() => {
    const performedMap = new Map<string, PerformedRow>();
    for (const s of item?.sets ?? []) {
      const key = `${s.exerciseName.trim().toLowerCase()}#${s.setNumber}`;
      if (!performedMap.has(key)) performedMap.set(key, s);
    }

    const rows = plannedRows.map((p) => {
      const key = `${p.exerciseName.trim().toLowerCase()}#${p.setNumber}`;
      const actual = performedMap.get(key) ?? null;
      return {
        exerciseName: p.exerciseName,
        setNumber: p.setNumber,
        planned: p,
        actual,
      };
    });

    const plannedKeys = new Set(rows.map((r) => `${r.exerciseName.trim().toLowerCase()}#${r.setNumber}`));
    const extras = (item?.sets ?? [])
      .filter((s) => !plannedKeys.has(`${s.exerciseName.trim().toLowerCase()}#${s.setNumber}`))
      .map((s) => ({
        exerciseName: s.exerciseName,
        setNumber: s.setNumber,
        planned: null,
        actual: s,
      }));

    return [...rows, ...extras];
  }, [item, plannedRows]);

  const stats = useMemo(() => {
    let matched = 0;
    let missing = 0;
    let extra = 0;
    for (const row of compareRows) {
      if (!row.planned && row.actual) extra += 1;
      else if (row.planned && !row.actual) missing += 1;
      else if (row.planned && row.actual) matched += 1;
    }
    return { matched, missing, extra };
  }, [compareRows]);

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Session Detail</h1>

      <div className="rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <a
          className="rounded-xl border px-4 py-2 text-center font-medium md:col-span-2"
          href="/workout/today"
        >
          Back to today
        </a>

        <button
          className="rounded-xl border px-4 py-2 font-medium"
          onClick={() => {
            setItem(null);
            setError(null);
            setLoading(true);
            apiGet<{ item: LogItem }>(`/api/logs/${encodeURIComponent(logId)}`)
              .then((res) => setItem(res.item))
              .catch((e: any) => setError(e?.message ?? "Failed to reload"))
              .finally(() => setLoading(false));
          }}
        >
          Reload
        </button>
      </div>

      {loading && <div className="text-sm text-neutral-600">Loading...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {item && (
        <>
          <div className="rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-neutral-600">Log ID</div>
              <div className="font-mono break-all">{item.id}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-600">Performed At</div>
              <div>{new Date(item.performedAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-600">Session Key</div>
              <div>{item.generatedSession?.sessionKey ?? "(manual / no generated session)"}</div>
            </div>
          </div>

          <div className="rounded-2xl border p-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-neutral-600">Matched</div>
              <div className="text-lg font-semibold">{stats.matched}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-600">Missing</div>
              <div className="text-lg font-semibold">{stats.missing}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-600">Extra</div>
              <div className="text-lg font-semibold">{stats.extra}</div>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="font-medium mb-2">Planned vs Performed</div>
            {compareRows.length === 0 ? (
              <div className="text-sm text-neutral-600">No rows to compare.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-neutral-600">
                    <tr>
                      <th className="text-left py-2 pr-3">Exercise</th>
                      <th className="text-right py-2 px-3">Set#</th>
                      <th className="text-right py-2 px-3">Planned</th>
                      <th className="text-right py-2 px-3">Performed</th>
                      <th className="text-right py-2 pl-3">Diff</th>
                      <th className="text-right py-2 pl-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((r, idx) => {
                      const plannedText = r.planned
                        ? `${r.planned.reps || "-"} reps @ ${r.planned.weightKg || 0}kg`
                        : "-";
                      const performedText = r.actual
                        ? `${r.actual.reps || "-"} reps @ ${r.actual.weightKg || 0}kg`
                        : "-";

                      const repsDiff = (r.actual?.reps ?? 0) - (r.planned?.reps ?? 0);
                      const kgDiff = (r.actual?.weightKg ?? 0) - (r.planned?.weightKg ?? 0);
                      const diffText = r.planned && r.actual ? `${repsDiff >= 0 ? "+" : ""}${repsDiff} reps, ${kgDiff >= 0 ? "+" : ""}${kgDiff}kg` : "-";

                      const status = !r.planned
                        ? "extra"
                        : !r.actual
                          ? "missing"
                          : r.actual.meta?.completed === true || r.actual.isExtra === false
                            ? "done"
                            : "logged";

                      return (
                        <tr key={`${r.exerciseName}-${r.setNumber}-${idx}`} className="border-t">
                          <td className="py-1 pr-3">{r.exerciseName}</td>
                          <td className="py-1 px-3 text-right">{r.setNumber}</td>
                          <td className="py-1 px-3 text-right">{plannedText}</td>
                          <td className="py-1 px-3 text-right">{performedText}</td>
                          <td className="py-1 pl-3 text-right">{diffText}</td>
                          <td className="py-1 pl-3 text-right">{status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
