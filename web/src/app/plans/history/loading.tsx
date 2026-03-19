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

      {/* 선택된 플랜 정보 카드 */}
      <div className="card" style={{ padding: "var(--space-sm)" }}>
        <div style={{ ...skeletonStyle, height: 11, width: "30%", marginBottom: 6, borderRadius: 4 }} />
        <div style={{ ...skeletonStyle, height: 16, width: "55%", marginBottom: 6 }} />
        <div style={{ ...skeletonStyle, height: 11, width: "45%", borderRadius: 4 }} />
        <div style={{ ...skeletonStyle, height: 11, width: "40%", marginTop: 8, borderRadius: 4 }} />
      </div>

      {/* 수행 로그 섹션 헤더 */}
      <div style={{ paddingTop: "var(--space-sm)", paddingBottom: "var(--space-xs)" }}>
        <div style={{ ...skeletonStyle, height: 18, width: "35%", marginBottom: 8 }} />
        <div style={{ ...skeletonStyle, height: 13, width: "65%", borderRadius: 4 }} />
      </div>

      {/* 로그 카드 스켈레톤 2개 */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="card" style={{ padding: "var(--space-sm)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "var(--space-sm)" }}>
            {/* 날짜 (strong) */}
            <div style={{ ...skeletonStyle, height: 16, width: "55%", marginBottom: 2 }} />
            {/* 운동 요약 */}
            <div style={{ ...skeletonStyle, height: 13, width: "80%", borderRadius: 4 }} />
            {/* 배지 */}
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
              <div style={{ ...skeletonStyle, height: 18, width: 64, borderRadius: 6 }} />
              <div style={{ ...skeletonStyle, height: 18, width: 80, borderRadius: 6 }} />
            </div>
          </div>

          {/* 액션 버튼 */}
          <div style={{ display: "flex", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
            <div style={{ ...skeletonStyle, height: 28, width: 72, borderRadius: 6 }} />
            <div style={{ ...skeletonStyle, height: 28, width: 88, borderRadius: 6 }} />
          </div>

          {/* 3열 지표 */}
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
