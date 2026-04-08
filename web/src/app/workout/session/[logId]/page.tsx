"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { apiGet } from "@/shared/api/api";
import { APP_ROUTES } from "@/lib/app-routes";
import { formatExerciseLoadLabel, computeExternalLoadFromTotalKg } from "@/lib/bodyweight-load";
import { progressionTone, summarizeProgression, type ProgressionSummaryPayload } from "@/lib/progression/summary";
import { formatSessionKeyLabel } from "@/lib/session-key";
import { fetchSettingsSnapshot } from "@/lib/settings/settings-api";
import { readWorkoutPreferences, toDefaultWorkoutPreferences } from "@/lib/settings/workout-preferences";
import { EmptyStateRows, ErrorStateRows, NoticeStateRows } from "@/shared/ui/settings-state";
import { Card } from "@/shared/ui/card";

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

function shortLogId(id: string) {
  if (!id) return "-";
  if (id.length <= 10) return id;
  return `${id.slice(0, 8)}...`;
}

export default function WorkoutSessionDetailPage() {
  const { locale } = useLocale();
  const params = useParams<{ logId: string }>();
  const logId = String(params?.logId ?? "");

  const [item, setItem] = useState<LogItem | null>(null);
  const [bodyweightKg, setBodyweightKg] = useState<number | null>(toDefaultWorkoutPreferences().bodyweightKg);
  const [error, setError] = useState<string | null>(null);
  const [_loading, setLoading] = useState(false);

  useEffect(() => {
    if (!logId) {
      return;
    }
    let cancelled = false;

    (async () => {
      try {
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
          setError(e?.message ?? (locale === "ko" ? "세션 상세를 불러오지 못했습니다." : "Could not load the session details."));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [logId, locale]);

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

  const mismatchRows = useMemo(
    () => compareRows.filter((row) => !(row.planned && row.actual)),
    [compareRows],
  );
  const t = {
    reloadFailed: locale === "ko" ? "다시 불러오기에 실패했습니다." : "Reload failed.",
    performedAt: locale === "ko" ? "수행 시각" : "Performed At",
    session: locale === "ko" ? "세션" : "Session",
    manualLog: locale === "ko" ? "수동 로그" : "Manual Log",
    logId: locale === "ko" ? "로그 ID" : "Log ID",
    matched: locale === "ko" ? "일치" : "Matched",
    missing: locale === "ko" ? "누락" : "Missing",
    extra: locale === "ko" ? "추가" : "Extra",
    progression: locale === "ko" ? "자동 진행" : "Auto Progression",
    summary: locale === "ko" ? "요약" : "Summary",
    details: locale === "ko" ? "자동 진행 상세 보기" : "View auto progression details",
    event: locale === "ko" ? "이벤트" : "Event",
    program: locale === "ko" ? "프로그램" : "Program",
    sessionAdvanced: locale === "ko" ? "세션 진행" : "Session Advanced",
    yes: locale === "ko" ? "예" : "Yes",
    no: locale === "ko" ? "아니오" : "No",
    appliedAt: locale === "ko" ? "적용 시각" : "Applied At",
    result: locale === "ko" ? "결과" : "Result",
    change: locale === "ko" ? "변화" : "Change",
    reason: locale === "ko" ? "사유" : "Reason",
    target: locale === "ko" ? "타겟" : "Target",
    noTargetDecisions: locale === "ko" ? "타겟별 자동 진행 결정 없음" : "No per-target auto progression decisions",
    noProgressionEvent: locale === "ko" ? "이 로그에는 자동 진행 이벤트가 없습니다." : "This log has no auto progression event.",
    compareTitle: locale === "ko" ? "계획 대비 수행" : "Planned vs Performed",
    noComparison: locale === "ko" ? "비교할 계획/수행 세트가 없습니다." : "There are no planned/performed sets to compare.",
    addedSet: locale === "ko" ? "추가된 세트" : "Added Set",
    missingSet: locale === "ko" ? "누락 세트" : "Missing Set",
    allMatched: locale === "ko" ? "모든 세트가 계획과 일치합니다." : "All sets match the plan.",
    compareResult: locale === "ko" ? "비교 결과" : "Comparison Result",
    fullTable: locale === "ko" ? "전체 비교표 보기" : "View full comparison table",
    exercise: locale === "ko" ? "운동" : "Exercise",
    set: locale === "ko" ? "세트" : "Set",
    planned: locale === "ko" ? "계획" : "Planned",
    performed: locale === "ko" ? "수행" : "Performed",
    diff: locale === "ko" ? "차이" : "Difference",
    status: locale === "ko" ? "상태" : "Status",
    statusExtra: locale === "ko" ? "추가" : "Extra",
    statusMissing: locale === "ko" ? "누락" : "Missing",
    statusDone: locale === "ko" ? "완료" : "Done",
    statusLogged: locale === "ko" ? "기록됨" : "Logged",
    noValues: locale === "ko" ? "설정 값 없음" : "No values",
  };

  return (
    <div>
      <div
        style={{
          marginBottom: "var(--space-xl)",
          paddingBottom: "var(--space-md)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-label-family)",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            color: "var(--color-primary)",
            letterSpacing: "0.08em",
            marginBottom: 6,
          }}
        >
          {locale === "ko" ? "세션 상세" : "Session Details"}
        </div>
        <h1
          style={{
            fontFamily: "var(--font-headline-family)",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.5px",
            margin: 0,
          }}
        >
          {locale === "ko" ? "운동 기록" : "Workout Log"}
        </h1>
      </div>

      <Card tone="subtle" padding="sm" elevated={false}>
        <div style={{ display: "flex", gap: "var(--space-xs)" }}>
          <a
            href={APP_ROUTES.todayLog}
            className="btn btn-secondary"
          >
            {locale === "ko" ? "오늘 기록으로 돌아가기" : "Back to Today's Log"}
          </a>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setItem(null);
              setError(null);
              setLoading(true);
              apiGet<{ item: LogItem }>(`/api/logs/${encodeURIComponent(logId)}`)
                .then((res) => setItem(res.item))
                .catch((e: any) => setError(e?.message ?? (locale === "ko" ? "세션 상세를 다시 불러오지 못했습니다." : "Could not reload the session details.")))
                .finally(() => setLoading(false));
            }}
          >
            {locale === "ko" ? "다시 불러오기" : "Reload"}
          </button>
        </div>
      </Card>

      <ErrorStateRows
        message={error}
        onRetry={() => {
          setItem(null);
          setError(null);
          setLoading(true);
          apiGet<{ item: LogItem }>(`/api/logs/${encodeURIComponent(logId)}`)
            .then((res) => setItem(res.item))
            .catch((e: any) => setError(e?.message ?? t.reloadFailed))
            .finally(() => setLoading(false));
        }}
      />

      {item && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <Card tone="subtle" padding="sm" elevated={false}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>{t.performedAt}</div>
              <div style={{ font: "var(--font-card-title)" }}>{new Date(item.performedAt).toLocaleString()}</div>
              <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>
                {t.session}: {item.generatedSession?.sessionKey ? formatSessionKeyLabel(item.generatedSession.sessionKey) : t.manualLog}
              </div>
              <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>
                {t.logId}: {shortLogId(item.id)}
              </div>
            </div>
          </Card>

          <Card padding="sm" elevated={false}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-sm)" }}>
              <div>
                <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>{t.matched}</div>
                <div style={{ font: "var(--font-card-title)" }}>{stats.matched}</div>
              </div>
              <div>
                <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>{t.missing}</div>
                <div style={{ font: "var(--font-card-title)" }}>{stats.missing}</div>
              </div>
              <div>
                <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>{t.extra}</div>
                <div style={{ font: "var(--font-card-title)" }}>{stats.extra}</div>
              </div>
            </div>
          </Card>

          <Card padding="sm" elevated={false}>
            <div style={{ marginBottom: "var(--space-xs)", font: "var(--font-card-title)" }}>{t.progression}</div>
            <NoticeStateRows
              message={summarizeProgression(item.progression ?? null, locale)}
              tone={progressionTone(item.progression ?? null)}
              label={t.summary}
            />
            {item.progression?.event ? (
              <details style={{ marginTop: "var(--space-sm)" }}>
                <summary style={{ cursor: "pointer", color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>
                  {t.details}
                </summary>
                <div style={{ marginTop: "var(--space-sm)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                  <div>
                    <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>{t.event}</div>
                    <div>{item.progression.event.eventType}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>{t.program}</div>
                    <div>{item.progression.event.programSlug}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>{t.sessionAdvanced}</div>
                    <div>{item.progression.event.didAdvanceSession ? t.yes : t.no}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>{t.appliedAt}</div>
                    <div>{new Date(item.progression.event.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                {item.progression.event.targetDecisions.length > 0 ? (
                  <div style={{ marginTop: "var(--space-sm)", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th>{t.target}</th>
                          <th>{t.result}</th>
                          <th>{t.change}</th>
                          <th>{t.reason}</th>
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
                  <EmptyStateRows when label={t.noTargetDecisions} />
                )}
              </details>
            ) : (
              <EmptyStateRows when label={t.noProgressionEvent} />
            )}
          </Card>

          <Card padding="sm" elevated={false}>
            <div style={{ marginBottom: "var(--space-xs)", font: "var(--font-card-title)" }}>{t.compareTitle}</div>
            {compareRows.length === 0 ? (
              <EmptyStateRows
                when
                label={t.noValues}
                description={t.noComparison}
              />
            ) : (
              <>
                {mismatchRows.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
                    {mismatchRows.map((r, idx) => {
                      const status = !r.planned ? t.addedSet : t.missingSet;
                      return (
                        <div key={`mismatch-${r.exerciseName}-${r.setNumber}-${idx}`} style={{ border: "1px solid var(--color-border)", borderRadius: "8px", padding: "var(--space-xs) var(--space-sm)" }}>
                          <strong>{r.exerciseName} {locale === "ko" ? `${r.setNumber}세트` : `Set ${r.setNumber}`}</strong>
                          <div style={{ color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>{status}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <NoticeStateRows message={t.allMatched} tone="success" label={t.compareResult} preferInline />
                )}

                <details>
                  <summary style={{ cursor: "pointer", color: "var(--color-text-muted)", font: "var(--font-secondary)" }}>
                    {t.fullTable}
                  </summary>
                  <div style={{ marginTop: "var(--space-sm)", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th>{t.exercise}</th>
                          <th>{t.set}</th>
                          <th>{t.planned}</th>
                          <th>{t.performed}</th>
                          <th>{t.diff}</th>
                          <th>{t.status}</th>
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
                        ? `${r.planned.reps || "-"}${locale === "ko" ? "회" : " reps"} @ ${plannedLoadText}${
                            plannedPercent || plannedMeta
                              ? ` (${[plannedPercent, plannedMeta].filter(Boolean).join(" · ")})`
                              : ""
                          }`
                        : "-";
                      const performedText = r.actual
                        ? `${r.actual.reps || "-"}${locale === "ko" ? "회" : " reps"} @ ${formatExerciseLoadLabel({
                            exerciseName: r.exerciseName,
                            weightKg: r.actual.weightKg,
                            bodyweightKg,
                            source: "external",
                          })}`
                        : "-";

                      const repsDiff = (r.actual?.reps ?? 0) - (r.planned?.reps ?? 0);
                      const kgDiff = (r.actual?.weightKg ?? 0) - (r.planned?.weightKg ?? 0);
                      const diffText = r.planned && r.actual ? `${repsDiff >= 0 ? "+" : ""}${repsDiff}${locale === "ko" ? "회" : " reps"}, ${kgDiff >= 0 ? "+" : ""}${kgDiff}kg` : "-";

                      const status = !r.planned
                        ? t.statusExtra
                        : !r.actual
                          ? t.statusMissing
                          : r.actual.meta?.completed === true || r.actual.isExtra === false
                            ? t.statusDone
                            : t.statusLogged;

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
                </details>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
