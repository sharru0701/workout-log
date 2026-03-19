// PERF: 통계 라우트 loading.tsx - 통계 화면 진입 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function StatsLoading() {
  return (
    <div className="dashboard-screen">
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* DashboardHero (quiet) */}
      <header className="dashboard-hero dashboard-hero--quiet">
        <div className="dashboard-hero__content">
          <div style={{ ...skeletonStyle, height: 28, width: "60%", marginBottom: "var(--space-sm)" }} />
          <div style={{ ...skeletonStyle, height: 15, width: "80%", borderRadius: 4 }} />
        </div>
      </header>

      {/* 지표 카드 2개 (grid) */}
      <div style={{ padding: "0 0 var(--space-md)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)", marginTop: "-4px" }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
            <div style={{ ...skeletonStyle, height: 34, width: "60%", marginBottom: "var(--space-sm)" }} />
            <div style={{ ...skeletonStyle, height: 13, width: "70%", borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* 상세 추이 분석 섹션 */}
      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div style={{ ...skeletonStyle, height: 18, width: "45%", marginBottom: "var(--space-sm)" }} />
          <div style={{ ...skeletonStyle, height: 13, width: "65%", borderRadius: 4 }} />
        </div>
        <div className="dashboard-section__content">
          <div style={{ padding: "0 0 var(--space-md)" }}>
            <div style={{ ...skeletonStyle, height: 200, width: "100%", borderRadius: 10 }} />
          </div>
        </div>
      </section>

      {/* 플랜별 준수율 섹션 */}
      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div style={{ ...skeletonStyle, height: 18, width: "40%", marginBottom: "var(--space-sm)" }} />
          <div style={{ ...skeletonStyle, height: 13, width: "55%", borderRadius: 4 }} />
        </div>
        <div className="dashboard-section__content">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ ...skeletonStyle, height: 15, width: 120, marginBottom: "var(--space-sm)" }} />
                    <div style={{ ...skeletonStyle, height: 12, width: 80, borderRadius: 4 }} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...skeletonStyle, height: 24, width: 48, marginBottom: "var(--space-xs)" }} />
                    <div style={{ ...skeletonStyle, height: 11, width: 64, borderRadius: 4 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PR 기록 추적 섹션 */}
      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div style={{ ...skeletonStyle, height: 18, width: "35%", marginBottom: "var(--space-sm)" }} />
          <div style={{ ...skeletonStyle, height: 13, width: "50%", borderRadius: 4 }} />
        </div>
        <div className="dashboard-section__content">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...skeletonStyle, height: 15, width: "45%", marginBottom: "var(--space-sm)" }} />
                    <div style={{ display: "flex", gap: "var(--space-md)" }}>
                      <div style={{ ...skeletonStyle, height: 12, width: 60, borderRadius: 4 }} />
                      <div style={{ ...skeletonStyle, height: 12, width: 60, borderRadius: 4 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...skeletonStyle, height: 24, width: 48, marginBottom: "var(--space-xs)" }} />
                    <div style={{ ...skeletonStyle, height: 11, width: 60, borderRadius: 4 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
