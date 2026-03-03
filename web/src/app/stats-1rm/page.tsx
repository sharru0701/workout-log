"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";
import { apiGet } from "@/lib/api";

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
type RangePreset = 7 | 30 | 90 | 180 | "CUSTOM";

type RangeFilter = {
  preset: RangePreset;
  from: string;
  to: string;
};

const RANGE_PRESETS: Array<{ value: Exclude<RangePreset, "CUSTOM">; label: string }> = [
  { value: 7, label: "최근 7일" },
  { value: 30, label: "최근 30일" },
  { value: 90, label: "최근 90일" },
  { value: 180, label: "최근 180일" },
];

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

function formatRangeLabel(range: RangeFilter) {
  if (range.preset === "CUSTOM") {
    return `${range.from} ~ ${range.to}`;
  }
  return `최근 ${range.preset}일`;
}

function rangeLabelForPreset(preset: RangePreset) {
  if (preset === "CUSTOM") return "사용자 지정";
  return `최근 ${preset}일`;
}

function FilterChip({
  title,
  value,
  onPress,
}: {
  title: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <button type="button" className="haptic-tap stats-filter-chip" onClick={onPress}>
      <span className="stats-filter-chip-title">{title}</span>
      <span className="stats-filter-chip-value">{value}</span>
      <span className="stats-filter-chip-caret" aria-hidden="true">
        ▾
      </span>
    </button>
  );
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
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
  const width = 340;
  const height = 210;
  const padX = 18;
  const padY = 20;

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
    <div className="stats-chart-shell">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="stats-chart-svg"
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
        {yGuides.map((ratio) => {
          const y = padY + drawHeight * ratio;
          const value = max - span * ratio;
          return (
            <g key={ratio}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} className="stats-chart-grid" />
              <text x={width - padX} y={y - 4} textAnchor="end" className="stats-chart-y-label">
                {value.toFixed(0)}
              </text>
            </g>
          );
        })}

        {areaPath ? <path d={areaPath} className="stats-chart-area" /> : null}
        {linePath ? <path d={linePath} className="stats-chart-line" /> : null}

        {selectedPoint && selectedData ? (
          <g>
            <line
              x1={selectedPoint.x}
              y1={padY}
              x2={selectedPoint.x}
              y2={height - padY}
              className="stats-chart-scrub-line"
            />
            <circle cx={selectedPoint.x} cy={selectedPoint.y} r={6.5} className="stats-chart-active-dot" />
            <circle cx={selectedPoint.x} cy={selectedPoint.y} r={3.2} className="stats-chart-inner-dot" />
            <text x={selectedPoint.x} y={padY - 6} textAnchor="middle" className="stats-chart-x-label">
              {formatPointDate(selectedData.date)}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

export default function Stats1RMPage() {
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(toDefaultRange);
  const [rangeDraft, setRangeDraft] = useState<RangeFilter>(toDefaultRange);
  const [rangeDraftError, setRangeDraftError] = useState<string | null>(null);
  const [stats, setStats] = useState<E1RMResponse | null>(null);
  const [activePointIndex, setActivePointIndex] = useState(0);

  const selectedExercise = useMemo(
    () => exercises.find((entry) => entry.id === selectedExerciseId) ?? null,
    [exercises, selectedExerciseId],
  );
  const selectedProgramLabel = useMemo(() => {
    if (!selectedPlanId) return "전체 프로그램";
    return plans.find((entry) => entry.id === selectedPlanId)?.name ?? "선택된 프로그램";
  }, [plans, selectedPlanId]);
  const series = stats?.series ?? [];
  const hasChartData = series.length > 0;
  const resolvedActiveIndex = hasChartData ? clampIndex(activePointIndex, series.length) : 0;
  const activePoint = hasChartData ? series[resolvedActiveIndex] : null;

  const loadFilterOptions = useCallback(async () => {
    try {
      setOptionsLoading(true);
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
    if (!selectedExerciseId) {
      setStats(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
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
  }, [rangeFilter, refreshTick, selectedExerciseId, selectedPlanId]);

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

  const showNoExerciseState = !optionsLoading && !optionsError && exercises.length === 0;
  const showDataEmptyState = !loading && !error && !showNoExerciseState && selectedExerciseId !== null && series.length === 0;

  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <section className="grid gap-2">
        <h2 className="ios-section-heading">1RM Stats / Graph</h2>
        <article className="motion-card rounded-2xl border p-4 grid gap-3">
          <div className="stats-filter-chip-row">
            <FilterChip
              title="운동종목"
              value={selectedExercise?.name ?? "선택 필요"}
              onPress={() => setActiveSheet("exercise")}
            />
            <FilterChip title="기간" value={formatRangeLabel(rangeFilter)} onPress={() => setActiveSheet("range")} />
            <FilterChip title="프로그램" value={selectedProgramLabel} onPress={() => setActiveSheet("program")} />
          </div>
          <p className="stats-filter-summary">
            선택된 필터: {selectedExercise?.name ?? "운동 미선택"} / {formatRangeLabel(rangeFilter)} / {selectedProgramLabel}
          </p>
        </article>
      </section>

      <LoadingStateRows
        active={optionsLoading}
        delayMs={120}
        label="필터 옵션 로딩 중"
        description="운동종목/프로그램 목록을 조회하고 있습니다."
        ariaLabel="Stats filter loading"
      />
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
        ariaLabel="Stats empty exercises"
      />

      {!showNoExerciseState && (
        <>
          <LoadingStateRows
            active={loading}
            delayMs={180}
            label="1RM 데이터 조회 중"
            description="필터 조합에 맞는 1RM 추이를 불러오고 있습니다."
            ariaLabel="Stats data loading"
          />
          <ErrorStateRows
            message={error}
            title="1RM 데이터를 불러오지 못했습니다"
            onRetry={() => {
              setRefreshTick((prev) => prev + 1);
            }}
          />
          <EmptyStateRows
            when={showDataEmptyState}
            label="선택한 필터 조합에 데이터가 없습니다"
            description="필터를 변경하거나 운동 기록을 추가한 뒤 다시 확인하세요."
            ariaLabel="Stats chart empty state"
          />
        </>
      )}

      {!loading && !error && hasChartData && (
        <section className="grid gap-2">
          <article className="motion-card rounded-2xl border p-4 grid gap-3">
            <header className="stats-chart-header">
              <div>
                <h3 className="ios-inline-heading">그래프 영역</h3>
                <p className="stats-chart-caption">
                  터치/드래그로 포인트를 스크러빙하여 날짜별 값을 확인할 수 있습니다.
                </p>
              </div>
              <div className="stats-chart-focus">
                <strong>{activePoint ? `${activePoint.e1rm.toFixed(1)} kg` : "-"}</strong>
                <span>{activePoint ? `${formatPointDate(activePoint.date)} · ${activePoint.weightKg}kg x ${activePoint.reps}` : "-"}</span>
              </div>
            </header>

            <E1RMInteractiveChart
              series={series}
              activeIndex={resolvedActiveIndex}
              onActiveIndexChange={setActivePointIndex}
            />

            <div className="stats-chart-meta-grid">
              <article className="stats-chart-meta-card">
                <span className="ui-card-label">Best e1RM</span>
                <strong>{stats?.best ? `${stats.best.e1rm.toFixed(1)} kg` : "-"}</strong>
                <span>{stats?.best ? formatPointDate(stats.best.date) : "-"}</span>
              </article>
              <article className="stats-chart-meta-card">
                <span className="ui-card-label">데이터 포인트</span>
                <strong>{series.length}개</strong>
                <span>{stats ? `${formatPointDate(stats.from)} ~ ${formatPointDate(stats.to)}` : "-"}</span>
              </article>
              <article className="stats-chart-meta-card">
                <span className="ui-card-label">현재 필터</span>
                <strong>{rangeLabelForPreset(rangeFilter.preset)}</strong>
                <span>{selectedProgramLabel}</span>
              </article>
            </div>
          </article>
        </section>
      )}

      <BottomSheet
        open={activeSheet === "exercise"}
        title="운동종목 필터"
        description="그래프 대상 운동종목을 선택합니다."
        onClose={() => setActiveSheet(null)}
        closeLabel="닫기"
        className="stats-sheet stats-sheet--large"
      >
        <div className="stats-sheet-list">
          {exercises.map((exercise) => {
            const active = exercise.id === selectedExerciseId;
            return (
              <button
                key={exercise.id}
                type="button"
                className={`haptic-tap stats-sheet-option${active ? " is-active" : ""}`}
                onClick={() => {
                  setSelectedExerciseId(exercise.id);
                  setActiveSheet(null);
                }}
              >
                <span>{exercise.name}</span>
                <span aria-hidden="true">{active ? "✓" : ""}</span>
              </button>
            );
          })}
          {exercises.length === 0 ? (
            <div className="stats-sheet-empty">선택 가능한 운동종목이 없습니다.</div>
          ) : null}
        </div>
      </BottomSheet>

      <BottomSheet
        open={activeSheet === "range"}
        title="기간 필터"
        description="기간을 선택하면 필터 조합으로 다시 조회합니다."
        onClose={() => setActiveSheet(null)}
        closeLabel="닫기"
        className="stats-sheet stats-sheet--medium"
        footer={
          <button type="button" className="ui-primary-button" onClick={applyRangeDraft}>
            기간 적용
          </button>
        }
      >
        <div className="stats-sheet-list">
          {RANGE_PRESETS.map((preset) => {
            const active = rangeDraft.preset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                className={`haptic-tap stats-sheet-option${active ? " is-active" : ""}`}
                onClick={() => {
                  setRangeDraft((prev) => ({ ...prev, preset: preset.value }));
                  setRangeDraftError(null);
                }}
              >
                <span>{preset.label}</span>
                <span aria-hidden="true">{active ? "✓" : ""}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={`haptic-tap stats-sheet-option${rangeDraft.preset === "CUSTOM" ? " is-active" : ""}`}
            onClick={() => {
              setRangeDraft((prev) => ({ ...prev, preset: "CUSTOM" }));
              setRangeDraftError(null);
            }}
          >
            <span>사용자 지정</span>
            <span aria-hidden="true">{rangeDraft.preset === "CUSTOM" ? "✓" : ""}</span>
          </button>
          {rangeDraft.preset === "CUSTOM" ? (
            <div className="stats-range-input-grid">
              <label className="stats-range-input">
                <span className="ui-card-label">시작일</span>
                <input
                  type="date"
                  value={rangeDraft.from}
                  onChange={(event) => {
                    setRangeDraft((prev) => ({ ...prev, from: event.target.value }));
                    setRangeDraftError(null);
                  }}
                />
              </label>
              <label className="stats-range-input">
                <span className="ui-card-label">종료일</span>
                <input
                  type="date"
                  value={rangeDraft.to}
                  onChange={(event) => {
                    setRangeDraft((prev) => ({ ...prev, to: event.target.value }));
                    setRangeDraftError(null);
                  }}
                />
              </label>
              {rangeDraftError ? <p className="stats-range-error">{rangeDraftError}</p> : null}
            </div>
          ) : null}
        </div>
      </BottomSheet>

      <BottomSheet
        open={activeSheet === "program"}
        title="프로그램 필터"
        description="특정 프로그램 기록만 보거나 전체를 볼 수 있습니다."
        onClose={() => setActiveSheet(null)}
        closeLabel="닫기"
        className="stats-sheet stats-sheet--large"
      >
        <div className="stats-sheet-list">
          <button
            type="button"
            className={`haptic-tap stats-sheet-option${selectedPlanId === "" ? " is-active" : ""}`}
            onClick={() => {
              setSelectedPlanId("");
              setActiveSheet(null);
            }}
          >
            <span>전체 프로그램</span>
            <span aria-hidden="true">{selectedPlanId === "" ? "✓" : ""}</span>
          </button>
          {plans.map((plan) => {
            const active = plan.id === selectedPlanId;
            return (
              <button
                key={plan.id}
                type="button"
                className={`haptic-tap stats-sheet-option${active ? " is-active" : ""}`}
                onClick={() => {
                  setSelectedPlanId(plan.id);
                  setActiveSheet(null);
                }}
              >
                <span>{plan.name}</span>
                <span aria-hidden="true">{active ? "✓" : ""}</span>
              </button>
            );
          })}
          {plans.length === 0 ? <div className="stats-sheet-empty">등록된 프로그램이 없습니다.</div> : null}
        </div>
      </BottomSheet>
    </div>
  );
}
