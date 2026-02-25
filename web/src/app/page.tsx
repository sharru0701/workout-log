import {
  BaseGroupedList,
  InfoRow,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";
import { SettingsSearchPanel } from "@/components/ui/settings-search-panel";
import { settingsSearchIndex } from "@/lib/settings/settings-search-index";

const trainingRows = [
  {
    href: "/workout/today",
    label: "오늘 운동",
    subtitle: "세션",
    description: "오늘 세션을 시작하고 기록을 저장합니다.",
    symbol: "TW",
    tone: "blue" as const,
  },
  {
    href: "/calendar",
    label: "운동 캘린더",
    subtitle: "계획",
    description: "날짜를 열어 해당 세션을 진행합니다.",
    symbol: "CA",
    tone: "blue" as const,
  },
] as const;

const programRows = [
  {
    href: "/plans",
    label: "플랜",
    subtitle: "프로그램",
    description: "플랜을 만들고 활성 컨텍스트를 설정합니다.",
    symbol: "PL",
    tone: "green" as const,
  },
  {
    href: "/templates",
    label: "템플릿",
    subtitle: "소스",
    description: "템플릿과 버전 분기를 관리합니다.",
    symbol: "TP",
    tone: "green" as const,
  },
] as const;

const insightRows = [
  {
    href: "/stats",
    label: "통계 대시보드",
    subtitle: "인사이트",
    description: "추세와 PR 요약을 확인합니다.",
    symbol: "ST",
    tone: "tint" as const,
  },
] as const;

const systemRows = [
  {
    href: "/settings",
    label: "앱 설정",
    subtitle: "시스템",
    description: "앱 전역 설정을 확인합니다.",
    symbol: "SE",
    tone: "neutral" as const,
  },
  {
    href: "/settings/data",
    label: "데이터 내보내기",
    subtitle: "백업",
    description: "JSON 또는 CSV 파일을 내려받습니다.",
    symbol: "EX",
    tone: "neutral" as const,
  },
  {
    href: "/offline",
    label: "오프라인 도움말",
    subtitle: "복구",
    description: "오프라인 저장과 복구 흐름을 확인합니다.",
    symbol: "OF",
    tone: "orange" as const,
  },
] as const;

export default function Home() {
  return (
    <div className="native-page native-page-enter home-screen momentum-scroll">
      <p className="type-caption m-0 px-1">카테고리를 선택해 계속 진행하세요.</p>

      <SettingsSearchPanel index={settingsSearchIndex} />

      <section className="grid gap-2">
        <SectionHeader title="훈련" />
        <BaseGroupedList ariaLabel="Training category">
          {trainingRows.map((row) => (
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
        <SectionFootnote>오늘 운동 또는 캘린더에서 시작하세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="프로그램" />
        <BaseGroupedList ariaLabel="Programs category">
          {programRows.map((row) => (
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
        <SectionFootnote>플랜을 만들거나 템플릿 소스를 관리하세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="분석" />
        <BaseGroupedList ariaLabel="Insights category">
          {insightRows.map((row) => (
            <NavigationRow
              key={row.href}
              href={row.href}
              label={row.label}
              subtitle={row.subtitle}
              description={row.description}
              leading={<RowIcon symbol={row.symbol} tone={row.tone} />}
            />
          ))}
          <ValueRow
            label="기본 분석 범위"
            value="90일"
            description="필터 화면에서 변경할 수 있습니다."
            leading={<RowIcon symbol="DR" tone="tint" />}
          />
        </BaseGroupedList>
        <SectionFootnote>필터에서 범위를 조정하세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="시스템" />
        <BaseGroupedList ariaLabel="System category">
          {systemRows.map((row) => (
            <NavigationRow
              key={row.href}
              href={row.href}
              label={row.label}
              subtitle={row.subtitle}
              description={row.description}
              leading={<RowIcon symbol={row.symbol} tone={row.tone} />}
            />
          ))}
          <InfoRow
            label="내비게이션 방식"
            description="설정 상세는 Push 화면으로 열립니다."
            value="Push"
            leading={<RowIcon symbol="IA" tone="neutral" />}
            tone="neutral"
          />
        </BaseGroupedList>
        <SectionFootnote>필요할 때 데이터 내보내기와 오프라인 도구를 사용하세요.</SectionFootnote>
      </section>
    </div>
  );
}
