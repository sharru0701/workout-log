// PERF: 플랜 히스토리 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function PlanHistoryLoading() {
  return (
    <div style={{ padding: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 섹션 헤더 */}
      <div style={{ paddingBottom: "var(--space-xs)" }}>
        <div style={{ ...skeletonStyle, height: 22, width: "60%", marginBottom: 8 }} />
        <div style={{ ...skeletonStyle, height: 13, width: "85%", borderRadius: 4 }} />
      </div>

      {/* 플랜 선택 드롭다운 스켈레톤 */}
      <div style={{ ...skeletonStyle, height: 44, width: "100%", borderRadius: 10 }} />

      {/* 수행 로그 섹션 헤더 */}
      <div style={{ paddingTop: "var(--space-sm)", paddingBottom: "var(--space-xs)" }}>
        <div style={{ ...skeletonStyle, height: 18, width: "35%", marginBottom: 8 }} />
        <div style={{ ...skeletonStyle, height: 13, width: "65%", borderRadius: 4 }} />
      </div>

      {/* 로그 카드 스켈레톤 2개 */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 16, width: "45%", marginBottom: 8 }} />
          <div style={{ ...skeletonStyle, height: 13, width: "70%", marginBottom: 12, borderRadius: 4 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-sm)" }}>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j}>
                <div style={{ ...skeletonStyle, height: 11, width: "60%", marginBottom: 4, borderRadius: 4 }} />
                <div style={{ ...skeletonStyle, height: 18, width: "80%" }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
