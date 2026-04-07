"use client";

import {
  forwardRef,
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useLocale } from "@/components/locale-provider";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SearchSelectSheet } from "@/components/ui/search-select-sheet";
import { EmptyStateRows, ErrorStateRows } from "@/components/ui/settings-state";
import { apiGet } from "@/lib/api";
import { useQuerySettled } from "@/lib/ui/use-query-settled";
import { CalendarRangePicker } from "@/components/ui/calendar-range-picker";

type BaseFilterOption = {
  id: string;
  name: string;
};

type ExerciseOption = {
  id: string;
  name: string;
  searchText: string;
};

type PlanOption = {
  id: string;
  name: string;
  searchText: string;
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
    from: dateDaysAgoDateOnly(90),
    to: toDateOnly(new Date()),
  };
}

function withSearchText<T extends BaseFilterOption>(items: T[]) {
  return items.map((item) => ({
    ...item,
    searchText: item.name.toLowerCase(),
  }));
}

function deriveRangeFilterFromStats(stats: E1RMResponse): RangeFilter {
  const from = stats.from.slice(0, 10);
  const to = stats.to.slice(0, 10);
  const presetByDays = new Map<number, RangePreset>([
    [7, 7],
    [30, 30],
    [90, 90],
    [180, 180],
    [365, 365],
  ]);
  return {
    preset: presetByDays.get(stats.rangeDays) ?? "CUSTOM",
    from,
    to,
  };
}

function formatPointDate(dateIso: string, locale: "ko" | "en") {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
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
    <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'wght' 400", lineHeight: 1 }}>calendar_today</span>
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
      const x = padX + (series.length === 1 ? drawWidth / 2 : (index * drawWidth) / (series.length - 1));
      const y = padY + drawHeight - ((point.e1rm - min) / span) * drawHeight;
      return { x, y };
    });
    const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
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
        style={{ width: "100%", height: "auto", display: "block", color: "var(--metric-1rm-color)" }}
        role="img"
        aria-label={locale === "ko" ? "1RM 추이 차트" : "1RM trend chart"}
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
                style={{ fill: "var(--color-text-muted)", fontSize: "14px", fontVariantNumeric: "tabular-nums" }}
              >
                {value.toFixed(0)}
              </text>
            </g>
          );
        })}

        {chartGeometry.areaPath ? <path d={chartGeometry.areaPath} fill="url(#chartGradient)" /> : null}
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

type Stats1RMDetailedProps = {
  refreshTick?: number;
  initialExercises?: BaseFilterOption[];
  initialPlans?: BaseFilterOption[];
  initialStats?: E1RMResponse | null;
  initialSelectedExerciseId?: string | null;
  initialSelectedPlanId?: string;
};

