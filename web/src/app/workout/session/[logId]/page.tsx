"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";

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
    <div className="native-page native-page-enter tab-screen tab-screen-wide momentum-scroll">
      <header className="tab-screen-header">
        <h1 className="tab-screen-title">Session Detail</h1>
        <p className="tab-screen-caption">저장된 운동의 계획/수행 세트를 비교합니다.</p>
      </header>

      <div className="motion-card rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <a
          className="haptic-tap rounded-xl border px-4 py-2 text-center font-medium md:col-span-2"
          href="/workout/today"
        >
          Back to today
        </a>

        <button
          className="haptic-tap rounded-xl border px-4 py-2 font-medium"
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

      <LoadingStateRows
        active={loading}
        label="불러오는 중"
        description="세션 상세 정보를 조회하고 있습니다."
      />
      <ErrorStateRows
        message={error}
        onRetry={() => {
          setItem(null);
          setError(null);
          setLoading(true);
          apiGet<{ item: LogItem }>(`/api/logs/${encodeURIComponent(logId)}`)
            .then((res) => setItem(res.item))
            .catch((e: any) => setError(e?.message ?? "다시 불러오기에 실패했습니다."))
            .finally(() => setLoading(false));
        }}
      />

      {item && (
        <>
          <div className="motion-card rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="ui-card-label">로그 ID</div>
              <div className="font-mono break-all">{item.id}</div>
            </div>
            <div>
              <div className="ui-card-label">수행 시각</div>
              <div>{new Date(item.performedAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="ui-card-label">세션 키</div>
              <div>{item.generatedSession?.sessionKey ?? "(수동 / 생성 세션 없음)"}</div>
            </div>
          </div>

          <div className="motion-card rounded-2xl border p-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="ui-card-label">일치</div>
              <div className="text-lg font-semibold">{stats.matched}</div>
            </div>
            <div>
              <div className="ui-card-label">누락</div>
              <div className="text-lg font-semibold">{stats.missing}</div>
            </div>
            <div>
              <div className="ui-card-label">추가</div>
              <div className="text-lg font-semibold">{stats.extra}</div>
            </div>
          </div>

          <div className="motion-card rounded-2xl border p-4">
            <div className="ios-section-heading mb-2">계획 대비 수행</div>
            {compareRows.length === 0 ? (
              <EmptyStateRows
                when
                label="설정 값 없음"
                description="비교할 계획/수행 세트가 없습니다."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm ios-data-table">
                  <thead className="text-neutral-600">
                    <tr>
                      <th className="text-left py-2 pr-3">운동</th>
                      <th className="text-right py-2 px-3">세트</th>
                      <th className="text-right py-2 px-3">계획</th>
                      <th className="text-right py-2 px-3">수행</th>
                      <th className="text-right py-2 pl-3">차이</th>
                      <th className="text-right py-2 pl-3">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((r, idx) => {
                      const plannedText = r.planned
                        ? `${r.planned.reps || "-"}회 @ ${r.planned.weightKg || 0}kg`
                        : "-";
                      const performedText = r.actual
                        ? `${r.actual.reps || "-"}회 @ ${r.actual.weightKg || 0}kg`
                        : "-";

                      const repsDiff = (r.actual?.reps ?? 0) - (r.planned?.reps ?? 0);
                      const kgDiff = (r.actual?.weightKg ?? 0) - (r.planned?.weightKg ?? 0);
                      const diffText = r.planned && r.actual ? `${repsDiff >= 0 ? "+" : ""}${repsDiff}회, ${kgDiff >= 0 ? "+" : ""}${kgDiff}kg` : "-";

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
