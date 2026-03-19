// PERF: 운동 기록 라우트 loading.tsx - 운동 기록 화면 진입 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function WorkoutLogLoading() {
  return (
    <div style={{ paddingBlock: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 기록 모드 카드 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 14, width: "30%", marginBottom: "var(--space-md)" }} />
        <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 40, flex: 1, borderRadius: 10 }} />
          <div style={{ ...skeletonStyle, height: 40, flex: 1, borderRadius: 10 }} />
        </div>
        <div style={{ ...skeletonStyle, height: 32, width: "100%", borderRadius: 6 }} />
      </div>

      {/* 플랜 선택 및 세션 설정 카드 */}
      <div className="card" style={{ padding: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        {/* 행동 로그 동기화 영역 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ ...skeletonStyle, height: 14, width: "40%" }} />
          <div style={{ ...skeletonStyle, height: 32, width: 100, borderRadius: 8 }} />
        </div>

        {/* 플랜 및 날짜 선택 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
          <div style={{ ...skeletonStyle, height: 60, borderRadius: 10 }} />
          <div style={{ ...skeletonStyle, height: 60, borderRadius: 10 }} />
        </div>

        {/* 세션 컨텍스트 (AccordionSection 모사) */}
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: "var(--space-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ ...skeletonStyle, height: 16, width: "30%" }} />
            <div style={{ ...skeletonStyle, height: 14, width: "20%" }} />
          </div>
        </div>

        {/* 빠른 시작 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <div style={{ ...skeletonStyle, height: 14, width: "20%" }} />
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <div style={{ ...skeletonStyle, height: 40, width: "45%", borderRadius: 10 }} />
            <div style={{ ...skeletonStyle, height: 40, width: "45%", borderRadius: 10 }} />
            <div style={{ ...skeletonStyle, height: 40, width: "45%", borderRadius: 10 }} />
            <div style={{ ...skeletonStyle, height: 40, width: "45%", borderRadius: 10 }} />
            <div style={{ ...skeletonStyle, height: 40, width: "100%", borderRadius: 10 }} />
          </div>
        </div>

        {/* 고급 제어 버튼 */}
        <div style={{ ...skeletonStyle, height: 36, width: "100%", borderRadius: 10 }} />
      </div>

      {/* 저장할 세트 카드 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 16, width: "35%", marginBottom: "var(--space-md)" }} />
        <div style={{ ...skeletonStyle, height: 13, width: "60%", marginBottom: "var(--space-md)" }} />
        <div style={{ ...skeletonStyle, height: 13, width: "70%", marginBottom: "var(--space-lg)" }} />

        {/* 열 헤더 */}
        <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-sm)", paddingInline: "var(--space-xs)" }}>
          <div style={{ ...skeletonStyle, height: 11, flex: 2, borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 11, flex: 1, borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 11, flex: 1, borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 11, flex: 1, borderRadius: 4 }} />
          <div style={{ width: 32 }} />
        </div>

        {/* 세트 행 3개 */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", paddingBlock: 12, borderTop: "1px solid var(--color-border)" }}>
            <div style={{ ...skeletonStyle, height: 36, flex: 2, borderRadius: 6 }} />
            <div style={{ ...skeletonStyle, height: 36, flex: 1, borderRadius: 6 }} />
            <div style={{ ...skeletonStyle, height: 36, flex: 1, borderRadius: 6 }} />
            <div style={{ ...skeletonStyle, height: 36, flex: 1, borderRadius: 6 }} />
            <div style={{ ...skeletonStyle, height: 36, width: 36, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
