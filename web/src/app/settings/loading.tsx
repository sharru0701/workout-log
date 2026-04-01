// PERF: 설정 홈 라우트 loading.tsx - 진입 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function SettingsLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 32 }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* ── Profile Card Skeleton ── */}
      <section
        style={{
          background: "var(--color-surface-container-low)",
          borderRadius: 24,
          padding: "20px 20px 18px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ ...skeletonStyle, width: 60, height: 60, borderRadius: "50%", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ ...skeletonStyle, height: 20, width: "50%" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ ...skeletonStyle, height: 14, width: 44, borderRadius: 12 }} />
            <div style={{ ...skeletonStyle, height: 14, width: "60%" }} />
          </div>
        </div>
      </section>

      {/* ── Settings Sections Skeleton ── */}
      {Array.from({ length: 3 }).map((_, sectionIdx) => (
        <section key={sectionIdx} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Section Title */}
          <div style={{ ...skeletonStyle, height: 12, width: "25%", margin: "0 4px", borderRadius: 4 }} />
          {/* Grouped List */}
          <div
            style={{
              background: "var(--color-surface-container-low)",
              borderRadius: 16,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {Array.from({ length: sectionIdx === 0 ? 3 : sectionIdx === 1 ? 7 : 3 }).map((_, rowIdx) => (
              <div
                key={rowIdx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 16px",
                  gap: 16,
                  borderBottom: rowIdx !== (sectionIdx === 0 ? 2 : sectionIdx === 1 ? 6 : 2) ? "1px solid var(--color-surface-container-high)" : "none",
                }}
              >
                {/* Icon block */}
                <div style={{ ...skeletonStyle, width: 40, height: 40, borderRadius: 12, flexShrink: 0 }} />
                {/* Text lines */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ ...skeletonStyle, height: 16, width: "40%" }} />
                  <div style={{ ...skeletonStyle, height: 12, width: "70%", borderRadius: 4 }} />
                </div>
                {/* Chevron */}
                <div style={{ ...skeletonStyle, width: 24, height: 24, borderRadius: "50%" }} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
