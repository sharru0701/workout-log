// PERF: 캘린더 라우트 loading.tsx - 진입 시 스켈레톤 UI 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function CalendarLoading() {
  return (
    <div>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* ── Page Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "var(--space-sm)",
          marginBottom: "var(--space-lg)",
        }}
      >
        <div style={{ ...skeletonStyle, height: 24, width: "30%", borderRadius: 6 }} />
      </div>

      {/* ── Filter Bar ── */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "var(--space-lg)" }}>
        <div style={{ ...skeletonStyle, height: 32, width: 100, borderRadius: 12 }} />
      </div>

      {/* ── Calendar Grid ── */}
      <div>
        {/* 요일 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", marginBottom: "var(--space-sm)" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ ...skeletonStyle, height: 14, width: 20, borderRadius: 4 }} />
            </div>
          ))}
        </div>
        {/* 날짜 그리드 */}
        {Array.from({ length: 5 }).map((_, week) => (
          <div key={`week-${week}`} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center" }}>
            {Array.from({ length: 7 }).map((_, day) => (
              <div
                key={day}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "36px",
                  height: "36px",
                  margin: "4px auto",
                  borderRadius: "50%",
                  ...skeletonStyle,
                  background: "var(--color-surface-container-low)"
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── Recent Past Logs (최근 기록 모사) ── */}
      <div style={{ marginTop: "var(--space-xl)" }}>
        <div style={{ ...skeletonStyle, height: 20, width: "35%", marginBottom: "var(--space-md)" }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: "var(--space-md)", padding: "12px 16px", marginBottom: "var(--space-sm)", borderRadius: "14px", background: "var(--color-surface-container-low)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div style={{ ...skeletonStyle, height: 16, width: "70%" }} />
              <div style={{ ...skeletonStyle, height: 12, width: "50%", borderRadius: 4 }} />
            </div>
            <div style={{ ...skeletonStyle, height: 28, width: 60, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
