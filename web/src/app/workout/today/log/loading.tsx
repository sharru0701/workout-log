// PERF: 운동 기록 라우트 loading.tsx - 운동 기록 화면 진입 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function WorkoutLogLoading() {
  return (
    <div style={{ padding: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 모드 선택 카드 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 14, width: "30%", marginBottom: 12 }} />
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <div style={{ ...skeletonStyle, height: 36, flex: 1, borderRadius: 8 }} />
          <div style={{ ...skeletonStyle, height: 36, flex: 1, borderRadius: 8 }} />
        </div>
      </div>

      {/* 플랜 선택 + 빠른 시작 카드 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 38, width: "100%", marginBottom: 12, borderRadius: 8 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)", marginBottom: 12 }}>
          <div style={{ ...skeletonStyle, height: 40, borderRadius: 8 }} />
          <div style={{ ...skeletonStyle, height: 40, borderRadius: 8 }} />
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <div style={{ ...skeletonStyle, height: 40, flex: 2, borderRadius: 8 }} />
          <div style={{ ...skeletonStyle, height: 40, flex: 1, borderRadius: 8 }} />
        </div>
      </div>

      {/* 세트 테이블 스켈레톤 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 16, width: "35%", marginBottom: 16 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", paddingBlock: 8, borderBottom: i < 3 ? "1px solid var(--color-border)" : "none" }}>
            <div style={{ ...skeletonStyle, height: 32, flex: 2, borderRadius: 6 }} />
            <div style={{ ...skeletonStyle, height: 32, flex: 1, borderRadius: 6 }} />
            <div style={{ ...skeletonStyle, height: 32, flex: 1, borderRadius: 6 }} />
            <div style={{ ...skeletonStyle, height: 32, flex: 1, borderRadius: 6 }} />
            <div style={{ ...skeletonStyle, height: 32, width: 32, borderRadius: 6 }} />
          </div>
        ))}
      </div>

      {/* 저장 버튼 */}
      <div style={{ ...skeletonStyle, height: 48, width: "100%", borderRadius: 10 }} />
    </div>
  );
}
