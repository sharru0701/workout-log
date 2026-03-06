"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";
import {
  ApiHomeDataSource,
  HOME_PREVIEW_DATA,
  PreviewHomeDataSource,
  type HomeData,
  type HomeDataSource,
} from "@/lib/home/home-data-source";

const HOME_PREVIEW_MODE = process.env.NEXT_PUBLIC_HOME_DATA_MODE === "preview";

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

  if (!hasResolvedHomeData) {
    return (
      <div className="native-page native-page-enter home-screen momentum-scroll">
        <LoadingStateRows active={loading} delayMs={80} label="홈 데이터 불러오는 중" ariaLabel="홈 로딩 상태" />
        <ErrorStateRows
          message={error}
          onRetry={() => {
            void loadHomeData();
          }}
          retryLabel="다시 불러오기"
          ariaLabel="홈 오류 상태"
        />
      </div>
    );
  }

  const resolvedViewData = viewData ?? HOME_PREVIEW_DATA;

  return (
    <div className="native-page native-page-enter home-screen home-dashboard momentum-scroll">
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
      {!error && <HomeDashboard data={resolvedViewData} />}
    </div>
  );
}
