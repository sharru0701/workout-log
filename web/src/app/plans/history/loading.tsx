// PERF: 플랜 히스토리 라우트 loading.tsx — 새 hero + tab strip + log timeline 형태에 맞춘 스켈레톤
const skeletonStyle: React.CSSProperties = {
  background:
    "linear-gradient(90deg, var(--v2-paper-2) 0%, var(--v2-paper-3) 50%, var(--v2-paper-2) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: "var(--v2-r-1)",
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

      {/* ── Hero header ── */}
      <section>
        <div
          style={{
            padding: "var(--v2-s-5) var(--v2-s-5) var(--v2-s-6)",
            borderRadius: "var(--v2-r-4)",
            background: "var(--v2-paper)",
            marginBottom: "var(--v2-s-4)",
          }}
        >
          <div style={{ ...skeletonStyle, height: 12, width: 100, marginBottom: 8, borderRadius: "var(--v2-r-0)" }} />
          <div style={{ ...skeletonStyle, height: 28, width: 180, marginBottom: 6, borderRadius: "var(--v2-r-0)" }} />
          <div style={{ ...skeletonStyle, height: 13, width: "75%", borderRadius: "var(--v2-r-0)" }} />
        </div>

        {/* ── Plan tab strip ── */}
        <div style={{ display: "flex", gap: "var(--v2-s-2)", padding: "var(--v2-s-1) var(--v2-s-1) var(--v2-s-3)", overflow: "hidden" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: "0 0 auto",
                padding: "var(--v2-s-3) var(--v2-s-4)",
                borderRadius: "var(--v2-r-2)",
                background: "var(--v2-paper)",
                minHeight: "var(--v2-s-8)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--v2-s-1)",
              }}
            >
              <div style={{ ...skeletonStyle, height: 13, width: 80, borderRadius: "var(--v2-r-0)" }} />
              <div style={{ ...skeletonStyle, height: 10, width: 50, borderRadius: "var(--v2-r-0)" }} />
            </div>
          ))}
        </div>

        {/* ── Summary card ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
            padding: "var(--v2-s-4) var(--v2-s-5)",
            borderRadius: "var(--v2-r-4)",
            background: "var(--v2-paper)",
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ padding: "0px var(--v2-s-3)" }}>
              <div style={{ ...skeletonStyle, height: 10, width: "60%", marginBottom: 6, borderRadius: "var(--v2-r-0)" }} />
              <div style={{ ...skeletonStyle, height: 17, width: "70%", borderRadius: "var(--v2-r-0)" }} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Logs Section ── */}
      <section style={{ marginTop: "var(--v2-s-5)" }}>
        <div style={{ ...skeletonStyle, height: 24, width: 110, marginBottom: 14, borderRadius: "var(--v2-r-pill)" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-3)" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <article
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr",
                gap: "var(--v2-s-4)",
                padding: "var(--v2-s-4)",
                borderRadius: "var(--v2-r-3)",
                background: "var(--v2-paper)",
              }}
            >
              {/* date box */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "var(--v2-r-2)",
                  background: "var(--v2-paper-2)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <div style={{ ...skeletonStyle, height: 9, width: 24, borderRadius: "var(--v2-r-0)" }} />
                <div style={{ ...skeletonStyle, height: 18, width: 24, borderRadius: "var(--v2-r-0)" }} />
                <div style={{ ...skeletonStyle, height: 10, width: 18, borderRadius: "var(--v2-r-0)" }} />
              </div>

              {/* body */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-2)", minWidth: 0 }}>
                <div style={{ ...skeletonStyle, height: 15, width: "70%", borderRadius: "var(--v2-r-0)" }} />
                <div style={{ display: "flex", gap: "var(--v2-s-1)" }}>
                  <div style={{ ...skeletonStyle, height: 18, width: 60, borderRadius: "var(--v2-r-pill)" }} />
                  <div style={{ ...skeletonStyle, height: 18, width: 80, borderRadius: "var(--v2-r-pill)" }} />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "var(--v2-s-2)",
                    padding: "var(--v2-s-2) var(--v2-s-3)",
                    borderRadius: "var(--v2-r-2)",
                    background: "var(--v2-paper-2)",
                  }}
                >
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}>
                      <div style={{ ...skeletonStyle, height: 9, width: "60%", borderRadius: "var(--v2-r-0)" }} />
                      <div style={{ ...skeletonStyle, height: 15, width: "55%", borderRadius: "var(--v2-r-0)" }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "var(--v2-s-1)" }}>
                  <div style={{ ...skeletonStyle, height: 36, width: 100, borderRadius: "var(--v2-r-pill)" }} />
                  <div style={{ ...skeletonStyle, height: 36, width: 90, borderRadius: "var(--v2-r-pill)" }} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
