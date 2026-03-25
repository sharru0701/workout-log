"use client";

import { useCallback, useEffect, useMemo, useState, forwardRef, useImperativeHandle, useRef } from "react";
import { DashboardSection, DashboardSurface } from "@/components/dashboard/dashboard-primitives";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Card, CardContent } from "@/components/ui/card";
import { SearchSelectSheet } from "@/components/ui/search-select-sheet";
import { EmptyStateRows, ErrorStateRows } from "@/components/ui/settings-state";
import { apiGet } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { CalendarRangePicker } from "@/components/ui/calendar-range-picker";

type ExerciseOption = {
  id: string;
  name: string;
};

type PlanOption = {
  id: string;
  name: string;
};

type E1RMPoint = {
  date: string;
  e1rm: number;
  weightKg: number;
  reps: number;
};

type E1RMResponse = {
  from: string;
  to: string;
  rangeDays: number;
  exercise: string | null;
  exerciseId: string | null;
  best: E1RMPoint | null;
  series: E1RMPoint[];
};

type ExercisesResponse = {
  items: Array<{
    id: string;
    name: string;
  }>;
};

type PlansResponse = {
  items: Array<{
    id: string;
    name: string;
  }>;
};

type SheetType = "exercise" | "range" | "program" | null;
type RangePreset = 7 | 30 | 90 | 180 | 365 | "CUSTOM";

type RangeFilter = {
  preset: RangePreset;
  from: string;
  to: string;
};

function toQuery(params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  return sp.toString();
}

function toDateOnly(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateDaysAgoDateOnly(daysAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, Math.floor(daysAgo)));
  return toDateOnly(d);
}

function toDefaultRange(): RangeFilter {
  return {
    preset: 90,
    from: dateDaysAgoDateOnly(89),
    to: toDateOnly(new Date()),
  };
}

function formatPointDate(dateIso: string) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: "20px", height: "20px" }}>
      <rect x="3.5" y="4" width="17" height="16.5" rx="2" strokeLinejoin="round" />
      <path d="M3.5 9.5h17" strokeLinecap="round" />
      <path d="M8 2.5v3" strokeLinecap="round" />
      <path d="M16 2.5v3" strokeLinecap="round" />
      <path d="M8 13.5h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 13.5h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 13.5h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 17.5h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17.5h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function resolveIndex(clientX: number, left: number, width: number, length: number) {
  if (length <= 1 || width <= 0) return 0;
  const ratio = (clientX - left) / width;
  const bounded = Math.max(0, Math.min(1, ratio));
  return clampIndex(Math.round(bounded * (length - 1)), length);
}

