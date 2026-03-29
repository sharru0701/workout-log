// PERF: 운동 기록 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function WorkoutRecordLoading() {
  return (
    <div style={{ paddingBlock: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 선택된 플랜 섹션 */}
      <section style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ ...skeletonStyle, height: 22, width: "35%", marginBottom: "var(--space-sm)" }} />
        <div className="card" style={{ padding: "var(--space-md)" }}>
          {/* 플랜 선택 버튼 모사 */}
          <div style={{ ...skeletonStyle, height: 52, width: "100%", borderRadius: 12 }} />
        </div>
      </section>

      {/* 지난 세션 섹션 */}
      <section style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ ...skeletonStyle, height: 22, width: "30%", marginBottom: "var(--space-sm)" }} />
        {/* SessionCard 모사 (variant last) */}
        <div className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 18, width: "40%", marginBottom: 12 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div style={{ ...skeletonStyle, height: 12, width: "70%", marginBottom: 4, borderRadius: 4 }} />
                <div style={{ ...skeletonStyle, height: 18, width: "90%" }} />
              </div>
            ))}
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ paddingBlock: 8, borderTop: "1px solid var(--color-border)" }}>
              <div style={{ ...skeletonStyle, height: 14, width: "50%" }} />
            </div>
          ))}
        </div>
      </section>

      {/* 오늘 세션 섹션 */}
      <section style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ ...skeletonStyle, height: 22, width: "35%", marginBottom: "var(--space-sm)" }} />
        {/* SessionSummaryCard 모사 */}
        <div className="card" style={{ padding: "var(--space-md)" }}>
          {/* 배지 + 날짜 */}
          <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            <div style={{ ...skeletonStyle, height: 22, width: 96, borderRadius: 6 }} />
            <div style={{ ...skeletonStyle, height: 22, width: 64, borderRadius: 6 }} />
          </div>

          {/* 운동 행(ExerciseRow) 2개 모사 */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card" data-card-tone="inset" data-card-elevated="false" style={{ padding: "0", marginBottom: "var(--space-md)" }}>
              {/* ExerciseRow Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-hover)" }}>
                <div style={{ ...skeletonStyle, height: 16, width: "40%" }} />
                <div style={{ ...skeletonStyle, height: 24, width: 24, borderRadius: 6 }} />
              </div>
              {/* ExerciseRow Content */}
              <div style={{ padding: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 2fr 1.5fr", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} style={{ ...skeletonStyle, height: 11, borderRadius: 4 }} />
                  ))}
                </div>
                {Array.from({ length: 3 }).map((_, k) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 2fr 1.5fr", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
                    <div style={{ ...skeletonStyle, height: 14, width: "50%", margin: "0 auto" }} />
                    <div style={{ ...skeletonStyle, height: 12, width: "40%", margin: "0 auto" }} />
                    <div style={{ ...skeletonStyle, height: 32, borderRadius: 6 }} />
                    <div style={{ ...skeletonStyle, height: 32, borderRadius: 6 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add Exercise 버튼 모사 */}
          <div style={{ ...skeletonStyle, height: 64, width: "100%", borderRadius: 12, marginBottom: "var(--space-md)" }} />

          {/* 세션 메모 모사 */}
          <div style={{ ...skeletonStyle, height: 80, width: "100%", borderRadius: 10 }} />
        </div>
      </section>

      {/* 기록 완료 버튼 */}
      <div style={{ ...skeletonStyle, height: 52, width: "100%", borderRadius: 10 }} />
    </div>
  );
}
