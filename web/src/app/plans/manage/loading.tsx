// PERF: 플랜 관리 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function PlansManageLoading() {
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
        <div style={{ ...skeletonStyle, height: 22, width: "50%", marginBottom: 8 }} />
        <div style={{ ...skeletonStyle, height: 13, width: "80%", borderRadius: 4 }} />
      </div>

      {/* 플랜 카드 스켈레톤 2개 */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-sm)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...skeletonStyle, height: 16, width: "55%", marginBottom: 8 }} />
              <div style={{ ...skeletonStyle, height: 12, width: "70%", marginBottom: 6, borderRadius: 4 }} />
              <div style={{ ...skeletonStyle, height: 12, width: "50%", borderRadius: 4 }} />
            </div>
            <div style={{ ...skeletonStyle, height: 32, width: 64, borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
