import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
} from "@/components/ui/settings-list";
import { ScreenTitleCard } from "@/components/ui/screen-title-card";
import { SettingsSearchPanel } from "@/components/ui/settings-search-panel";
import { settingsSearchIndex } from "@/lib/settings/settings-search-index";

const quickStartRows = [
  {
    href: "/workout/today/log",
    label: "오늘 운동 시작",
    subtitle: "1순위",
    description: "세션 생성부터 기록/저장을 한 화면에서 바로 진행합니다.",
    symbol: "GO",
    tone: "blue" as const,
  },
  {
    href: "/plans/manage?create=1&type=SINGLE",
    label: "커스텀 프로그램 만들기",
    subtitle: "새 프로그램",
    description: "생성 시트를 바로 열어 플랜을 만든 뒤 운동으로 이동합니다.",
    symbol: "CP",
    tone: "green" as const,
  },
  {
    href: "/plans/manage",
    label: "프로그램 선택 후 시작",
    subtitle: "플로우",
    description: "이미 만든 플랜을 선택해 빠르게 세션을 시작합니다.",
    symbol: "PL",
    tone: "green" as const,
  },
] as const;

const advancedRows = [
  {
    href: "/calendar",
    label: "운동 캘린더",
    subtitle: "날짜 기반",
    description: "특정 날짜 세션을 열어 생성/진행합니다.",
    symbol: "CA",
    tone: "blue" as const,
  },
  {
    href: "/templates/manage",
    label: "템플릿 워크스페이스",
    subtitle: "고급 편집",
    description: "템플릿/버전/포크를 관리합니다.",
    symbol: "TP",
    tone: "green" as const,
  },
  {
    href: "/stats",
    label: "통계 대시보드",
    subtitle: "분석",
    description: "e1RM/볼륨/준수율 지표를 확인합니다.",
    symbol: "ST",
    tone: "tint" as const,
  },
  {
    href: "/settings",
    label: "앱 설정",
    subtitle: "시스템",
    description: "저장 정책/링크/데이터 옵션을 조정합니다.",
    symbol: "SE",
    tone: "neutral" as const,
  },
] as const;

export default function Home() {
  return (
    <div className="native-page native-page-enter home-screen momentum-scroll">
      <ScreenTitleCard title="운동 기록 시작" note="화면 탐색 없이 아래 순서대로 진행하세요." />

      <section className="grid gap-2">
        <SectionHeader title="빠른 시작" description="운동 앱의 핵심 흐름만 먼저 노출합니다." />
        <BaseGroupedList ariaLabel="Quick start actions">
          {quickStartRows.map((row) => (
            <NavigationRow
              key={row.href}
              href={row.href}
              label={row.label}
              subtitle={row.subtitle}
              description={row.description}
              leading={<RowIcon symbol={row.symbol} tone={row.tone} />}
            />
          ))}
        </BaseGroupedList>
        <SectionFootnote>권장 순서: 프로그램 준비 후 오늘 운동 시작.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="고급 도구" description="기능 축소 없이 세부 도구는 여기서 접근합니다." />
        <BaseGroupedList ariaLabel="Advanced tools">
          {advancedRows.map((row) => (
            <NavigationRow
              key={row.href}
              href={row.href}
              label={row.label}
              subtitle={row.subtitle}
              description={row.description}
              leading={<RowIcon symbol={row.symbol} tone={row.tone} />}
            />
          ))}
        </BaseGroupedList>
        <SectionFootnote>고급 편집/분석/설정 기능은 그대로 유지됩니다.</SectionFootnote>
      </section>

      <SettingsSearchPanel index={settingsSearchIndex} />
    </div>
  );
}
