// Loading skeleton for the redesigned /plans dashboard.
const skeletonStyle: React.CSSProperties = {
  background:
    "linear-gradient(90deg, var(--color-surface-container-low) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container-low) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function PlansLoading() {
  return (
    <div>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div className="plans-overview__header">
        <div style={{ ...skeletonStyle, height: 28, width: 160, borderRadius: 6 }} />
        <div style={{ ...skeletonStyle, height: 36, width: 124, borderRadius: 999 }} />
      </div>

      <div className="plans-overview__summary">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="plans-overview__summary-cell">
            <div style={{ ...skeletonStyle, height: 10, width: "60%", marginBottom: 6, borderRadius: 4 }} />
            <div style={{ ...skeletonStyle, height: 22, width: "45%", borderRadius: 4 }} />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="plan-card">
            <div className="plan-card__head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...skeletonStyle, height: 12, width: 100, borderRadius: 4, marginBottom: 8 }} />
                <div style={{ ...skeletonStyle, height: 22, width: "65%", borderRadius: 6 }} />
              </div>
              <div style={{ ...skeletonStyle, height: 22, width: 64, borderRadius: 999 }} />
            </div>
            <div className="plan-card__lifts">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="plan-card__lift">
                  <div style={{ ...skeletonStyle, height: 9, width: 30, borderRadius: 3, marginBottom: 6 }} />
                  <div style={{ ...skeletonStyle, height: 18, width: 56, borderRadius: 4 }} />
                </div>
              ))}
            </div>
            <div className="plan-card__actions">
              <div style={{ ...skeletonStyle, height: 40, borderRadius: 12 }} />
              <div style={{ ...skeletonStyle, height: 40, borderRadius: 12 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
