"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";
import { EmptyStateRows, ErrorStateRows, LoadingStateRows } from "@/components/ui/settings-state";
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
      setError(e?.message ?? "Home 데이터를 불러오지 못했습니다.");
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
        if (!cancelled) setError(e?.message ?? "Home 데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataSource]);

  const viewData = homeData ?? HOME_PREVIEW_DATA;
  const showRecentEmpty = !loading && !error && viewData.recentSessions.length === 0;

  return (
    <div className="native-page native-page-enter home-screen momentum-scroll">
      <LoadingStateRows
        active={loading}
        delayMs={180}
        label="Home 데이터 불러오는 중"
        description="오늘 요약과 최근 운동 요약을 조회하고 있습니다."
        ariaLabel="Home loading state"
      />
      <ErrorStateRows
        message={error}
        onRetry={() => {
          void loadHomeData();
        }}
        title="Home 데이터를 불러오지 못했습니다"
        retryLabel="다시 불러오기"
        ariaLabel="Home error state"
      />

      <section className="grid gap-2">
        <SectionHeader
          title="오늘의 운동 요약"
          description="탭하면 Workout Record의 오늘 컨텍스트로 이동합니다."
        />
        <BaseGroupedList ariaLabel="Today workout summary">
          <NavigationRow
            href={viewData.today.href}
            label={viewData.today.headline}
            subtitle={viewData.today.programName}
            description={viewData.today.meta}
            value="기록하기"
            leading={<RowIcon symbol="TD" tone="blue" />}
          />
          <ValueRow
            label="완료 세트"
            description="오늘 완료한 총 세트 수"
            value={`${viewData.today.completedSets}세트`}
            showChevron={false}
            leading={<RowIcon symbol="ST" tone="green" />}
          />
          <ValueRow
            label="예상 e1RM"
            description="오늘 기록 기반 추정값"
            value={viewData.today.estimatedE1rmKg === null ? "-" : `${Math.round(viewData.today.estimatedE1rmKg)}kg`}
            showChevron={false}
            leading={<RowIcon symbol="RM" tone="tint" />}
          />
        </BaseGroupedList>
        <SectionFootnote>오늘 기록이 없어도 동일한 진입점으로 바로 시작할 수 있습니다.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="프로그램 스토어 진입" description="프로그램 탐색/선택/커스터마이징 진입 CTA" />
        <BaseGroupedList ariaLabel="Program store entry">
          <NavigationRow
            href="/program-store"
            label="프로그램 스토어 열기"
            subtitle="Program Store"
            description="시중 프로그램 + 사용자 커스터마이징 프로그램을 한 화면에서 확인합니다."
            value="열기"
            leading={<RowIcon symbol="PS" tone="tint" />}
          />
        </BaseGroupedList>
      </section>

      <section className="grid gap-2">
        <SectionHeader
          title={`지난 운동 요약 (최근 ${viewData.recentLimit}개)`}
          description="가장 최근 완료한 세션 요약 목록"
        />

        <EmptyStateRows
          when={showRecentEmpty}
          label="지난 운동 기록이 없습니다"
          description="첫 운동 기록을 저장하면 최근 요약이 여기에 표시됩니다."
          ariaLabel="Recent workout empty state"
        />

        {!showRecentEmpty && (
          <BaseGroupedList ariaLabel="Recent workout summaries">
            {viewData.recentSessions.map((session) => (
              <NavigationRow
                key={session.id}
                href={session.href}
                label={session.title}
                subtitle={session.subtitle}
                description={session.description}
                value="열기"
                leading={<RowIcon symbol="RC" tone="neutral" />}
              />
            ))}
          </BaseGroupedList>
        )}

        <SectionFootnote>최근 세션은 최신 순으로 노출됩니다.</SectionFootnote>
      </section>
    </div>
  );
}
