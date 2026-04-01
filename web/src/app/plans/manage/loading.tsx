// PERF: 플랜 관리 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container-low) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container-low) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function PlansManageLoading() {
  return (
    <div>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <section>
        {/* ── Page header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "var(--space-lg)",
          }}
        >
          <div style={{ width: "100%" }}>
            <div style={{ ...skeletonStyle, height: 12, width: 80, marginBottom: "8px", borderRadius: 4 }} />
            <div style={{ ...skeletonStyle, height: 32, width: 140, borderRadius: 6 }} />
          </div>
        </div>

        {/* ── Search Input ── */}
        <div style={{ marginBottom: "var(--space-md)" }}>
          <div style={{ ...skeletonStyle, height: 48, borderRadius: 12 }} />
        </div>

        {/* ── Plan Cards ── */}
        <div style={{ marginTop: "var(--space-sm)" }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: "var(--color-surface-container-low)",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "var(--space-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "var(--space-sm)",
                  marginBottom: "12px",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ ...skeletonStyle, height: 20, width: "60%", marginBottom: "6px" }} />
                  <div style={{ ...skeletonStyle, height: 12, width: "30%", marginBottom: "4px", borderRadius: 4 }} />
                  <div style={{ ...skeletonStyle, height: 14, width: "45%", borderRadius: 4 }} />
                </div>
                <div style={{ ...skeletonStyle, height: 26, width: 64, borderRadius: 10, flexShrink: 0 }} />
              </div>

              {/* History button skeleton */}
              <div style={{ ...skeletonStyle, height: 36, width: "100%", borderRadius: 10 }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
