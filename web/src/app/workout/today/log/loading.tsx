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

      {/* 모드 선택 카드 (기록 모드 + 기본/고급 버튼) */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 14, width: "30%", marginBottom: 12 }} />
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <div style={{ ...skeletonStyle, height: 36, flex: 1, borderRadius: 8 }} />
          <div style={{ ...skeletonStyle, height: 36, flex: 1, borderRadius: 8 }} />
        </div>
      </div>

      {/* 플랜 선택 + 빠른 시작 카드 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        {/* 플랜 드롭다운 */}
        <div style={{ ...skeletonStyle, height: 44, width: "100%", marginBottom: 8, borderRadius: 8 }} />
        {/* 날짜 입력 */}
        <div style={{ ...skeletonStyle, height: 36, width: "60%", marginBottom: 12, borderRadius: 8 }} />
        {/* AccordionSection (접힌 상태) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "var(--space-xs) 0" }}>
          <div>
            <div style={{ ...skeletonStyle, height: 14, width: 100, marginBottom: 4 }} />
            <div style={{ ...skeletonStyle, height: 11, width: 140, borderRadius: 4 }} />
          </div>
          <div style={{ ...skeletonStyle, height: 20, width: 20, borderRadius: 4 }} />
        </div>
        {/* 빠른 시작 버튼 4개 */}
        <div style={{ ...skeletonStyle, height: 13, width: "25%", marginBottom: 8, borderRadius: 4 }} />
        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
          <div style={{ ...skeletonStyle, height: 40, flex: "1 1 45%", borderRadius: 8 }} />
          <div style={{ ...skeletonStyle, height: 40, flex: "1 1 45%", borderRadius: 8 }} />
          <div style={{ ...skeletonStyle, height: 40, flex: "1 1 45%", borderRadius: 8 }} />
          <div style={{ ...skeletonStyle, height: 40, flex: "1 1 45%", borderRadius: 8 }} />
        </div>
      </div>

      {/* 세트 테이블 스켈레톤 */}
      <div className="card" style={{ padding: "var(--space-md)" }}>
        <div style={{ ...skeletonStyle, height: 16, width: "35%", marginBottom: 16 }} />
        {/* 열 헤더 */}
        <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: 8 }}>
          <div style={{ ...skeletonStyle, height: 10, flex: 2, borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 10, flex: 1, borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 10, flex: 1, borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 10, flex: 1, borderRadius: 4 }} />
          <div style={{ width: 32 }} />
        </div>
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
