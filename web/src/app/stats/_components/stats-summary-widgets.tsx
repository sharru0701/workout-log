"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { apiGet } from "@/shared/api/api";
import { ErrorStateRows, EmptyStateRows } from "@/shared/ui/settings-state";

type StrengthSummaryItem = {
  exerciseId: string | null;
  exerciseName: string;
  current: {
    e1rm: number;
    date: string;
    weightKg: number;
    reps: number;
  };
  best: {
    e1rm: number;
    date: string;
  };
  recentSeries: number[];
  improvement: number;
};

type StrengthSummaryResponse = {
  items: StrengthSummaryItem[];
};

export const StrengthSummaryGrid = memo(function StrengthSummaryGrid({ onExerciseSelect }: { onExerciseSelect?: (id: string, name: string) => void }) {
  const { locale } = useLocale();
  const [data, setData] = useState<StrengthSummaryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet<StrengthSummaryResponse>("/api/stats/strength-summary?days=60&limit=4");
      setData(res.items);
    } catch (e: any) {
      setError(e?.message ?? (locale === "ko" ? "데이터를 불러오지 못했습니다." : "Could not load the data."));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) return null;
  if (error) return <ErrorStateRows message={error} onRetry={loadData} />;
  if (!data || data.length === 0) return <EmptyStateRows when={true} label={locale === "ko" ? "기록된 운동이 없습니다." : "No recorded exercises."} description={locale === "ko" ? "무거운 중량으로 운동을 기록하면 여기에 나타납니다." : "Heavy logged lifts will appear here."} />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "var(--space-md)" }}>
      {data.map((item) => (
        <StrengthCard key={item.exerciseName} item={item} locale={locale} onClick={() => item.exerciseId && onExerciseSelect?.(item.exerciseId, item.exerciseName)} />
      ))}
    </div>
  );
});

function StrengthCard({ item, locale, onClick }: { item: StrengthSummaryItem; locale: "ko" | "en"; onClick?: () => void }) {
  const isPr = item.current.e1rm >= item.best.e1rm;
  
  return (
    <div
      onClick={onClick}
      className="metric-badge metric-1rm"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
        cursor: onClick ? "pointer" : "default",
        minHeight: "124px",
        padding: "var(--space-md)",
        background: "var(--color-surface-container-low)",
        borderRadius: "20px",
        boxShadow: "0 1px 3px var(--shadow-color-soft)",
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ font: "var(--font-secondary)", color: "var(--color-text-muted)", fontWeight: 500, fontSize: "12px" }}>
          {item.exerciseName}
        </div>
        {isPr && (
          <span className="label label-pr label-sm" style={{ fontSize: "10px", padding: "1px 6px" }}>PR</span>
        ) || (
          <span className="label label-neutral label-sm" style={{ opacity: 0.6, fontSize: "10px", padding: "1px 6px" }}>e1RM</span>
        )}
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="metric-value" style={{ fontSize: "32px", lineHeight: 1, marginBottom: "2px" }}>
          {item.current.e1rm.toFixed(1)}<span style={{ fontSize: "14px", marginLeft: "2px", color: "var(--color-text-muted)", fontWeight: 400 }}>kg</span>
        </div>
      </div>

      <footer style={{ marginTop: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{locale === "ko" ? "최고" : "Best"}: {item.best.e1rm.toFixed(1)}kg</span>
          {item.improvement !== 0 && (
            <span className={`metric-trend ${item.improvement > 0 ? "metric-trend--up" : "metric-trend--down"}`} style={{ marginTop: 0, fontSize: "11px" }}>
              {item.improvement > 0 ? "+" : ""}{item.improvement.toFixed(1)}%
            </span>
          )}
        </div>
        <div style={{ height: "16px", width: "100%", opacity: 0.8 }}>
          <MiniSparkline points={item.recentSeries} />
        </div>
      </footer>
    </div>
  );
}

function MiniSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div style={{ height: "1px", background: "var(--color-border)", width: "100%", opacity: 0.3 }} />;
  
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 100;
  const height = 16;
  
  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline-chart" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}
