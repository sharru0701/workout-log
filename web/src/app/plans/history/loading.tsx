// PERF: 플랜 히스토리 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function PlanHistoryLoading() {
  return (
    <div>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* ── Page Header ── */}
      <section>
        <div style={{ marginBottom: "var(--space-xl)", paddingBottom: "var(--space-md)", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ ...skeletonStyle, height: 12, width: 60, marginBottom: "8px", borderRadius: 4 }} />
          <div style={{ ...skeletonStyle, height: 34, width: 100, marginBottom: "8px", borderRadius: 6 }} />
          <div style={{ ...skeletonStyle, height: 16, width: "80%", borderRadius: 4 }} />
        </div>

        {/* ── Plan Selector & Summary ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {/* Dropdown Mock */}
          <div style={{ ...skeletonStyle, height: 48, width: "100%", borderRadius: 12 }} />

          {/* Selected Plan Summary Card */}
          <div style={{ background: "var(--color-surface-container)", borderRadius: 14, padding: "var(--space-md)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ ...skeletonStyle, height: 12, width: "30%", borderRadius: 4 }} />
              <div style={{ ...skeletonStyle, height: 18, width: "55%", borderRadius: 4 }} />
              <div style={{ ...skeletonStyle, height: 12, width: "40%", borderRadius: 4 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ ...skeletonStyle, height: 12, width: "40%", borderRadius: 4 }} />
              <div style={{ ...skeletonStyle, height: 14, width: "80%", borderRadius: 4 }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Logs Section ── */}
      <section style={{ marginTop: "var(--space-lg)" }}>
        <div style={{ marginBottom: "var(--space-sm)" }}>
          <div style={{ ...skeletonStyle, height: 14, width: 60, borderRadius: 4 }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {/* Notice Outline State */}
          <div style={{ ...skeletonStyle, height: 52, width: "100%", borderRadius: 10 }} />

          {/* Log Cards */}
          {Array.from({ length: 2 }).map((_, i) => (
            <article key={i} className="card card-inset card-padding-sm card-elevated-false">
              {/* Top Row: Date & Exercises */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-sm)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...skeletonStyle, height: 16, width: "45%", marginBottom: 6, borderRadius: 4 }} />
                  <div style={{ ...skeletonStyle, height: 14, width: "70%", borderRadius: 4 }} />
                </div>
                <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                  <div style={{ ...skeletonStyle, height: 20, width: 44, borderRadius: 6 }} />
                  <div style={{ ...skeletonStyle, height: 20, width: 60, borderRadius: 6 }} />
                </div>
              </div>

              {/* Grid 3 cols */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-xs)", margin: "var(--space-sm) 0", background: "var(--color-surface-container)", borderRadius: 10, padding: "var(--space-sm)" }}>
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ ...skeletonStyle, height: 11, width: "60%", borderRadius: 4 }} />
                    <div style={{ ...skeletonStyle, height: 18, width: "80%", borderRadius: 4 }} />
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                <div style={{ ...skeletonStyle, height: 36, width: 90, borderRadius: 8 }} />
                <div style={{ ...skeletonStyle, height: 36, width: 70, borderRadius: 8 }} />
              </div>
            </article>
          ))}
        </div>
      </section>

    </div>
  );
}
