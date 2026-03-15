"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { APP_ROUTES } from "@/lib/app-routes";
import { formatExerciseLoadLabel, computeExternalLoadFromTotalKg } from "@/lib/bodyweight-load";
import { progressionTone, summarizeProgression, type ProgressionSummaryPayload } from "@/lib/progression/summary";
import { formatSessionKeyLabel } from "@/lib/session-key";
import { fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { readWorkoutPreferences, toDefaultWorkoutPreferences } from "@/lib/settings/workout-preferences";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows, NoticeStateRows } from "@/components/ui/settings-state";
import { Card } from "@/components/ui/card";

type PlannedRow = {
  exerciseName: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  totalWeightKg: number | null;
  rpe: number;
  percent: number | null;
  note: string | null;
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
  progression?: ProgressionSummaryPayload | null;
};

function plannedRowsFromSnapshot(snapshot: any, bodyweightKg: number | null): PlannedRow[] {
  const planned = Array.isArray(snapshot?.exercises) ? snapshot.exercises : [];
  const rows: PlannedRow[] = [];

  for (const ex of planned) {
    const name = String(ex?.exerciseName ?? "").trim();
    if (!name) continue;

    const sets = Array.isArray(ex?.sets) && ex.sets.length > 0 ? ex.sets : [{}];
    sets.forEach((s: any, idx: number) => {
      const totalWeightKg = Number(s?.targetWeightKg ?? 0) || 0;
      rows.push({
        exerciseName: name,
        setNumber: idx + 1,
        reps: Number(s?.reps ?? 0) || 0,
        weightKg:
          computeExternalLoadFromTotalKg(name, totalWeightKg, bodyweightKg) ?? totalWeightKg,
        totalWeightKg,
        rpe: Number(s?.rpe ?? 0) || 0,
        percent: Number.isFinite(Number(s?.percent)) && Number(s?.percent) > 0 ? Number(s?.percent) : null,
        note: typeof s?.note === "string" && s.note.trim() ? s.note.trim() : null,
      });
    });
  }

  return rows;
}

