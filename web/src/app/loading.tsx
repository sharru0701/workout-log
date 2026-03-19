// PERF: 홈 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
// 이 파일이 없으면 JS 번들 로드 + 데이터 fetch 완료까지 빈 화면이 표시됨
// 이 파일이 있으면 라우트 진입 즉시 스켈레톤 UI가 표시됨 (TTFB → FCP 단축)

const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function HomeLoading() {
  return (
    <div style={{ padding: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 오늘 운동 카드 스켈레톤 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 14, width: "40%", marginBottom: 12 }} />
        <div style={{ ...skeletonStyle, height: 22, width: "70%", marginBottom: 8 }} />
        <div style={{ ...skeletonStyle, height: 14, width: "55%", marginBottom: 16 }} />
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <div style={{ ...skeletonStyle, height: 36, flex: 1, borderRadius: 8 }} />
          <div style={{ ...skeletonStyle, height: 36, flex: 1, borderRadius: 8 }} />
        </div>
      </div>

      {/* 주간 요약 스켈레톤 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 14, width: "30%", marginBottom: 12 }} />
        <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "space-between" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
              <div style={{ ...skeletonStyle, height: 10, width: "100%", borderRadius: 4 }} />
              <div style={{ ...skeletonStyle, height: 28, width: "100%", borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>

      {/* 최근 운동 스켈레톤 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 14, width: "35%", marginBottom: 12 }} />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: 10, borderBottom: i === 0 ? "1px solid var(--color-border)" : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...skeletonStyle, height: 13, width: "50%", marginBottom: 6 }} />
              <div style={{ ...skeletonStyle, height: 11, width: "35%", borderRadius: 4 }} />
            </div>
            <div style={{ ...skeletonStyle, height: 24, width: 24, borderRadius: "50%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
