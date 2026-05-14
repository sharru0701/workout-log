// PERF: 플랜 관리 라우트 loading.tsx — 새 hero + plan-card-v2 형태에 맞춘 스켈레톤
const skeletonStyle: React.CSSProperties = {
  background:
    "linear-gradient(90deg, var(--v2-paper) 0%, var(--v2-paper-3) 50%, var(--v2-paper) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: "var(--v2-r-1)",
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

      {/* ── Hero ── */}
      <section>
        <div
          style={{
            padding: "var(--v2-s-5) var(--v2-s-5) var(--v2-s-6)",
            borderRadius: "var(--v2-r-4)",
            background: "var(--v2-paper)",
            marginBottom: "var(--v2-s-4)",
          }}
        >
          <div style={{ ...skeletonStyle, height: 12, width: 120, marginBottom: 8, borderRadius: "var(--v2-r-0)" }} />
          <div style={{ ...skeletonStyle, height: 28, width: 160, marginBottom: 6, borderRadius: "var(--v2-r-0)" }} />
          <div style={{ ...skeletonStyle, height: 13, width: "70%", marginBottom: 18, borderRadius: "var(--v2-r-0)" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--v2-s-2)" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: "var(--v2-paper-2)", borderRadius: "var(--v2-r-2)", padding: "var(--v2-s-3) var(--v2-s-3) var(--v2-s-4)" }}>
                <div style={{ ...skeletonStyle, height: 10, width: "70%", marginBottom: 6, borderRadius: "var(--v2-r-0)" }} />
                <div style={{ ...skeletonStyle, height: 22, width: "50%", borderRadius: "var(--v2-r-0)" }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        {/* ── Search ── */}
        <div style={{ marginBottom: "var(--v2-s-4)" }}>
          <div style={{ ...skeletonStyle, height: 48, borderRadius: "var(--v2-r-2)" }} />
        </div>

        {/* ── Plan Cards ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-2)" }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: "var(--v2-paper)",
                borderRadius: "var(--v2-r-3)",
                padding: "var(--v2-s-5) var(--v2-s-5) var(--v2-s-4)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--v2-s-4)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-s-1)" }}>
                <div style={{ display: "flex", gap: "var(--v2-s-1)" }}>
                  <div style={{ ...skeletonStyle, height: 18, width: 70, borderRadius: "var(--v2-r-pill)" }} />
                  <div style={{ ...skeletonStyle, height: 18, width: 70, borderRadius: "var(--v2-r-pill)" }} />
                </div>
                <div style={{ ...skeletonStyle, height: 22, width: "55%", borderRadius: "var(--v2-r-0)" }} />
                <div style={{ ...skeletonStyle, height: 13, width: "40%", borderRadius: "var(--v2-r-0)" }} />
                <div style={{ ...skeletonStyle, height: 12, width: "30%", marginTop: 4, borderRadius: "var(--v2-r-0)" }} />
              </div>

              {/* TM grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: "var(--v2-s-1)",
                  padding: "var(--v2-s-3)",
                  borderRadius: "var(--v2-r-2)",
                  background: "var(--v2-paper-2)",
                }}
              >
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} style={{ padding: "var(--v2-s-1) var(--v2-s-2)", background: "var(--v2-paper)", borderRadius: "var(--v2-r-1)" }}>
                    <div style={{ ...skeletonStyle, height: 10, width: "70%", marginBottom: 4, borderRadius: "var(--v2-r-0)" }} />
                    <div style={{ ...skeletonStyle, height: 14, width: "60%", borderRadius: "var(--v2-r-0)" }} />
                  </div>
                ))}
              </div>

              {/* actions */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--v2-s-2)" }}>
                <div style={{ ...skeletonStyle, height: 42, borderRadius: "var(--v2-r-2)" }} />
                <div style={{ ...skeletonStyle, height: 42, width: 110, borderRadius: "var(--v2-r-2)" }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
