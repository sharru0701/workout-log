"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { useLocale } from "@/components/locale-provider";
import { EmptyStateRows, ErrorStateRows } from "@/components/ui/settings-state";
import {
  useStats1RMController,
} from "@/features/stats/model/use-stats-1rm-controller";
import type {
  BaseFilterOption,
  E1RMPoint,
  E1RMResponse,
} from "@/features/stats/model/stats-1rm-types";
import {
  Stats1RMChartSection,
} from "@/features/stats/ui/stats-1rm-chart-section";
import {
  Stats1RMControls,
} from "@/features/stats/ui/stats-1rm-controls";
import {
  Stats1RMOverlaySheets,
} from "@/features/stats/ui/stats-1rm-overlay-sheets";

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
  locale,
}: {
  series: E1RMPoint[];
  activeIndex: number;
  onActiveIndexChange: (nextIndex: number) => void;
  locale: "ko" | "en";
}) {
  const width = 1000;
  const height = 400;
  const padX = 60;
  const padY = 40;
  const drawWidth = width - padX * 2;
  const drawHeight = height - padY * 2;
  const chartGeometry = useMemo(() => {
    if (series.length === 0) {
      return {
        max: 0,
        span: 1,
        points: [] as Array<{ x: number; y: number }>,
        linePath: "",
        areaPath: "",
      };
    }

    const e1rmValues = series.map((point) => point.e1rm);
    const min = Math.min(...e1rmValues);
    const max = Math.max(...e1rmValues);
    const span = Math.max(1, max - min);
    const points = series.map((point, index) => {
      const x =
        padX +
        (series.length === 1
          ? drawWidth / 2
          : (index * drawWidth) / (series.length - 1));
      const y = padY + drawHeight - ((point.e1rm - min) / span) * drawHeight;
      return { x, y };
    });
    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
      .join(" ");
    const areaPath =
      points.length > 0
        ? `${linePath} L ${points[points.length - 1].x},${height - padY} L ${points[0].x},${height - padY} Z`
        : "";

    return { max, span, points, linePath, areaPath };
  }, [drawHeight, drawWidth, height, padX, padY, series]);

  const selectedPoint = chartGeometry.points[activeIndex];
  const selectedData = series[activeIndex];
  const yGuides = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ position: "relative", width: "100%", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          color: "var(--metric-1rm-color)",
        }}
        role="img"
        aria-label={locale === "ko" ? "1RM 추이 차트" : "1RM trend chart"}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onActiveIndexChange(
            resolveIndex(event.clientX, rect.left, rect.width, series.length),
          );
        }}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onActiveIndexChange(
            resolveIndex(event.clientX, rect.left, rect.width, series.length),
          );
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
          const value = chartGeometry.max - chartGeometry.span * ratio;
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
                style={{
                  fill: "var(--color-text-muted)",
                  fontSize: "14px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {value.toFixed(0)}
              </text>
            </g>
          );
        })}

        {chartGeometry.areaPath ? (
          <path d={chartGeometry.areaPath} fill="url(#chartGradient)" />
        ) : null}
        {chartGeometry.linePath ? (
          <path
            d={chartGeometry.linePath}
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

type Stats1RMDetailedPanelProps = {
  refreshTick?: number;
  initialExercises?: BaseFilterOption[];
  initialPlans?: BaseFilterOption[];
  initialStats?: E1RMResponse | null;
  initialSelectedExerciseId?: string | null;
  initialSelectedPlanId?: string;
};

export const Stats1RMDetailedPanel = forwardRef<
  Stats1RMDetailedRef,
  Stats1RMDetailedPanelProps
>(function Stats1RMDetailedPanel(
  {
    refreshTick = 0,
    initialExercises,
    initialPlans,
    initialStats,
    initialSelectedExerciseId,
    initialSelectedPlanId = "",
  },
  ref,
) {
  const { locale } = useLocale();
  const {
    activeSheet,
    setActiveSheet,
    optionsLoading,
    optionsError,
    error,
    loadFilterOptions,
    retryDataLoad,
    exercises,
    selectedExercise,
    selectedProgramLabel,
    rangeFilter,
    rangeDraft,
    setRangeDraft,
    rangeDraftError,
    setRangeDraftError,
    stats,
    activePointIndex,
    setActivePointIndex,
    exerciseQuery,
    setExerciseQuery,
    programQuery,
    setProgramQuery,
    isControlPending,
    filteredExerciseOptions,
    filteredProgramOptions,
    showNoExerciseState,
    showDataEmptyState,
    applyRangeDraft,
    canApplyRangeDraft,
    setPresetRange,
    startFilterTransition,
    setSelectedExerciseId,
    selectedSeries: series,
  } = useStats1RMController({
    locale,
    refreshTick,
    initialExercises,
    initialPlans,
    initialStats,
    initialSelectedExerciseId,
    initialSelectedPlanId,
  });

  useImperativeHandle(
    ref,
    () => ({
      selectExercise: (target: string) => {
        startFilterTransition(() => {
          const normalized = target.trim();
          const matchedExercise = exercises.find(
            (entry) =>
              entry.id === normalized ||
              entry.name === normalized ||
              entry.searchText === normalized.toLowerCase(),
          );
          setSelectedExerciseId(matchedExercise?.id ?? normalized);
        });
      },
    }),
    [exercises, setSelectedExerciseId, startFilterTransition],
  );

  const hasChartData = series.length > 0;
  const resolvedActiveIndex = hasChartData
    ? clampIndex(activePointIndex, series.length)
    : 0;
  const activePoint = hasChartData ? series[resolvedActiveIndex] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <Stats1RMControls
        locale={locale}
        selectedExerciseName={selectedExercise?.name ?? null}
        selectedProgramLabel={selectedProgramLabel}
        rangePreset={rangeFilter.preset}
        isControlPending={isControlPending}
        onOpenExerciseSheet={() => setActiveSheet("exercise")}
        onOpenProgramSheet={() => setActiveSheet("program")}
        onOpenRangeSheet={() => setActiveSheet("range")}
        onSelectPreset={setPresetRange}
      />

      <div>
        <ErrorStateRows
          message={optionsError}
          title={
            locale === "ko"
              ? "필터 옵션을 불러오지 못했습니다"
              : "Could not load filter options"
          }
          onRetry={() => {
            void loadFilterOptions();
          }}
        />
        <EmptyStateRows
          when={showNoExerciseState}
          label={locale === "ko" ? "운동종목이 없습니다" : "No exercises"}
          description={
            locale === "ko"
              ? "운동종목이 준비되면 1RM 그래프를 표시할 수 있습니다."
              : "Once exercises are available, the 1RM chart can be shown."
          }
        />

        {!showNoExerciseState ? (
          <>
            <ErrorStateRows
              message={error}
              title={
                locale === "ko"
                  ? "1RM 데이터를 불러오지 못했습니다"
                  : "Could not load 1RM data"
              }
              onRetry={() => {
                retryDataLoad();
              }}
            />
            <EmptyStateRows
              when={showDataEmptyState}
              label={
                locale === "ko"
                  ? "선택한 필터 조합에 데이터가 없습니다"
                  : "No data for the selected filters"
              }
              description={
                locale === "ko"
                  ? "필터를 변경하거나 운동 기록을 추가한 뒤 다시 확인하세요."
                  : "Change the filters or add workout logs, then check again."
              }
            />
          </>
        ) : null}

        {hasChartData ? (
          <Stats1RMChartSection
            locale={locale}
            stats={stats}
            activePoint={activePoint}
            chart={
              <E1RMInteractiveChart
                series={series}
                activeIndex={resolvedActiveIndex}
                onActiveIndexChange={setActivePointIndex}
                locale={locale}
              />
            }
          />
        ) : null}
      </div>

      <Stats1RMOverlaySheets
        locale={locale}
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        exerciseQuery={exerciseQuery}
        onExerciseQueryChange={setExerciseQuery}
        filteredExerciseOptions={filteredExerciseOptions}
        programQuery={programQuery}
        onProgramQueryChange={setProgramQuery}
        filteredProgramOptions={filteredProgramOptions}
        optionsLoading={optionsLoading}
        rangeDraft={rangeDraft}
        onRangeDraftChange={(nextRangeDraft) => {
          setRangeDraft(nextRangeDraft);
          setRangeDraftError(null);
        }}
        rangeDraftError={rangeDraftError}
        applyRangeDraft={applyRangeDraft}
        canApplyRangeDraft={canApplyRangeDraft}
      />
    </div>
  );
});
