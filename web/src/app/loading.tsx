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
    <div style={{ paddingBlock: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 현재 프로그램 섹션 */}
      <div>
        <div style={{ ...skeletonStyle, height: 20, width: "45%", marginBottom: "var(--space-md)", borderRadius: 6 }} />
        <div className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 16, width: "55%", marginBottom: 10 }} />
          <div style={{ ...skeletonStyle, height: 13, width: "40%", marginBottom: 8, borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 12, width: "65%", marginBottom: 20, borderRadius: 4 }} />
          {/* 7일 운동 그리드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "var(--space-xs)", textAlign: "center" }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ ...skeletonStyle, height: 11, width: "100%", borderRadius: 4 }} />
                <div style={{ ...skeletonStyle, height: 12, width: 12, borderRadius: "50%" }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 오늘의 운동 섹션 */}
      <div>
        <div style={{ ...skeletonStyle, height: 20, width: "35%", marginBottom: "var(--space-md)", borderRadius: 6 }} />
        <div className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 16, width: "70%", marginBottom: "var(--space-md)" }} />
          {/* 운동 목록 5개 */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: 10, borderBottom: i < 4 ? "1px solid var(--color-border)" : "none" }}>
              <div style={{ ...skeletonStyle, height: 14, width: "45%", borderRadius: 4 }} />
              <div style={{ ...skeletonStyle, height: 12, width: 80, borderRadius: 4 }} />
            </div>
          ))}
          {/* CTA 버튼 */}
          <div style={{ ...skeletonStyle, height: 48, width: "100%", borderRadius: 10, marginTop: "var(--space-md)" }} />
        </div>
      </div>

      {/* 지난 세션 섹션 */}
      <div>
        <div style={{ ...skeletonStyle, height: 20, width: "30%", marginBottom: "var(--space-md)", borderRadius: 6 }} />
        <div className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 15, width: "55%", marginBottom: 6 }} />
          <div style={{ ...skeletonStyle, height: 12, width: "35%", marginBottom: "var(--space-md)", borderRadius: 4 }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: 10, borderBottom: i < 2 ? "1px solid var(--color-border)" : "none" }}>
              <div style={{ ...skeletonStyle, height: 13, width: "50%", borderRadius: 4 }} />
              <div style={{ ...skeletonStyle, height: 12, width: 60, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
