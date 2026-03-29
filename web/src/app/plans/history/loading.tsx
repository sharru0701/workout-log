// PERF: 플랜 히스토리 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function PlanHistoryLoading() {
  return (
    <div>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Section 1: 플랜 선택 */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ ...skeletonStyle, height: 22, width: "60%", marginBottom: "var(--space-sm)" }} />
        <div style={{ ...skeletonStyle, height: 14, width: "85%", borderRadius: 4, marginBottom: "var(--space-md)" }} />
        {/* 드롭다운 */}
        <div style={{ ...skeletonStyle, height: 48, width: "100%", borderRadius: 10, marginBottom: "var(--space-md)" }} />
        {/* 플랜 정보 카드 */}
        <div style={{ padding: "var(--space-md)", borderRadius: "14px", background: "var(--color-surface-container-low)", border: "1px solid color-mix(in srgb, var(--color-outline-variant) 20%, transparent)" }}>
          <div style={{ ...skeletonStyle, height: 12, width: "30%", marginBottom: "var(--space-sm)", borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 18, width: "55%", marginBottom: "var(--space-sm)" }} />
          <div style={{ ...skeletonStyle, height: 12, width: "45%", borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 12, width: "40%", marginTop: "var(--space-sm)", borderRadius: 4 }} />
        </div>
      </div>

      {/* Section 2: 수행 로그 */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ ...skeletonStyle, height: 18, width: "35%", marginBottom: "var(--space-sm)" }} />
        <div style={{ ...skeletonStyle, height: 14, width: "65%", borderRadius: 4, marginBottom: "var(--space-md)" }} />
        <div style={{ ...skeletonStyle, height: 32, width: "100%", borderRadius: 6, marginBottom: "var(--space-md)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ padding: "var(--space-md)", borderRadius: "14px", background: "var(--color-surface-container-low)", border: "1px solid color-mix(in srgb, var(--color-outline-variant) 20%, transparent)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                <div style={{ ...skeletonStyle, height: 17, width: "55%" }} />
                <div style={{ ...skeletonStyle, height: 14, width: "80%", borderRadius: 4 }} />
                <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                  <div style={{ ...skeletonStyle, height: 20, width: 64, borderRadius: 6 }} />
                  <div style={{ ...skeletonStyle, height: 20, width: 80, borderRadius: 6 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-xs)", marginBottom: "var(--space-md)" }}>
                <div style={{ ...skeletonStyle, height: 32, width: 80, borderRadius: 6 }} />
                <div style={{ ...skeletonStyle, height: 32, width: 96, borderRadius: 6 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-sm)" }}>
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j}>
                    <div style={{ ...skeletonStyle, height: 12, width: "60%", marginBottom: "var(--space-xs)", borderRadius: 4 }} />
                    <div style={{ ...skeletonStyle, height: 20, width: "80%" }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
