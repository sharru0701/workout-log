"use client";

import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";

type MetricTileProps = {
  label: string;
  value: string;
  trend?: { text: string; color: string };
};

type SparklineChartProps = {
  points: number[];
  labels: string[];
  width?: number;
  height?: number;
};

export const MetricTile = memo(function MetricTile({ label, value, trend }: MetricTileProps) {
  return (
    <Card as="article" padding="md">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {trend ? (
        <div style={{ 
          marginTop: "var(--space-xs)", 
          fontSize: "12px", 
          fontWeight: 600, 
          color: trend.color 
        }}>
          {trend.text}
        </div>
      ) : null}
    </Card>
  );
});

export const SparklineChart = memo(function SparklineChart({ points, labels, width = 320, height = 90 }: SparklineChartProps) {
  const chart = useMemo(() => {
    if (!points.length) return null;

    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = Math.max(1e-9, max - min);
    const pad = 10;
    const w = width - pad * 2;
    const h = height - pad * 2;

    const coords = points.map((value, index) => {
      const x = pad + (points.length === 1 ? w / 2 : (index * w) / (points.length - 1));
      const y = pad + h - ((value - min) / span) * h;
      return { x, y };
    });

    const d = coords.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`).join(" ");
    const last = coords[coords.length - 1];
    const area = `${d} L ${last.x.toFixed(1)} ${(height - pad).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(height - pad).toFixed(1)} Z`;

    return {
      area,
      d,
      last,
      min,
      max,
      pad,
    };
  }, [height, points, width]);

  if (!chart) return null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ background: "transparent", color: "var(--color-primary)" }}>
      <path d={chart.area} fill="currentColor" fillOpacity="0.08" />
      <path d={chart.d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={chart.last.x} cy={chart.last.y} r="3.5" fill="currentColor" />
      <circle cx={chart.last.x} cy={chart.last.y} r="6" fill="currentColor" fillOpacity="0.1" />
      <text x={chart.pad} y={height - 4} fontSize="10" fontWeight="500" fill="var(--color-text-muted)">
        min {Math.round(chart.min)}
      </text>
      <text x={width - chart.pad} y={height - 4} textAnchor="end" fontSize="10" fontWeight="500" fill="var(--color-text-muted)">
        {labels[labels.length - 1]} · max {Math.round(chart.max)}
      </text>
    </svg>
  );
});
