"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import { ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";
import {
  ApiHomeDataSource,
  HOME_PREVIEW_DATA,
  PreviewHomeDataSource,
  type HomeData,
  type HomeDataSource,
} from "@/lib/home/home-data-source";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

const HOME_PREVIEW_MODE = process.env.NEXT_PUBLIC_HOME_DATA_MODE === "preview";

const skeletonStyle: CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-2) 50%, var(--color-surface) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

function useHomeDataSource(): HomeDataSource {
  return useMemo(() => {
    if (HOME_PREVIEW_MODE) {
      return new PreviewHomeDataSource();
    }
    return new ApiHomeDataSource(3);
  }, []);
}

export default function HomePage() {
  const dataSource = useHomeDataSource();
  const [homeData, setHomeData] = useState<HomeData | null>(HOME_PREVIEW_MODE ? HOME_PREVIEW_DATA : null);
  const [loading, setLoading] = useState(!HOME_PREVIEW_MODE);
  const [error, setError] = useState<string | null>(null);

  const loadHomeData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const nextData = await dataSource.load();
      setHomeData(nextData);
    } catch (e: any) {
      setError(e?.message ?? "홈 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [dataSource]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: loadHomeData,
    triggerSelector: "[data-pull-refresh-trigger]",
  });

  useEffect(() => {
    if (HOME_PREVIEW_MODE) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await dataSource.load();
        if (!cancelled) setHomeData(nextData);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "홈 데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataSource]);

  const hasResolvedHomeData = HOME_PREVIEW_MODE || homeData !== null;
  const viewData = homeData;

  return (
    <div
      {...pullToRefresh.bind}
    >
      <PullToRefreshIndicator
        pullOffset={pullToRefresh.pullOffset}
        progress={pullToRefresh.progress}
        status={pullToRefresh.status}
      />
      {!hasResolvedHomeData ? (
        <>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              {/* 현재 프로그램 섹션 */}
              <section style={{ marginBottom: "var(--space-md)" }}>
                <div style={{ marginBottom: "var(--space-sm)" }}>
                  <div style={{ ...skeletonStyle, height: 20, width: "35%" }} />
                </div>
                <div className="card" style={{ padding: "var(--space-md)" }}>
                  <div style={{ ...skeletonStyle, height: 18, width: "55%", marginBottom: 6 }} />
                  <div style={{ ...skeletonStyle, height: 14, width: "40%", marginBottom: 12 }} />
                  <div style={{ ...skeletonStyle, height: 12, width: "65%", marginBottom: 16, borderRadius: 4 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "var(--space-xs)", textAlign: "center" }}>
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ ...skeletonStyle, height: 10, width: "100%", borderRadius: 4 }} />
                        <div style={{ ...skeletonStyle, height: 10, width: 10, borderRadius: "50%" }} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* 오늘의 운동 섹션 */}
              <section style={{ marginBottom: "var(--space-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--space-sm)" }}>
                  <div style={{ ...skeletonStyle, height: 20, width: "30%" }} />
                </div>
                <div className="card" style={{ padding: "var(--space-md)" }}>
                  <div style={{ ...skeletonStyle, height: 18, width: "45%", marginBottom: 12 }} />
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: 10, borderBottom: i === 0 ? "1px solid var(--color-border)" : "none" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ ...skeletonStyle, height: 15, width: "55%", marginBottom: 4 }} />
                        <div style={{ ...skeletonStyle, height: 12, width: "35%", borderRadius: 4 }} />
                      </div>
                      <div style={{ ...skeletonStyle, height: 12, width: 40, borderRadius: 4 }} />
                    </div>
                  ))}
                  <div style={{ ...skeletonStyle, height: 44, width: "100%", marginTop: 16, borderRadius: 10 }} />
                </div>
              </section>

              {/* 지난 세션 섹션 */}
              <section style={{ marginBottom: "var(--space-md)" }}>
                <div style={{ marginBottom: "var(--space-sm)" }}>
                  <div style={{ ...skeletonStyle, height: 20, width: "25%" }} />
                </div>
                <div className="card" style={{ padding: "var(--space-md)" }}>
                  <div style={{ ...skeletonStyle, height: 16, width: "40%", marginBottom: 12 }} />
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: 10, borderBottom: i === 0 ? "1px solid var(--color-border)" : "none" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ ...skeletonStyle, height: 15, width: "50%", marginBottom: 4 }} />
                        <div style={{ ...skeletonStyle, height: 12, width: "30%", borderRadius: 4 }} />
                      </div>
                      <div style={{ ...skeletonStyle, height: 12, width: 36, borderRadius: 4 }} />
                    </div>
                  ))}
                  <div style={{ ...skeletonStyle, height: 44, width: "100%", marginTop: 16, borderRadius: 10 }} />
                </div>
              </section>

              {/* 요약 통계 섹션 (QuickStats 모사) */}
              <section style={{ marginBottom: "var(--space-md)" }}>
                <div style={{ marginBottom: "var(--space-sm)" }}>
                  <div style={{ ...skeletonStyle, height: 20, width: "25%" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
                      <div style={{ ...skeletonStyle, height: 28, width: "60%", marginBottom: 4 }} />
                      <div style={{ ...skeletonStyle, height: 12, width: "50%", borderRadius: 4 }} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
          <ErrorStateRows
            message={error}
            onRetry={() => {
              void loadHomeData();
            }}
            retryLabel="다시 불러오기"
            ariaLabel="홈 오류 상태"
          />
        </>
      ) : (
        <>
          <LoadingStateRows
            active={loading}
            delayMs={180}
            label="홈 데이터 불러오는 중"
            description="오늘 요약과 최근 운동 요약을 조회하고 있습니다."
            ariaLabel="홈 로딩 상태"
          />
          <ErrorStateRows
            message={error}
            onRetry={() => {
              void loadHomeData();
            }}
            title="홈 데이터를 불러오지 못했습니다"
            retryLabel="다시 불러오기"
            ariaLabel="홈 오류 상태"
          />
          {!error && <HomeDashboard data={viewData ?? HOME_PREVIEW_DATA} />}
        </>
      )}
    </div>
  );
}
