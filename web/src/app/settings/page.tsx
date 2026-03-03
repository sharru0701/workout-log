import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";

const rows = [
  {
    href: "/settings/theme",
    label: "C-1 테마 설정",
    subtitle: "Theme",
    description: "라이트 / 다크 / 시스템 설정",
    symbol: "TM",
    tone: "blue" as const,
  },
  {
    href: "/settings/minimum-plate",
    label: "C-2 최소 원판 무게",
    subtitle: "Minimum Plate",
    description: "종목별 최소 원판 무게 설정",
    symbol: "PL",
    tone: "neutral" as const,
  },
  {
    href: "/settings/bodyweight",
    label: "C-3 몸무게 입력",
    subtitle: "Bodyweight",
    description: "몸무게 연관 종목 계산/표시에 사용",
    symbol: "BW",
    tone: "green" as const,
  },
  {
    href: "/settings/data-export",
    label: "C-4 데이터 Export",
    subtitle: "Data Export",
    description: "운동 데이터 내보내기",
    symbol: "EX",
    tone: "tint" as const,
  },
  {
    href: "/settings/offline-help",
    label: "C-5 오프라인 도움말",
    subtitle: "Offline Help",
    description: "오프라인 동작 가이드",
    symbol: "HP",
    tone: "orange" as const,
  },
  {
    href: "/settings/about",
    label: "C-6 앱 정보",
    subtitle: "App Info",
    description: "버전 및 앱 정보",
    symbol: "AB",
    tone: "neutral" as const,
  },
];

export default function SettingsPage() {
  return (
    <div className="native-page native-page-enter tab-screen settings-screen settings-screen-main momentum-scroll">
      <section className="grid gap-2">
        <SectionHeader
          title="C. Settings"
          description="iOS Settings Form + Section 패턴으로 설정 항목을 구성합니다."
        />
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