function formatKg(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}kg` : "-";
}

export default function WorkoutSessionDetailPage() {
  const params = useParams<{ logId: string }>();
  const logId = String(params?.logId ?? "");

  const [item, setItem] = useState<LogItem | null>(null);
  const [bodyweightKg, setBodyweightKg] = useState<number | null>(toDefaultWorkoutPreferences().bodyweightKg);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!logId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [res, settings] = await Promise.all([
          apiGet<{ item: LogItem }>(`/api/logs/${encodeURIComponent(logId)}`),
          fetchSettingsSnapshot().catch(() => null),
        ]);
        if (!cancelled) {
          setItem(res.item);
          setBodyweightKg(
            settings ? readWorkoutPreferences(settings).bodyweightKg : toDefaultWorkoutPreferences().bodyweightKg,
          );
        }
      } catch (e: any) {
        if (!cancelled) {
          setItem(null);
          setError(e?.message ?? "세션 상세를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [logId]);

  const plannedRows = useMemo(
    () => plannedRowsFromSnapshot(item?.generatedSession?.snapshot, bodyweightKg),
    [bodyweightKg, item],
  );

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
    <div>

      <Card>
        <a
          href={APP_ROUTES.todayLog}
        >
          오늘 기록으로 돌아가기
        </a>

        <button
          onClick={() => {
            setItem(null);
            setError(null);
            setLoading(true);
            apiGet<{ item: LogItem }>(`/api/logs/${encodeURIComponent(logId)}`)
              .then((res) => setItem(res.item))
              .catch((e: any) => setError(e?.message ?? "세션 상세를 다시 불러오지 못했습니다."))
              .finally(() => setLoading(false));
          }}
        >
          다시 불러오기
        </button>
      </Card>

      <LoadingStateRows
        active={loading}
        delayMs={140}
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
          <Card>
            <div>
              <div>로그 ID</div>
              <div>{item.id}</div>
            </div>
            <div>
              <div>수행 시각</div>
              <div>{new Date(item.performedAt).toLocaleString()}</div>
            </div>
            <div>
              <div>세션 키</div>
              <div>
                {item.generatedSession?.sessionKey
                  ? formatSessionKeyLabel(item.generatedSession.sessionKey)
                  : "(수동 / 생성 세션 없음)"}
              </div>
            </div>
          </Card>

          <Card>
            <div>
              <div>일치</div>
              <div>{stats.matched}</div>
            </div>
            <div>
              <div>누락</div>
              <div>{stats.missing}</div>
            </div>
            <div>
              <div>추가</div>
              <div>{stats.extra}</div>
            </div>
          </Card>

          <Card>
            <div>자동 진행</div>
            <NoticeStateRows
              message={summarizeProgression(item.progression ?? null)}
              tone={progressionTone(item.progression ?? null)}
              label="요약"
            />
            {item.progression?.event ? (
              <>
                <div>
                  <div>
                    <div>이벤트</div>
                    <div>{item.progression.event.eventType}</div>
                  </div>
                  <div>
                    <div>프로그램</div>
                    <div>{item.progression.event.programSlug}</div>
                  </div>
                  <div>
                    <div>세션 진행</div>
                    <div>{item.progression.event.didAdvanceSession ? "예" : "아니오"}</div>
                  </div>
                  <div>
                    <div>적용 시각</div>
                    <div>{new Date(item.progression.event.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                {item.progression.event.targetDecisions.length > 0 ? (
                  <div>
                    <table>
                      <thead>
                        <tr>
                          <th>Target</th>
                          <th>결과</th>
                          <th>변화</th>
                          <th>사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.progression.event.targetDecisions.map((decision, idx) => (
                          <tr key={`${decision.target}-${decision.eventType}-${idx}`}>
                            <td>{decision.target}</td>
                            <td>{decision.eventType}</td>
                            <td>
                              {formatKg(decision.beforeWorkKg)} → {formatKg(decision.afterWorkKg)}
                            </td>
                            <td>{decision.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyStateRows when label="타겟별 자동 진행 결정 없음" />
                )}
              </>
            ) : (
              <EmptyStateRows when label="이 로그에는 자동 진행 이벤트가 없습니다." />
            )}
          </Card>

          <Card>
            <div>계획 대비 수행</div>
            {compareRows.length === 0 ? (
              <EmptyStateRows
                when
                label="설정 값 없음"
                description="비교할 계획/수행 세트가 없습니다."
              />
            ) : (
              <div>
                <table>
                  <thead>
                    <tr>
                      <th>운동</th>
                      <th>세트</th>
                      <th>계획</th>
                      <th>수행</th>
                      <th>차이</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((r, idx) => {
                      const plannedPercent =
                        r.planned && typeof r.planned.percent === "number"
                          ? `${Math.round(r.planned.percent * 100)}%`
                          : null;
                      const plannedMeta =
                        r.planned && r.planned.note ? r.planned.note : null;
                      const plannedLoadText = r.planned
                        ? formatExerciseLoadLabel({
                            exerciseName: r.exerciseName,
                            weightKg: r.planned.totalWeightKg ?? r.planned.weightKg,
                            bodyweightKg,
                            source: r.planned.totalWeightKg !== null ? "total" : "external",
                          })
                        : "-";
                      const plannedText = r.planned
                        ? `${r.planned.reps || "-"}회 @ ${plannedLoadText}${
                            plannedPercent || plannedMeta
                              ? ` (${[plannedPercent, plannedMeta].filter(Boolean).join(" · ")})`
                              : ""
                          }`
                        : "-";
                      const performedText = r.actual
                        ? `${r.actual.reps || "-"}회 @ ${formatExerciseLoadLabel({
                            exerciseName: r.exerciseName,
                            weightKg: r.actual.weightKg,
                            bodyweightKg,
                            source: "external",
                          })}`
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
                        <tr key={`${r.exerciseName}-${r.setNumber}-${idx}`}>
                          <td>{r.exerciseName}</td>
                          <td>{r.setNumber}</td>
                          <td>{plannedText}</td>
                          <td>{performedText}</td>
                          <td>{diffText}</td>
                          <td>{status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
