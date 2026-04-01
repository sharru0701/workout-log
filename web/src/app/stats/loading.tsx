// PERF: 통계 라우트 loading.tsx - 통계 화면 진입 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function StatsLoading() {
  return (
    <div>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: "var(--space-xl)", paddingBottom: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 12, width: "30%", marginBottom: "8px", borderRadius: 4 }} />
        <div style={{ ...skeletonStyle, height: 34, width: "50%", marginBottom: "8px", borderRadius: 6 }} />
        <div style={{ ...skeletonStyle, height: 16, width: "85%", borderRadius: 4 }} />
      </div>

      {/* ── Detailed Trend Analysis ── */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        {/* Section Heading */}
        <div style={{ marginBottom: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 12, width: "25%", marginBottom: 6, borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 20, width: "45%", marginBottom: 6, borderRadius: 6 }} />
          <div style={{ ...skeletonStyle, height: 14, width: "65%", borderRadius: 4 }} />
        </div>
        
        {/* Chart Mock */}
        <div style={{ marginTop: "var(--space-sm)" }}>
          <div style={{ ...skeletonStyle, height: 240, width: "100%", borderRadius: 16 }} />
        </div>
      </div>

      {/* ── PR Tracking ── */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        {/* Section Heading */}
        <div style={{ marginBottom: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 12, width: "30%", marginBottom: 6, borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 20, width: "40%", marginBottom: 6, borderRadius: 6 }} />
          <div style={{ ...skeletonStyle, height: 14, width: "70%", borderRadius: 4 }} />
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-sm)",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "var(--color-surface-container-low)",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ ...skeletonStyle, height: 16, width: "55%", marginBottom: "6px" }} />
                <div style={{ ...skeletonStyle, height: 14, width: "70%", borderRadius: 4 }} />
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...skeletonStyle, height: 18, width: 40, borderRadius: 4, marginBottom: "4px", marginLeft: "auto" }} />
                <div style={{ ...skeletonStyle, height: 12, width: 60, borderRadius: 4, marginLeft: "auto" }} />
              </div>
              <div style={{ ...skeletonStyle, height: 24, width: 24, borderRadius: "50%", flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Plan Compliance ── */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        {/* Section Heading */}
        <div style={{ marginBottom: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 12, width: "28%", marginBottom: 6, borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 20, width: "38%", marginBottom: 6, borderRadius: 6 }} />
          <div style={{ ...skeletonStyle, height: 14, width: "60%", borderRadius: 4 }} />
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-sm)",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "var(--color-surface-container-low)",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ ...skeletonStyle, height: 16, width: "50%", marginBottom: "6px" }} />
                <div style={{ ...skeletonStyle, height: 14, width: "40%", marginBottom: "8px", borderRadius: 4 }} />
                <div style={{ ...skeletonStyle, height: 4, width: "100%", borderRadius: 2 }} />
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ ...skeletonStyle, height: 24, width: 44, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
