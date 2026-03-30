"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocale } from "@/components/locale-provider";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { PullToRefreshShell } from "@/components/pull-to-refresh-shell";
import { ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";
import {
  ApiHomeDataSource,
  PreviewHomeDataSource,
  getHomePreviewData,
  type HomeData,
  type HomeDataSource,
} from "@/lib/home/home-data-source";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

const HOME_PREVIEW_MODE = process.env.NEXT_PUBLIC_HOME_DATA_MODE === "preview";

const skeletonStyle: CSSProperties = {
  background: "linear-gradient(90deg, var(--color-surface-container) 0%, var(--color-surface-container-high) 50%, var(--color-surface-container) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease infinite",
  borderRadius: 8,
};

function useHomeDataSource(locale: "ko" | "en"): HomeDataSource {
  return useMemo(() => {
    if (HOME_PREVIEW_MODE) {
      return new PreviewHomeDataSource(getHomePreviewData(locale));
    }
    return new ApiHomeDataSource(3, locale);
  }, [locale]);
}

export default function HomePage() {
  const { copy, locale } = useLocale();
  const dataSource = useHomeDataSource(locale);
  const previewData = useMemo(() => getHomePreviewData(locale), [locale]);
  const [homeData, setHomeData] = useState<HomeData | null>(HOME_PREVIEW_MODE ? previewData : null);
  const [loading, setLoading] = useState(!HOME_PREVIEW_MODE);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const loadHomeData = useCallback(async (options?: { isRefresh?: boolean }) => {
    try {
      if (!hasLoadedRef.current && !options?.isRefresh) setLoading(true);
      setError(null);
      const nextData = await dataSource.load();
      hasLoadedRef.current = true;
      setHomeData(nextData);
    } catch (e: any) {
      setError(e?.message ?? copy.home.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.home.loadError, dataSource]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => loadHomeData({ isRefresh: true }),
  });

  useEffect(() => {
    if (!HOME_PREVIEW_MODE) return;
    setHomeData(previewData);
  }, [previewData]);

  useEffect(() => {
    if (HOME_PREVIEW_MODE) return;
    let cancelled = false;

    (async () => {
      try {
        if (!hasLoadedRef.current) setLoading(true);
        setError(null);
        const nextData = await dataSource.load();
        if (!cancelled) {
          hasLoadedRef.current = true;
          setHomeData(nextData);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? copy.home.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [copy.home.loadError, dataSource]);

  const hasResolvedHomeData = HOME_PREVIEW_MODE || homeData !== null;
  const viewData = homeData;

  return (
    <PullToRefreshShell pullToRefresh={pullToRefresh}>
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
            retryLabel={copy.home.retry}
            ariaLabel={copy.home.loadError}
          />
        </>
      ) : (
        <>
          <LoadingStateRows
            active={loading}
            delayMs={180}
            label={copy.home.loadingLabel}
            description={copy.home.loadingDescription}
            ariaLabel={copy.home.loadingLabel}
          />
          <ErrorStateRows
            message={error}
            onRetry={() => {
              void loadHomeData();
            }}
            title={copy.home.loadError}
            retryLabel={copy.home.retry}
            ariaLabel={copy.home.loadError}
          />
          {!error && <HomeDashboard data={viewData ?? previewData} />}
        </>
      )}
    </PullToRefreshShell>
  );
}
