import type { CSSProperties } from "react";

// PERF: 스토어 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function ProgramStoreLoading() {
  return (
    <div className="dashboard-screen">
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      
      {/* Search Input Skeleton (DashboardSurface 내부 Input 모사) */}
      <div className="card" style={{ padding: 0, marginBottom: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 48, borderRadius: 10 }} />
      </div>

      {/* 공식 프로그램 섹션 스켈레톤 (DashboardSection 모사) */}
      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div style={{ ...skeletonStyle, height: 22, width: "35%", marginBottom: "var(--space-sm)" }} />
          <div style={{ ...skeletonStyle, height: 14, width: "65%", borderRadius: 4 }} />
        </div>
        
        <div className="dashboard-section__content">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card" data-card-tone="inset" data-card-elevated="false" style={{ padding: "var(--space-md)" }}>
                {/* ProgramListCard Header 모사 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-xs)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
                      <div style={{ ...skeletonStyle, height: 18, width: "60%" }} />
                      <div style={{ ...skeletonStyle, height: 14, width: "20%", borderRadius: 4 }} />
                    </div>
                  </div>
                  {/* Badge */}
                  <div style={{ ...skeletonStyle, height: 22, width: 44, borderRadius: 12 }} />
                </div>
                {/* Description */}
                <div style={{ ...skeletonStyle, height: 14, width: "85%", marginBottom: "var(--space-sm)", borderRadius: 4 }} />
                {/* Tags */}
                <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} style={{ ...skeletonStyle, height: 22, width: 56, borderRadius: 12 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
