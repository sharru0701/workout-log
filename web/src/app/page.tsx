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
import HomeLoading from "./loading";

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
          {loading && <HomeLoading />}
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
