"use client";

type MetricTileProps = {
  label: string;
  value: string;
  trend?: { text: string; className: string };
};

type SparklineChartProps = {
  points: number[];
  labels: string[];
  width?: number;
  height?: number;
};

export function MetricTile({ label, value, trend }: MetricTileProps) {
  return (
    <article className="motion-card rounded-2xl border bg-white p-4">
      <div className="ui-card-label ui-card-label-caps">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {trend ? <div className={`mt-2 text-sm ${trend.className}`}>{trend.text}</div> : null}
    </article>
  );
}

export function SparklineChart({ points, labels, width = 320, height = 90 }: SparklineChartProps) {
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

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full rounded-xl border bg-white text-accent">
      <path d={area} fill="currentColor" fillOpacity="0.12" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx={last.x} cy={last.y} r="3.4" fill="currentColor" />
      <text x={pad} y={height - 4} fontSize="10" fill="currentColor">
        min {Math.round(min)}
      </text>
      <text x={width - pad} y={height - 4} textAnchor="end" fontSize="10" fill="currentColor">
        {labels[labels.length - 1]} · max {Math.round(max)}
      </text>
    </svg>
  );
}
