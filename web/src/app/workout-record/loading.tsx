// PERF: 운동 기록 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function WorkoutRecordLoading() {
  return (
    <div style={{ paddingBlock: "var(--space-md)", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 선택된 플랜 섹션 */}
      <div>
        <div style={{ ...skeletonStyle, height: 18, width: "40%", marginBottom: "var(--space-md)" }} />
        <div className="card" style={{ padding: "var(--space-md)" }}>
          {/* 플랜 선택 버튼 (좌: 라벨+이름, 우: 화살표 아이콘) */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...skeletonStyle, height: 12, width: "35%", marginBottom: 8, borderRadius: 4 }} />
              <div style={{ ...skeletonStyle, height: 20, width: "60%" }} />
            </div>
            <div style={{ ...skeletonStyle, height: 18, width: 18, borderRadius: 4 }} />
          </div>
        </div>
      </div>

      {/* 지난 세션 섹션 */}
      <div>
        <div style={{ ...skeletonStyle, height: 18, width: "30%", marginBottom: "var(--space-md)" }} />
        <div className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 14, width: "50%", marginBottom: "var(--space-md)", borderRadius: 4 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-md)" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div style={{ ...skeletonStyle, height: 12, width: "70%", marginBottom: 8, borderRadius: 4 }} />
                <div style={{ ...skeletonStyle, height: 20, width: "90%" }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 오늘 세션 섹션 */}
      <div>
        <div style={{ ...skeletonStyle, height: 18, width: "35%", marginBottom: "var(--space-md)" }} />
        <div className="card" style={{ padding: "var(--space-md)" }}>
          {/* 배지 + 날짜 */}
          <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            <div style={{ ...skeletonStyle, height: 22, width: 96, borderRadius: 6 }} />
            <div style={{ ...skeletonStyle, height: 22, width: 64, borderRadius: 6 }} />
          </div>

          {/* 운동 행 3개 */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ marginBottom: i < 2 ? "var(--space-lg)" : 0 }}>
              {/* 운동명 헤더 바 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-sm) var(--space-md)", marginBottom: "var(--space-sm)", background: "var(--color-surface-hover)", borderRadius: 8 }}>
                <div style={{ ...skeletonStyle, height: 16, width: "45%" }} />
                <div style={{ ...skeletonStyle, height: 24, width: 24, borderRadius: "50%" }} />
              </div>
              {/* 열 헤더 (Sets / TM% / Weight / Reps) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 2fr 1.5fr", gap: "var(--space-xs)", marginBottom: "var(--space-sm)", paddingInline: "var(--space-md)" }}>
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} style={{ ...skeletonStyle, height: 11, borderRadius: 4 }} />
                ))}
              </div>
              {/* 세트 행 3개 */}
              {Array.from({ length: 3 }).map((_, k) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 2fr 1.5fr", gap: "var(--space-xs)", marginBottom: "var(--space-sm)", paddingInline: "var(--space-md)" }}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} style={{ ...skeletonStyle, height: 36, borderRadius: 6 }} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 기록 저장 버튼 */}
      <div style={{ ...skeletonStyle, height: 52, width: "100%", borderRadius: 10 }} />
    </div>
  );
}
