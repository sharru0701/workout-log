// PERF: 운동 기록 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function WorkoutRecordLoading() {
  return (
    <div style={{ padding: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 선택된 플랜 카드 */}
      <div>
        <div style={{ ...skeletonStyle, height: 16, width: "40%", marginBottom: 12 }} />
        <div className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 11, width: "35%", marginBottom: 6, borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 20, width: "60%" }} />
        </div>
      </div>

      {/* 지난 세션 */}
      <div>
        <div style={{ ...skeletonStyle, height: 16, width: "30%", marginBottom: 12 }} />
        <div className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 13, width: "50%", marginBottom: 8, borderRadius: 4 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-sm)" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div style={{ ...skeletonStyle, height: 11, width: "70%", marginBottom: 4, borderRadius: 4 }} />
                <div style={{ ...skeletonStyle, height: 18, width: "90%" }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 오늘 세션 */}
      <div>
        <div style={{ ...skeletonStyle, height: 16, width: "35%", marginBottom: 12 }} />
        <div className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 13, width: "40%", marginBottom: 12, borderRadius: 4 }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ paddingBlock: 10, borderBottom: i < 2 ? "1px solid var(--color-border)" : "none" }}>
              <div style={{ ...skeletonStyle, height: 14, width: "55%", marginBottom: 6 }} />
              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                <div style={{ ...skeletonStyle, height: 32, flex: 2, borderRadius: 6 }} />
                <div style={{ ...skeletonStyle, height: 32, flex: 1, borderRadius: 6 }} />
                <div style={{ ...skeletonStyle, height: 32, flex: 1, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 기록 저장 버튼 */}
      <div style={{ ...skeletonStyle, height: 48, width: "100%", borderRadius: 10 }} />
    </div>
  );
}
