import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";

export default function StatsIndexPage() {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <header className="grid gap-1 px-1">
        <h1 className="type-title m-0">통계</h1>
        <p className="type-caption m-0">대시보드와 필터를 확인하세요.</p>
      </header>

      <section className="grid gap-2">
        <SectionHeader title="대시보드" />
        <BaseGroupedList ariaLabel="Stats dashboard">
          <NavigationRow
            href="/stats/dashboard"
            label="지표 대시보드"
            subtitle="기본"
            description="추세 요약을 확인합니다."
            leading={<RowIcon symbol="DB" tone="tint" />}
          />
          <NavigationRow
            href="/stats/filters"
            label="필터"
            subtitle="입력"
            description="플랜, 범위, 운동 조건을 설정합니다."
            leading={<RowIcon symbol="FL" tone="blue" />}
          />
        </BaseGroupedList>
        <SectionFootnote>필터에서 대시보드 범위를 좁혀 보세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="세부 지표" />
        <BaseGroupedList ariaLabel="Stats details">
          <NavigationRow
            href="/stats/dashboard"
            label="볼륨 상세"
            description="운동 볼륨 상세를 확인합니다."
            leading={<RowIcon symbol="VL" tone="blue" />}
          />
          <NavigationRow
            href="/stats/dashboard"
            label="플랜 준수율"
            description="완료율 상세를 확인합니다."
            leading={<RowIcon symbol="CP" tone="green" />}
          />
          <NavigationRow
            href="/stats/dashboard"
            label="PR 추적"
            description="PR 기록 상세를 확인합니다."
            leading={<RowIcon symbol="PR" tone="orange" />}
          />
          <ValueRow
            label="필터 입력 방식"
            description="입력은 하위 화면에서 처리합니다."
            value="Push"
            leading={<RowIcon symbol="IA" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>상세 표는 대시보드 화면에서 확인할 수 있습니다.</SectionFootnote>
      </section>
    </div>
  );
}
