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

      {/* Page header */}
      <div style={{ marginBottom: "var(--space-xl)", paddingBottom: "var(--space-md)", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ ...skeletonStyle, height: 10, width: "30%", marginBottom: "var(--space-sm)", borderRadius: 4 }} />
        <div style={{ ...skeletonStyle, height: 32, width: "50%", marginBottom: "var(--space-sm)" }} />
        <div style={{ ...skeletonStyle, height: 14, width: "75%", borderRadius: 4 }} />
      </div>

      {/* Period chips */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "var(--space-lg)" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ ...skeletonStyle, height: 32, width: 48, borderRadius: 20 }} />
        ))}
      </div>

      {/* Bento metrics 2×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)", marginBottom: "var(--space-xl)" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ padding: "16px", borderRadius: "14px", background: "var(--color-surface-container-low)", border: "1px solid color-mix(in srgb, var(--color-outline-variant) 25%, transparent)" }}>
            <div style={{ ...skeletonStyle, height: 10, width: "60%", marginBottom: "10px", borderRadius: 4 }} />
            <div style={{ ...skeletonStyle, height: 38, width: "70%" }} />
            <div style={{ ...skeletonStyle, height: 12, width: "50%", marginTop: "6px", borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Section: 상세 추이 */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ ...skeletonStyle, height: 10, width: "25%", marginBottom: "6px", borderRadius: 4 }} />
        <div style={{ ...skeletonStyle, height: 18, width: "45%", marginBottom: "var(--space-sm)" }} />
        <div style={{ ...skeletonStyle, height: 200, width: "100%", borderRadius: 10 }} />
      </div>

      {/* Section: PR 기록 */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ ...skeletonStyle, height: 10, width: "30%", marginBottom: "6px", borderRadius: 4 }} />
        <div style={{ ...skeletonStyle, height: 18, width: "40%", marginBottom: "var(--space-sm)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ padding: "12px 14px", borderRadius: "10px", background: "var(--color-surface-container-low)", display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...skeletonStyle, height: 14, width: "55%", marginBottom: "6px" }} />
                <div style={{ ...skeletonStyle, height: 12, width: "70%", borderRadius: 4 }} />
              </div>
              <div style={{ ...skeletonStyle, height: 20, width: 40, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Section: 준수율 */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ ...skeletonStyle, height: 10, width: "28%", marginBottom: "6px", borderRadius: 4 }} />
        <div style={{ ...skeletonStyle, height: 18, width: "38%", marginBottom: "var(--space-sm)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ padding: "12px 14px", borderRadius: "10px", background: "var(--color-surface-container-low)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...skeletonStyle, height: 14, width: "50%", marginBottom: "6px" }} />
                  <div style={{ ...skeletonStyle, height: 4, width: "100%", borderRadius: 2 }} />
                </div>
                <div style={{ ...skeletonStyle, height: 24, width: 40, marginLeft: "var(--space-sm)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
