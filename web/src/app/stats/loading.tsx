// PERF: 통계 라우트 loading.tsx - 통계 화면 진입 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function StatsLoading() {
  return (
    <div>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 히어로 (quiet) - padding: var(--space-md) 전체 */}
      <div style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 26, width: "60%", marginBottom: 8 }} />
        <div style={{ ...skeletonStyle, height: 14, width: "80%", borderRadius: 4 }} />
      </div>

      {/* 지표 카드 2개 - 히어로 바로 아래, 음수 마진으로 붙임 */}
      <div style={{ padding: "0 var(--space-md) var(--space-md)", marginTop: "-4px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
            <div style={{ ...skeletonStyle, height: 32, width: "60%", marginBottom: 8 }} />
            <div style={{ ...skeletonStyle, height: 12, width: "70%", borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* 상세 추이 분석 섹션 */}
      <div style={{ paddingTop: "var(--space-xl)" }}>
        <div style={{ padding: "0 var(--space-md) var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 16, width: "45%", marginBottom: 6 }} />
          <div style={{ ...skeletonStyle, height: 12, width: "65%", borderRadius: 4 }} />
        </div>
        <div style={{ padding: "0 var(--space-md) var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 140, width: "100%", borderRadius: 10 }} />
        </div>
      </div>

      {/* 플랜별 준수율 섹션 */}
      <div style={{ paddingTop: "var(--space-xl)" }}>
        <div style={{ padding: "0 var(--space-md) var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 16, width: "40%", marginBottom: 6 }} />
          <div style={{ ...skeletonStyle, height: 12, width: "55%", borderRadius: 4 }} />
        </div>
        <div style={{ padding: "0 var(--space-md) var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ ...skeletonStyle, height: 14, width: 120, marginBottom: 6 }} />
                  <div style={{ ...skeletonStyle, height: 11, width: 80, borderRadius: 4 }} />
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...skeletonStyle, height: 22, width: 48, marginBottom: 4 }} />
                  <div style={{ ...skeletonStyle, height: 10, width: 64, borderRadius: 4 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PR 기록 추적 섹션 */}
      <div style={{ paddingTop: "var(--space-xl)" }}>
        <div style={{ padding: "0 var(--space-md) var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 16, width: "35%", marginBottom: 6 }} />
          <div style={{ ...skeletonStyle, height: 12, width: "50%", borderRadius: 4 }} />
        </div>
        <div style={{ padding: "0 var(--space-md) var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...skeletonStyle, height: 14, width: "45%", marginBottom: 6 }} />
                  <div style={{ display: "flex", gap: "var(--space-md)" }}>
                    <div style={{ ...skeletonStyle, height: 11, width: 60, borderRadius: 4 }} />
                    <div style={{ ...skeletonStyle, height: 11, width: 60, borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...skeletonStyle, height: 22, width: 48, marginBottom: 4 }} />
                  <div style={{ ...skeletonStyle, height: 10, width: 60, borderRadius: 4 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
