"use client";

import { useRouter } from "next/navigation";
import { DashboardSection } from "@/components/dashboard/dashboard-primitives";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import {
  BaseGroupedList,
  NavigationRow,
  SectionFootnote,
} from "@/components/ui/settings-list";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

const rows = [
  {
    href: "/settings/theme",
    label: "테마 설정",
    subtitle: "Theme",
    description: "라이트 / 다크 / 시스템 설정",
    symbol: "TM",
  },
  {
    href: "/settings/minimum-plate",
    label: "최소 원판 무게",
    subtitle: "Minimum Plate",
    description: "종목별 최소 원판 무게 설정",
    symbol: "PL",
  },
  {
    href: "/settings/bodyweight",
    label: "몸무게 입력",
    subtitle: "Bodyweight",
    description: "몸무게 연관 종목 계산/표시에 사용",
    symbol: "BW",
  },
  {
    href: "/settings/exercise-management",
    label: "운동종목 관리",
    subtitle: "Exercise Catalog",
    description: "운동종목 조회/추가/수정/삭제",
    symbol: "EX",
  },
  {
    href: "/settings/data",
    label: "데이터 관리",
    subtitle: "Data",
    description: "Export / 앱 데이터 초기화",
    symbol: "DT",
  },
  {
    href: "/settings/about",
    label: "앱 정보",
    subtitle: "App Info",
    description: "버전 및 앱 정보",
    symbol: "AB",
  },
];

export function SettingsHomeContent({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pullToRefresh = usePullToRefresh({
    onRefresh: () => {
      router.refresh();
    },
    triggerSelector: "[data-pull-refresh-trigger]",
  });

  return (
    <div
      {...pullToRefresh.bind}
      className={className || undefined}
    >
      <PullToRefreshIndicator
        pullOffset={pullToRefresh.pullOffset}
        progress={pullToRefresh.progress}
        status={pullToRefresh.status}
        refreshingLabel="설정 새로고침 중..."
        completeLabel="설정 다시 확인 완료"
      />
      <DashboardSection
        title="설정"
        description="앱 동작, 데이터, 기록 보조 설정을 관리합니다."
        headerTrigger
      >
        <BaseGroupedList ariaLabel="Settings menu">
          {rows.map((row) => (
            <NavigationRow
              key={row.href}
              href={row.href}
              label={row.label}
              subtitle={row.subtitle}
              description={row.description}
              value="열기"
            />
          ))}
        </BaseGroupedList>
        <SectionFootnote>모든 설정은 저장 즉시 반영되며, 실패 시 안내와 함께 이전 값으로 복구됩니다.</SectionFootnote>
      </DashboardSection>
    </div>
  );
}
