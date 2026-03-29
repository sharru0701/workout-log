import type { CSSProperties } from "react";

// PERF: 스토어 라우트 loading.tsx - 라우트 전환 시 즉각 피드백
const skeletonStyle: CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

export default function ProgramStoreLoading() {
  return (
    <div>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Search Input Skeleton */}
      <div style={{ ...skeletonStyle, height: 48, borderRadius: 12, marginBottom: "var(--space-md)" }} />

      {/* 공식 프로그램 섹션 스켈레톤 */}
      <div>
        <div style={{ ...skeletonStyle, height: 22, width: "35%", marginBottom: "var(--space-sm)" }} />
        <div style={{ ...skeletonStyle, height: 14, width: "65%", borderRadius: 4, marginBottom: "var(--space-md)" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ padding: "var(--space-md)", borderRadius: "14px", background: "var(--color-surface-container-low)", border: "1px solid color-mix(in srgb, var(--color-outline-variant) 20%, transparent)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-xs)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
                    <div style={{ ...skeletonStyle, height: 18, width: "60%" }} />
                    <div style={{ ...skeletonStyle, height: 14, width: "20%", borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ ...skeletonStyle, height: 22, width: 44, borderRadius: 12 }} />
              </div>
              <div style={{ ...skeletonStyle, height: 14, width: "85%", marginBottom: "var(--space-sm)", borderRadius: 4 }} />
              <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} style={{ ...skeletonStyle, height: 22, width: 56, borderRadius: 12 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
