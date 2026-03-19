// PERF: 플랜 관리 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function PlansManageLoading() {
  return (
    <div className="dashboard-screen">
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* DashboardSection: 플랜 목록 */}
      <section className="dashboard-section">
        {/* 섹션 헤더 */}
        <div className="dashboard-section__header">
          <div style={{ ...skeletonStyle, height: 22, width: "50%", marginBottom: "var(--space-sm)" }} />
          <div style={{ ...skeletonStyle, height: 14, width: "80%", borderRadius: 4 }} />
        </div>

        <div className="dashboard-section__content">
          {/* 검색 인풋 스켈레톤 (DashboardSurface 모사: Card padding none) */}
          <div className="card" style={{ padding: 0, marginBottom: "var(--space-md)" }}>
            <div style={{ ...skeletonStyle, height: 48, borderRadius: 10 }} />
          </div>

          {/* 플랜 카드 스켈레톤 2개 (PlanListCard 모사: Card padding md, tone inset) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="card" data-card-tone="inset" data-card-elevated="false" style={{ padding: "var(--space-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...skeletonStyle, height: 18, width: "55%", marginBottom: "var(--space-sm)" }} />
                    <div style={{ ...skeletonStyle, height: 13, width: "70%", marginBottom: "var(--space-xs)", borderRadius: 4 }} />
                    <div style={{ ...skeletonStyle, height: 13, width: "50%", borderRadius: 4 }} />
                  </div>
                  <div style={{ ...skeletonStyle, height: 32, width: 64, borderRadius: 8 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
