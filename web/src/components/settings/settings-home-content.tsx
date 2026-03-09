"use client";

import { useRouter } from "next/navigation";
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator";
import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

const rows = [
  {
    href: "/settings/theme",
    label: "테마 설정",
    subtitle: "Theme",
    description: "라이트 / 다크 / 시스템 설정",
    symbol: "TM",
    tone: "blue" as const,
  },
  {
    href: "/settings/minimum-plate",
    label: "최소 원판 무게",
    subtitle: "Minimum Plate",
    description: "종목별 최소 원판 무게 설정",
    symbol: "PL",
    tone: "neutral" as const,
  },
  {
    href: "/settings/bodyweight",
    label: "몸무게 입력",
    subtitle: "Bodyweight",
    description: "몸무게 연관 종목 계산/표시에 사용",
    symbol: "BW",
    tone: "green" as const,
  },
  {
    href: "/settings/exercise-management",
    label: "운동종목 관리",
    subtitle: "Exercise Catalog",
    description: "운동종목 조회/추가/수정/삭제",
    symbol: "EX",
    tone: "orange" as const,
  },
  {
    href: "/settings/data",
    label: "데이터 관리",
    subtitle: "Data",
    description: "Export / 앱 데이터 초기화",
    symbol: "DT",
    tone: "tint" as const,
  },
  {
    href: "/settings/offline-help",
    label: "오프라인 도움말",
    subtitle: "Offline Help",
    description: "오프라인 동작 가이드",
    symbol: "HP",
    tone: "orange" as const,
  },
  {
    href: "/settings/about",
    label: "앱 정보",
    subtitle: "App Info",
    description: "버전 및 앱 정보",
    symbol: "AB",
    tone: "neutral" as const,
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
      className={`native-page native-page-enter tab-screen settings-screen settings-screen-main momentum-scroll ${className}`.trim()}
      {...pullToRefresh.bind}
    >
      <PullToRefreshIndicator
        pullOffset={pullToRefresh.pullOffset}
        progress={pullToRefresh.progress}
        status={pullToRefresh.status}
        refreshingLabel="설정 새로고침 중..."
        completeLabel="설정 다시 확인 완료"
      />
      <section className="grid gap-2">
        <div data-pull-refresh-trigger="true">
          <SectionHeader
            title="Settings"
            description="iOS Settings Form + Section 패턴으로 설정 항목을 구성합니다."
          />
        </div>
        <BaseGroupedList ariaLabel="Settings menu">
          {rows.map((row) => (
            <NavigationRow
              key={row.href}
              href={row.href}
              label={row.label}
              subtitle={row.subtitle}
              description={row.description}
              value="열기"
              leading={<RowIcon symbol={row.symbol} tone={row.tone} />}
            />
          ))}
        </BaseGroupedList>
        <SectionFootnote>모든 설정은 저장 즉시 반영되며, 실패 시 안내와 함께 이전 값으로 복구됩니다.</SectionFootnote>
      </section>
    </div>
  );
}