export const Stats1RMDetailed = forwardRef<Stats1RMDetailedRef, Stats1RMDetailedProps>(function Stats1RMDetailed({
  refreshTick = 0,
  initialExercises,
  initialPlans,
  initialStats,
  initialSelectedExerciseId,
  initialSelectedPlanId = "",
}, ref) {
  const { locale } = useLocale();
  const initialRangeFilter = useMemo(
    () => (initialStats ? deriveRangeFilterFromStats(initialStats) : toDefaultRange()),
    [initialStats],
  );
  const initialExerciseOptions = useMemo(() => withSearchText(initialExercises ?? []), [initialExercises]);
  const initialPlanOptions = useMemo(() => withSearchText(initialPlans ?? []), [initialPlans]);
  const hasInitialOptions = initialExercises !== undefined && initialPlans !== undefined;
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [optionsLoading, setOptionsLoading] = useState(!hasInitialOptions);
  const optionsHasLoadedRef = useRef(hasInitialOptions);
  const [optionsLoadKey, setOptionsLoadKey] = useState(hasInitialOptions ? "stats-1rm:options:hydrated" : "stats-1rm:options:init");
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dataHasLoadedRef = useRef(Boolean(initialStats));
  const [dataLoadKey, setDataLoadKey] = useState<string | null>(initialStats ? "stats-1rm:data:hydrated" : null);
  const [error, setError] = useState<string | null>(null);
  const [internalRefreshTick, setInternalRefreshTick] = useState(0);
  const [exercises, setExercises] = useState<ExerciseOption[]>(initialExerciseOptions);
  const [plans, setPlans] = useState<PlanOption[]>(initialPlanOptions);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    initialSelectedExerciseId ?? initialExerciseOptions[0]?.id ?? null,
  );
  const [selectedPlanId, setSelectedPlanId] = useState(initialSelectedPlanId);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(initialRangeFilter);
  const [rangeDraft, setRangeDraft] = useState<RangeFilter>(initialRangeFilter);
  const [rangeDraftError, setRangeDraftError] = useState<string | null>(null);
  const [stats, setStats] = useState<E1RMResponse | null>(initialStats ?? null);
  const [activePointIndex, setActivePointIndex] = useState(
    initialStats?.series.length ? initialStats.series.length - 1 : 0,
  );
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [programQuery, setProgramQuery] = useState("");
  const deferredExerciseQuery = useDeferredValue(exerciseQuery);
  const deferredProgramQuery = useDeferredValue(programQuery);
  const [isFilterPending, startFilterTransition] = useTransition();
  const [isRangePending, startRangeTransition] = useTransition();

  useImperativeHandle(ref, () => ({
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
  }), [exercises, startFilterTransition]);

  const selectedExercise = useMemo(
    () => exercises.find((entry) => entry.id === selectedExerciseId) ?? null,
    [exercises, selectedExerciseId],
  );
  const selectedProgramLabel = useMemo(() => {
    if (!selectedPlanId) return locale === "ko" ? "전체 플랜" : "All Plans";
    return plans.find((entry) => entry.id === selectedPlanId)?.name ?? (locale === "ko" ? "선택된 플랜" : "Selected Plan");
  }, [locale, plans, selectedPlanId]);
  const series = stats?.series ?? [];
  const hasChartData = series.length > 0;
  const resolvedActiveIndex = hasChartData ? clampIndex(activePointIndex, series.length) : 0;
  const activePoint = hasChartData ? series[resolvedActiveIndex] : null;
  const activeDataQueryKey = useMemo(() => {
    if (!selectedExerciseId) return null;
    return [selectedExerciseId, selectedPlanId || "", rangeFilter.preset, rangeFilter.from, rangeFilter.to, refreshTick, internalRefreshTick].join("|");
  }, [rangeFilter.from, rangeFilter.preset, rangeFilter.to, refreshTick, internalRefreshTick, selectedExerciseId, selectedPlanId]);
  const hydratedDataQueryKeyRef = useRef<string | null>(initialStats ? activeDataQueryKey : null);
  const isOptionsSettled = useQuerySettled(optionsLoadKey, optionsLoading);
  const isDataSettled = useQuerySettled(dataLoadKey, loading);

  const loadFilterOptions = useCallback(async () => {
    try {
      if (optionsHasLoadedRef.current) {
        return;
      }
      if (!optionsHasLoadedRef.current) {
        setOptionsLoading(true);
      }
      setOptionsLoadKey(`stats-1rm:options:${Date.now()}`);
      setOptionsError(null);
      const [exerciseRes, planRes] = await Promise.all([
        apiGet<ExercisesResponse>("/api/exercises?limit=200"),
        apiGet<PlansResponse>("/api/plans"),
      ]);
      const nextExercises = withSearchText(exerciseRes.items ?? []);
      const nextPlans = withSearchText(planRes.items ?? []);

      setExercises(nextExercises);
      setPlans(nextPlans);
      setSelectedExerciseId((prev) => {
        if (prev) {
          const matchedExercise = nextExercises.find(
            (entry) => entry.id === prev || entry.searchText === prev.trim().toLowerCase(),
          );
          if (matchedExercise) return matchedExercise.id;
        }
        return nextExercises[0]?.id ?? null;
      });
      setSelectedPlanId((prev) => (prev && nextPlans.some((entry) => entry.id === prev) ? prev : ""));
      optionsHasLoadedRef.current = true;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setOptionsError(e?.message ?? (locale === "ko" ? "필터 옵션을 불러오지 못했습니다." : "Could not load filter options."));
    } finally {
      setOptionsLoading(false);
    }
  }, [locale]);

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

    if (hydratedDataQueryKeyRef.current === activeDataQueryKey && dataHasLoadedRef.current) {
      hydratedDataQueryKeyRef.current = null;
      setDataLoadKey(`stats-1rm:data:hydrated:${activeDataQueryKey}`);
      return;
    }

    let cancelled = false;
    const nextLoadKey = `stats-1rm:data:${activeDataQueryKey}:${Date.now()}`;
    const controller = new AbortController();

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

        const response = await apiGet<E1RMResponse>(path, { signal: controller.signal });
        if (cancelled) return;
        setStats(response);
        setActivePointIndex(response.series.length > 0 ? response.series.length - 1 : 0);
        dataHasLoadedRef.current = true;
      } catch (e: any) {
        if (cancelled) return;
        if (e?.name === "AbortError") return;
        setError(e?.message ?? (locale === "ko" ? "1RM 데이터를 불러오지 못했습니다." : "Could not load 1RM data."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeDataQueryKey, locale, rangeFilter, selectedExerciseId, selectedPlanId]);

  const applyRangeDraft = () => {
    if (rangeDraft.preset === "CUSTOM") {
      if (!rangeDraft.from || !rangeDraft.to) {
        setRangeDraftError(locale === "ko" ? "시작일과 종료일을 모두 입력하세요." : "Enter both a start date and end date.");
        return;
      }
      if (rangeDraft.from > rangeDraft.to) {
        setRangeDraftError(locale === "ko" ? "시작일이 종료일보다 늦을 수 없습니다." : "The start date cannot be later than the end date.");
        return;
      }
      startRangeTransition(() => {
        setRangeFilter(rangeDraft);
        setActiveSheet(null);
      });
      return;
    }

    const nextPreset = rangeDraft.preset;
    const nextRange: RangeFilter = {
      preset: nextPreset,
      from: dateDaysAgoDateOnly(nextPreset),
      to: toDateOnly(new Date()),
    };
    startRangeTransition(() => {
      setRangeFilter(nextRange);
      setActiveSheet(null);
    });
  };

  const canApplyRangeDraft =
    rangeDraft.preset !== "CUSTOM" ||
    (Boolean(rangeDraft.from) && Boolean(rangeDraft.to) && rangeDraft.from <= rangeDraft.to);

  const filteredExerciseOptions = useMemo(() => {
    const q = deferredExerciseQuery.trim().toLowerCase();
    return exercises
      .filter((ex) => !q || ex.searchText.includes(q))
      .map((ex) => ({
        key: ex.id,
        label: ex.name,
        active: ex.id === selectedExerciseId,
        ariaCurrent: ex.id === selectedExerciseId,
        onSelect: () => {
          startFilterTransition(() => {
            setSelectedExerciseId(ex.id);
            setActiveSheet(null);
          });
        },
      }));
  }, [deferredExerciseQuery, exercises, selectedExerciseId, startFilterTransition]);

  const filteredProgramOptions = useMemo(() => {
    const q = deferredProgramQuery.trim().toLowerCase();
    const allOption = {
      key: "__all__",
      label: locale === "ko" ? "전체 플랜" : "All Plans",
      active: selectedPlanId === "",
      ariaCurrent: selectedPlanId === "",
      onSelect: () => {
        startFilterTransition(() => {
          setSelectedPlanId("");
          setActiveSheet(null);
        });
      },
    };
    const planOptions = plans
      .filter((plan) => !q || plan.searchText.includes(q))
      .map((plan) => ({
        key: plan.id,
        label: plan.name,
        active: plan.id === selectedPlanId,
        ariaCurrent: plan.id === selectedPlanId,
        onSelect: () => {
          startFilterTransition(() => {
            setSelectedPlanId(plan.id);
            setActiveSheet(null);
          });
        },
      }));
    if (q && !(locale === "ko" ? "전체 플랜" : "All Plans").toLowerCase().includes(q)) return planOptions;
    return [allOption, ...planOptions];
  }, [deferredProgramQuery, locale, plans, selectedPlanId, startFilterTransition]);

  const showNoExerciseState = isOptionsSettled && !optionsError && exercises.length === 0;
  const showDataEmptyState = isDataSettled && !error && !showNoExerciseState && series.length === 0;
  const showChartSection = hasChartData;
  const isControlPending = isFilterPending || isRangePending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
        <button
          type="button"
          onClick={() => setActiveSheet("exercise")}
          className="btn"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px var(--space-md)",
            border: "none",
            borderRadius: "14px",
            backgroundColor: "var(--color-surface-container-low)",
            cursor: "pointer",
            textAlign: "left",
            boxShadow: "0 1px 3px var(--shadow-color-soft)"
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "2px", fontWeight: 500 }}>{locale === "ko" ? "운동종목" : "Exercise"}</div>
            <div style={{ font: "var(--font-body)", fontWeight: 700, color: "var(--color-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: isControlPending ? 0.72 : 1 }}>
              {selectedExercise?.name ?? (locale === "ko" ? "선택" : "Select")}
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
            border: "none",
            borderRadius: "14px",
            backgroundColor: "var(--color-surface-container-low)",
            cursor: "pointer",
            textAlign: "left",
            boxShadow: "0 1px 3px var(--shadow-color-soft)"
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "2px", fontWeight: 500 }}>{locale === "ko" ? "필터링" : "Filter"}</div>
            <div style={{ font: "var(--font-body)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: isControlPending ? 0.72 : 1 }}>
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
        <div style={{ background: "var(--color-surface-container)", borderRadius: "12px", overflow: "hidden", padding: "3px" }}>
          <div style={{ display: "flex", gap: "2px" }}>
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
                    startRangeTransition(() => {
                      setRangeFilter({
                        preset,
                        from: dateDaysAgoDateOnly(preset === "CUSTOM" ? 90 : preset),
                        to: toDateOnly(new Date()),
                      });
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
              aria-label={locale === "ko" ? "기간 지정" : "Choose date range"}
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
        </div>
      </div>

      <div>
        <ErrorStateRows
          message={optionsError}
          title={locale === "ko" ? "필터 옵션을 불러오지 못했습니다" : "Could not load filter options"}
          onRetry={() => {
            void loadFilterOptions();
          }}
        />
        <EmptyStateRows
          when={showNoExerciseState}
          label={locale === "ko" ? "운동종목이 없습니다" : "No exercises"}
          description={locale === "ko" ? "운동종목이 준비되면 1RM 그래프를 표시할 수 있습니다." : "Once exercises are available, the 1RM chart can be shown."}
        />

        {!showNoExerciseState && (
          <>
            <ErrorStateRows
              message={error}
              title={locale === "ko" ? "1RM 데이터를 불러오지 못했습니다" : "Could not load 1RM data"}
              onRetry={() => {
                setInternalRefreshTick((prev) => prev + 1);
              }}
            />
            <EmptyStateRows
              when={showDataEmptyState}
              label={locale === "ko" ? "선택한 필터 조합에 데이터가 없습니다" : "No data for the selected filters"}
              description={locale === "ko" ? "필터를 변경하거나 운동 기록을 추가한 뒤 다시 확인하세요." : "Change the filters or add workout logs, then check again."}
            />
          </>
        )}

        {showChartSection && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div style={{ background: "var(--color-surface-container-low)", borderRadius: "20px", overflow: "hidden", boxShadow: "0 1px 3px var(--shadow-color-soft)" }}>
              <header style={{ padding: "var(--space-md)", borderBottom: "1px solid color-mix(in srgb, var(--color-outline-variant) 12%, transparent)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-text)", margin: "0 0 2px 0" }}>
                      {locale === "ko" ? "e1RM 상세 추이" : "Detailed e1RM Trend"}
                    </h2>
                    {stats && (
                      <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                        {formatPointDate(stats.from, locale)} ~ {formatPointDate(stats.to, locale)}
                      </div>
                    )}
                  </div>
                  <div className="metric-1rm" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span className="metric-value" style={{ fontSize: "24px" }}>
                      {activePoint ? `${activePoint.e1rm.toFixed(1)}` : "-"}
                      <span style={{ fontSize: "14px", marginLeft: "2px", fontWeight: 400 }}>kg</span>
                    </span>
                    <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)" }}>
                      {activePoint ? `${formatPointDate(activePoint.date, locale)}` : "-"}
                    </span>
                  </div>
                </div>
              </header>

              <div style={{ padding: "var(--space-md)" }}>
                <E1RMInteractiveChart
                  series={series}
                  activeIndex={resolvedActiveIndex}
                  onActiveIndexChange={setActivePointIndex}
                  locale={locale}
                />
              </div>

              {activePoint && (
                <div style={{ padding: "0 var(--space-md) var(--space-md) var(--space-md)", display: "flex", gap: "var(--space-sm)" }}>
                  <div className="label label-neutral label-sm">
                    {activePoint.weightKg}kg × {activePoint.reps}{locale === "ko" ? "회" : " reps"}
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: "var(--color-surface-container-low)", borderRadius: "20px", padding: "var(--space-md)", boxShadow: "0 1px 3px var(--shadow-color-soft)" }}>
              <div className="metric-1rm" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="metric-label" style={{ display: "block", marginBottom: "2px" }}>{locale === "ko" ? "최고 e1RM" : "Best e1RM"}</span>
                  <span style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)", fontSize: "13px" }}>
                    {stats?.best ? formatPointDate(stats.best.date, locale) : "-"}
                  </span>
                </div>
                <div className="metric-value" style={{ fontSize: "24px", textAlign: "right" }}>
                  {stats?.best ? stats.best.e1rm.toFixed(1) : "-"}
                  <span style={{ fontSize: "14px", marginLeft: "2px", fontWeight: 400 }}>kg</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <SearchSelectSheet
        open={activeSheet === "exercise"}
        title={locale === "ko" ? "운동종목 필터" : "Exercise Filter"}
        description={locale === "ko" ? "그래프 대상 운동종목을 선택합니다." : "Choose the exercise to plot."}
        onClose={() => setActiveSheet(null)}
        closeLabel={locale === "ko" ? "닫기" : "Close"}
        query={exerciseQuery}
        placeholder={locale === "ko" ? "운동종목 검색..." : "Search exercises..."}
        onQueryChange={setExerciseQuery}
        resultsAriaLabel={locale === "ko" ? "운동종목 목록" : "Exercise list"}
        options={filteredExerciseOptions}
        emptyText={locale === "ko" ? "검색 결과가 없습니다." : "No results found."}
        loading={optionsLoading}
        loadingText={locale === "ko" ? "운동종목 불러오는 중..." : "Loading exercises..."}
      />

      <BottomSheet
        open={activeSheet === "range"}
        title={locale === "ko" ? "기간 필터" : "Date Range Filter"}
        description={locale === "ko" ? "기간을 선택하면 필터 조합으로 다시 조회합니다." : "Choose a range to refetch the chart with the selected filters."}
        onClose={() => setActiveSheet(null)}
        closeLabel={locale === "ko" ? "닫기" : "Close"}
        primaryAction={{
          ariaLabel: locale === "ko" ? "기간 적용" : "Apply range",
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
        title={locale === "ko" ? "플랜 필터" : "Plan Filter"}
        description={locale === "ko" ? "특정 플랜 기록만 보거나 전체를 볼 수 있습니다." : "View logs for a specific plan or across all plans."}
        onClose={() => setActiveSheet(null)}
        closeLabel={locale === "ko" ? "닫기" : "Close"}
        query={programQuery}
        placeholder={locale === "ko" ? "플랜 검색..." : "Search plans..."}
        onQueryChange={setProgramQuery}
        resultsAriaLabel={locale === "ko" ? "플랜 목록" : "Plan list"}
        options={filteredProgramOptions}
        emptyText={locale === "ko" ? "검색 결과가 없습니다." : "No results found."}
        loading={optionsLoading}
        loadingText={locale === "ko" ? "플랜 불러오는 중..." : "Loading plans..."}
      />
    </div>
  );
});
