// PERF: 플랜 관리 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function PlansManageLoading() {
  return (
    <div>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 섹션 헤더 */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ ...skeletonStyle, height: 22, width: "50%", marginBottom: "var(--space-sm)" }} />
        <div style={{ ...skeletonStyle, height: 14, width: "80%", borderRadius: 4, marginBottom: "var(--space-md)" }} />

        {/* 검색 인풋 */}
        <div style={{ ...skeletonStyle, height: 48, borderRadius: 12, marginBottom: "var(--space-md)" }} />

        {/* 플랜 카드 스켈레톤 2개 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ padding: "var(--space-md)", borderRadius: "14px", background: "var(--color-surface-container-low)", border: "1px solid color-mix(in srgb, var(--color-outline-variant) 20%, transparent)" }}>
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
    </div>
  );
}