function E1RMInteractiveChart({
  series,
  activeIndex,
  onActiveIndexChange,
}: {
  series: E1RMPoint[];
  activeIndex: number;
  onActiveIndexChange: (nextIndex: number) => void;
}) {
  const width = 1000;
  const height = 400;
  const padX = 60;
  const padY = 40;

  const e1rmValues = series.map((point) => point.e1rm);
  const min = Math.min(...e1rmValues);
  const max = Math.max(...e1rmValues);
  const span = Math.max(1, max - min);
  const drawWidth = width - padX * 2;
  const drawHeight = height - padY * 2;

  const points = series.map((point, index) => {
    const x = padX + (series.length === 1 ? drawWidth / 2 : (index * drawWidth) / (series.length - 1));
    const y = padY + drawHeight - ((point.e1rm - min) / span) * drawHeight;
    return { x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x},${height - padY} L ${points[0].x},${height - padY} Z`
      : "";

  const selectedPoint = points[activeIndex];
  const selectedData = series[activeIndex];
  const yGuides = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ position: "relative", width: "100%", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block", color: "var(--metric-1rm-color)" }}
        role="img"
        aria-label="1RM trend chart"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onActiveIndexChange(resolveIndex(event.clientX, rect.left, rect.width, series.length));
        }}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onActiveIndexChange(resolveIndex(event.clientX, rect.left, rect.width, series.length));
        }}
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yGuides.map((ratio) => {
          const y = padY + drawHeight * ratio;
          const value = max - span * ratio;
          return (
            <g key={ratio} style={{ color: "var(--color-border)" }}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padX - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                style={{ fill: "var(--color-text-muted)", fontSize: "14px", fontVariantNumeric: "tabular-nums" }}
              >
                {value.toFixed(0)}
              </text>
            </g>
          );
        })}

        {areaPath ? <path d={areaPath} fill="url(#chartGradient)" /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {selectedPoint && selectedData ? (
          <g>
            <line
              x1={selectedPoint.x}
              y1={padY}
              x2={selectedPoint.x}
              y2={height - padY}
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeDasharray="2 2"
            />
            <circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r={7}
              fill="var(--color-bg)"
              stroke="var(--color-primary)"
              strokeWidth="3"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

export type Stats1RMDetailedRef = {
  selectExercise: (exerciseId: string) => void;
};

export const Stats1RMDetailed = forwardRef<Stats1RMDetailedRef, { refreshTick?: number }>(function Stats1RMDetailed({ refreshTick = 0 }, ref) {
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const optionsHasLoadedRef = useRef(false);
  const [optionsLoadKey, setOptionsLoadKey] = useState("stats-1rm:options:init");
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dataHasLoadedRef = useRef(false);
  const [dataLoadKey, setDataLoadKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internalRefreshTick, setInternalRefreshTick] = useState(0);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(toDefaultRange);
  const [rangeDraft, setRangeDraft] = useState<RangeFilter>(toDefaultRange);
  const [rangeDraftError, setRangeDraftError] = useState<string | null>(null);
  const [stats, setStats] = useState<E1RMResponse | null>(null);
  const [activePointIndex, setActivePointIndex] = useState(0);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [programQuery, setProgramQuery] = useState("");

  useImperativeHandle(ref, () => ({
    selectExercise: (exerciseId: string) => {
      setSelectedExerciseId(exerciseId);
    }
  }));

  const selectedExercise = useMemo(
    () => exercises.find((entry) => entry.id === selectedExerciseId) ?? null,
    [exercises, selectedExerciseId],
  );
  const selectedProgramLabel = useMemo(() => {
    if (!selectedPlanId) return "전체 플랜";
    return plans.find((entry) => entry.id === selectedPlanId)?.name ?? "선택된 플랜";
  }, [plans, selectedPlanId]);
  const series = stats?.series ?? [];
  const hasChartData = series.length > 0;
  const resolvedActiveIndex = hasChartData ? clampIndex(activePointIndex, series.length) : 0;
  const activePoint = hasChartData ? series[resolvedActiveIndex] : null;
  const activeDataQueryKey = useMemo(() => {
    if (!selectedExerciseId) return null;
    return [selectedExerciseId, selectedPlanId || "", rangeFilter.preset, rangeFilter.from, rangeFilter.to, refreshTick, internalRefreshTick].join("|");
  }, [rangeFilter.from, rangeFilter.preset, rangeFilter.to, refreshTick, internalRefreshTick, selectedExerciseId, selectedPlanId]);
  const isOptionsSettled = useQuerySettled(optionsLoadKey, optionsLoading);
  const isDataSettled = useQuerySettled(dataLoadKey, loading);

  const loadFilterOptions = useCallback(async () => {
    try {
      if (!optionsHasLoadedRef.current) {
        setOptionsLoading(true);
      }
      setOptionsLoadKey(`stats-1rm:options:${Date.now()}`);
      setOptionsError(null);
      const [exerciseRes, planRes] = await Promise.all([
        apiGet<ExercisesResponse>("/api/exercises?limit=200"),
        apiGet<PlansResponse>("/api/plans"),
      ]);
      const nextExercises = (exerciseRes.items ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
      }));
      const nextPlans = (planRes.items ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
      }));

      setExercises(nextExercises);
      setPlans(nextPlans);
      setSelectedExerciseId((prev) => {
        if (prev && nextExercises.some((entry) => entry.id === prev)) return prev;
        return nextExercises[0]?.id ?? null;
      });
      setSelectedPlanId((prev) => (prev && nextPlans.some((entry) => entry.id === prev) ? prev : ""));
      optionsHasLoadedRef.current = true;
    } catch (e: any) {
      setOptionsError(e?.message ?? "필터 옵션을 불러오지 못했습니다.");
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    if (activeSheet !== "range") return;
    setRangeDraft(rangeFilter);
    setRangeDraftError(null);
  }, [activeSheet, rangeFilter]);

  useEffect(() => {
    if (activeSheet !== "exercise") setExerciseQuery("");
    if (activeSheet !== "program") setProgramQuery("");
  }, [activeSheet]);

  useEffect(() => {
    if (!selectedExerciseId || !activeDataQueryKey) {
      setStats(null);
      setDataLoadKey(null);
      return;
    }

    let cancelled = false;
    const nextLoadKey = `stats-1rm:data:${activeDataQueryKey}:${Date.now()}`;

    (async () => {
      try {
        if (!dataHasLoadedRef.current) {
          setLoading(true);
        }
        setDataLoadKey(nextLoadKey);
        setError(null);

        const path = `/api/stats/e1rm?${toQuery({
          exerciseId: selectedExerciseId,
          planId: selectedPlanId || undefined,
          days: rangeFilter.preset === "CUSTOM" ? undefined : rangeFilter.preset,
          from: rangeFilter.preset === "CUSTOM" ? rangeFilter.from : undefined,
          to: rangeFilter.preset === "CUSTOM" ? rangeFilter.to : undefined,
        })}`;

        const response = await apiGet<E1RMResponse>(path);
        if (cancelled) return;
        setStats(response);
        setActivePointIndex(response.series.length > 0 ? response.series.length - 1 : 0);
        dataHasLoadedRef.current = true;
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "1RM 데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeDataQueryKey, rangeFilter, selectedExerciseId, selectedPlanId]);

  const applyRangeDraft = () => {
    if (rangeDraft.preset === "CUSTOM") {
      if (!rangeDraft.from || !rangeDraft.to) {
        setRangeDraftError("시작일과 종료일을 모두 입력하세요.");
        return;
      }
      if (rangeDraft.from > rangeDraft.to) {
        setRangeDraftError("시작일이 종료일보다 늦을 수 없습니다.");
        return;
      }
      setRangeFilter(rangeDraft);
      setActiveSheet(null);
      return;
    }

    const nextPreset = rangeDraft.preset;
    const nextRange: RangeFilter = {
      preset: nextPreset,
      from: dateDaysAgoDateOnly(nextPreset - 1),
      to: toDateOnly(new Date()),
    };
    setRangeFilter(nextRange);
    setActiveSheet(null);
  };

  const canApplyRangeDraft =
    rangeDraft.preset !== "CUSTOM" ||
    (Boolean(rangeDraft.from) && Boolean(rangeDraft.to) && rangeDraft.from <= rangeDraft.to);

  const filteredExerciseOptions = useMemo(() => {
    const q = exerciseQuery.trim().toLowerCase();
    return exercises
      .filter((ex) => !q || ex.name.toLowerCase().includes(q))
      .map((ex) => ({
        key: ex.id,
        label: ex.name,
        active: ex.id === selectedExerciseId,
        ariaCurrent: ex.id === selectedExerciseId,
        onSelect: () => {
          setSelectedExerciseId(ex.id);
          setActiveSheet(null);
        },
      }));
  }, [exercises, exerciseQuery, selectedExerciseId]);

  const filteredProgramOptions = useMemo(() => {
    const q = programQuery.trim().toLowerCase();
    const allOption = {
      key: "__all__",
      label: "전체 플랜",
      active: selectedPlanId === "",
      ariaCurrent: selectedPlanId === "",
      onSelect: () => {
        setSelectedPlanId("");
        setActiveSheet(null);
      },
    };
    const planOptions = plans
      .filter((plan) => !q || plan.name.toLowerCase().includes(q))
      .map((plan) => ({
        key: plan.id,
        label: plan.name,
        active: plan.id === selectedPlanId,
        ariaCurrent: plan.id === selectedPlanId,
        onSelect: () => {
          setSelectedPlanId(plan.id);
          setActiveSheet(null);
        },
      }));
    if (q && !"전체 플랜".includes(q)) return planOptions;
    return [allOption, ...planOptions];
  }, [plans, programQuery, selectedPlanId]);

  const showNoExerciseState = isOptionsSettled && !optionsError && exercises.length === 0;
  const showDataEmptyState = isDataSettled && !error && !showNoExerciseState && series.length === 0;
  const showChartSection = hasChartData;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
        <button
          type="button"
          onClick={() => setActiveSheet("exercise")}
          className="dashboard-surface-btn"
          style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            padding: "12px var(--space-md)", 
            border: "1px solid var(--color-border)", 
            borderRadius: "14px", 
            backgroundColor: "var(--color-surface-secondary)", 
            cursor: "pointer",
            textAlign: "left",
            boxShadow: "var(--shadow-sm)"
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "2px", fontWeight: 500 }}>운동종목</div>
            <div style={{ font: "var(--font-body)", fontWeight: 700, color: "var(--color-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectedExercise?.name ?? "선택"}
            </div>
          </div>
          <span aria-hidden="true" style={{ color: "var(--color-text-muted)", flexShrink: 0, marginLeft: "4px" }}>
            <svg viewBox="0 0 12 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
              <path d="M2.5 6L6 9.5L9.5 6" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSheet("program")}
          style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            padding: "12px var(--space-md)", 
            border: "1px solid var(--color-border)", 
            borderRadius: "14px", 
            backgroundColor: "var(--color-surface-secondary)", 
            cursor: "pointer",
            textAlign: "left",
            boxShadow: "var(--shadow-sm)"
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "2px", fontWeight: 500 }}>필터링</div>
            <div style={{ font: "var(--font-body)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectedProgramLabel}
            </div>
          </div>
          <span aria-hidden="true" style={{ color: "var(--color-text-muted)", flexShrink: 0, marginLeft: "4px" }}>
            <svg viewBox="0 0 12 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
              <path d="M2.5 6L6 9.5L9.5 6" />
            </svg>
          </span>
        </button>
      </div>

      <div style={{ marginTop: "2px" }}>
        <Card tone="inset" padding="none" style={{ background: "var(--color-surface-2)", borderRadius: "12px", border: "1px solid var(--color-border)", overflow: "hidden" }}>
          <div style={{ display: "flex", padding: "3px", gap: "2px" }}>
            {[
              { label: "7D", value: 7 },
              { label: "1M", value: 30 },
              { label: "3M", value: 90 },
              { label: "ALL", value: 365 }
            ].map((opt) => {
              const isActive = rangeFilter.preset === opt.value;
              return (
                <button
                  key={opt.label}
                  onClick={() => {
                    const preset = opt.value as RangePreset;
                    setRangeFilter({
                      preset,
                      from: dateDaysAgoDateOnly(preset === "CUSTOM" ? 89 : preset - 1),
                      to: toDateOnly(new Date()),
                    });
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    border: "none",
                    borderRadius: "9px",
                    fontSize: "12px",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    background: isActive ? "var(--color-bg)" : "transparent",
                    color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                    boxShadow: isActive ? "0 2px 6px var(--shadow-color-soft)" : "none",
                    transition: "all 0.15s ease"
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
            <button
              onClick={() => setActiveSheet("range")}
              aria-label="기간 지정"
              style={{
                width: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: "9px",
                background: rangeFilter.preset === "CUSTOM" ? "var(--color-bg)" : "transparent",
                color: rangeFilter.preset === "CUSTOM" ? "var(--color-primary)" : "var(--color-text-subtle)",
                cursor: "pointer",
                boxShadow: rangeFilter.preset === "CUSTOM" ? "0 2px 6px var(--shadow-color-soft)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <CalendarIcon />
            </button>
          </div>
        </Card>
      </div>

      <div>
        {optionsLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 10, height: 40 }} />
            <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 10, height: 40 }} />
          </div>
        )}
        <ErrorStateRows
          message={optionsError}
          title="필터 옵션을 불러오지 못했습니다"
          onRetry={() => {
            void loadFilterOptions();
          }}
        />
        <EmptyStateRows
          when={showNoExerciseState}
          label="운동종목이 없습니다"
          description="운동종목이 준비되면 1RM 그래프를 표시할 수 있습니다."
        />

        {!showNoExerciseState && (
          <>
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 10, height: 180 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                  <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 48 }} />
                  <div style={{ background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s ease infinite", borderRadius: 8, height: 48 }} />
                </div>
              </div>
            )}
            <ErrorStateRows
              message={error}
              title="1RM 데이터를 불러오지 못했습니다"
              onRetry={() => {
                setInternalRefreshTick((prev) => prev + 1);
              }}
            />
            <EmptyStateRows
              when={showDataEmptyState}
              label="선택한 필터 조합에 데이터가 없습니다"
              description="필터를 변경하거나 운동 기록을 추가한 뒤 다시 확인하세요."
            />
          </>
        )}

        {showChartSection && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <DashboardSurface>
              <header style={{ padding: "var(--space-md)", borderBottom: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ font: "var(--font-section-title)", color: "var(--color-text)", margin: "0 0 2px 0" }}>
                      e1RM 상세 추이
                    </h2>
                    {stats && (
                      <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                        {formatPointDate(stats.from)} ~ {formatPointDate(stats.to)}
                      </div>
                    )}
                  </div>
                  <div className="metric-1rm" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span className="metric-value" style={{ fontSize: "24px" }}>
                      {activePoint ? `${activePoint.e1rm.toFixed(1)}` : "-"}
                      <span style={{ fontSize: "14px", marginLeft: "2px", fontWeight: 400 }}>kg</span>
                    </span>
                    <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)" }}>
                      {activePoint ? `${formatPointDate(activePoint.date)}` : "-"}
                    </span>
                  </div>
                </div>
              </header>

              <div style={{ padding: "var(--space-md)" }}>
                <E1RMInteractiveChart
                  series={series}
                  activeIndex={resolvedActiveIndex}
                  onActiveIndexChange={setActivePointIndex}
                />
              </div>

              {activePoint && (
                <div style={{ padding: "0 var(--space-md) var(--space-md) var(--space-md)", display: "flex", gap: "var(--space-sm)" }}>
                  <div className="label label-neutral label-sm">
                    {activePoint.weightKg}kg × {activePoint.reps}회
                  </div>
                </div>
              )}
            </DashboardSurface>

            <Card tone="inset" padding="md" elevated={false} style={{ margin: 0 }}>
              <div className="metric-1rm" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="metric-label" style={{ display: "block", marginBottom: "2px" }}>Best e1RM</span>
                  <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)", fontSize: "13px" }}>
                    {stats?.best ? formatPointDate(stats.best.date) : "-"}
                  </span>
                </div>
                <div className="metric-value" style={{ fontSize: "24px", textAlign: "right" }}>
                  {stats?.best ? stats.best.e1rm.toFixed(1) : "-"}
                  <span style={{ fontSize: "14px", marginLeft: "2px", fontWeight: 400 }}>kg</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <SearchSelectSheet
        open={activeSheet === "exercise"}
        title="운동종목 필터"
        description="그래프 대상 운동종목을 선택합니다."
        onClose={() => setActiveSheet(null)}
        closeLabel="닫기"
        query={exerciseQuery}
        placeholder="운동종목 검색..."
        onQueryChange={setExerciseQuery}
        resultsAriaLabel="운동종목 목록"
        options={filteredExerciseOptions}
        emptyText="검색 결과가 없습니다."
        loading={optionsLoading}
        loadingText="운동종목 불러오는 중..."
      />

      <BottomSheet
        open={activeSheet === "range"}
        title="기간 필터"
        description="기간을 선택하면 필터 조합으로 다시 조회합니다."
        onClose={() => setActiveSheet(null)}
        closeLabel="닫기"
        primaryAction={{
          ariaLabel: "기간 적용",
          onPress: applyRangeDraft,
          disabled: !canApplyRangeDraft,
        }}
        footer={null}
      >
        <div style={{ padding: "0 var(--space-xs)" }}>
          <CalendarRangePicker
            startDate={rangeDraft.from}
            endDate={rangeDraft.to}
            onRangeChange={(from, to) => {
              setRangeDraft({
                preset: "CUSTOM",
                from,
                to: to || from
              });
              setRangeDraftError(null);
            }}
          />
          {rangeDraftError && (
            <p style={{ color: "var(--color-danger)", fontSize: "13px", marginTop: "var(--space-md)", margin: 0 }}>{rangeDraftError}</p>
          )}
        </div>
      </BottomSheet>

      <SearchSelectSheet
        open={activeSheet === "program"}
        title="플랜 필터"
        description="특정 플랜 기록만 보거나 전체를 볼 수 있습니다."
        onClose={() => setActiveSheet(null)}
        closeLabel="닫기"
        query={programQuery}
        placeholder="플랜 검색..."
        onQueryChange={setProgramQuery}
        resultsAriaLabel="플랜 목록"
        options={filteredProgramOptions}
        emptyText="검색 결과가 없습니다."
        loading={optionsLoading}
        loadingText="플랜 불러오는 중..."
      />
    </div>
  );
});
