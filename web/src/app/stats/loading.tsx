// PERF: 통계 라우트 loading.tsx - 통계 화면 진입 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function StatsLoading() {
  return (
    <div style={{ padding: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 히어로 섹션 */}
      <div style={{ paddingBottom: "var(--space-sm)" }}>
        <div style={{ ...skeletonStyle, height: 26, width: "60%", marginBottom: 8 }} />
        <div style={{ ...skeletonStyle, height: 14, width: "80%", borderRadius: 4 }} />
      </div>

      {/* 지표 카드 2개 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
            <div style={{ ...skeletonStyle, height: 32, width: "60%", marginBottom: 8 }} />
            <div style={{ ...skeletonStyle, height: 12, width: "70%", borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* 상세 분석 섹션 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 16, width: "45%", marginBottom: 8 }} />
        <div style={{ ...skeletonStyle, height: 12, width: "65%", marginBottom: 16, borderRadius: 4 }} />
        <div style={{ ...skeletonStyle, height: 140, width: "100%", borderRadius: 10 }} />
      </div>

      {/* 플랜 준수율 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 16, width: "40%", marginBottom: 16 }} />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: 12, borderBottom: i === 0 ? "1px solid var(--color-border)" : "none" }}>
            <div>
              <div style={{ ...skeletonStyle, height: 14, width: 120, marginBottom: 6 }} />
              <div style={{ ...skeletonStyle, height: 11, width: 80, borderRadius: 4 }} />
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...skeletonStyle, height: 22, width: 48, marginBottom: 4 }} />
              <div style={{ ...skeletonStyle, height: 10, width: 64, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>

      {/* PR 기록 추적 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 16, width: "35%", marginBottom: 16 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: 12, borderBottom: i < 2 ? "1px solid var(--color-border)" : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...skeletonStyle, height: 14, width: "45%", marginBottom: 6 }} />
              <div style={{ display: "flex", gap: "var(--space-md)" }}>
                <div style={{ ...skeletonStyle, height: 11, width: 60, borderRadius: 4 }} />
                <div style={{ ...skeletonStyle, height: 11, width: 60, borderRadius: 4 }} />
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...skeletonStyle, height: 22, width: 48, marginBottom: 4 }} />
              <div style={{ ...skeletonStyle, height: 10, width: 60, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
