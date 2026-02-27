import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";

export default function CalendarIndexPage() {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">

      <section className="grid gap-2">
        <SectionHeader title="세션 캘린더" />
        <BaseGroupedList ariaLabel="Calendar session actions">
          <NavigationRow
            href="/calendar/manage"
            label="캘린더 워크스페이스"
            subtitle="기본"
            description="월/주 보기로 세션 일정을 확인합니다."
            leading={<RowIcon symbol="CW" tone="blue" />}
          />
          <NavigationRow
            href="/calendar/options"
            label="캘린더 옵션"
            subtitle="입력"
            description="보기 방식과 열기 동작을 설정합니다."
            leading={<RowIcon symbol="CO" tone="tint" />}
          />
        </BaseGroupedList>
        <SectionFootnote>기본값은 옵션 화면에서 변경하세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="연동" />
        <BaseGroupedList ariaLabel="Calendar integration">
          <NavigationRow
            href="/workout/today"
            label="오늘 운동 열기"
            description="오늘 세션 흐름으로 바로 이동합니다."
            leading={<RowIcon symbol="TD" tone="blue" />}
          />
          <NavigationRow
            href="/plans"
            label="플랜 선택"
            description="먼저 플랜 컨텍스트를 선택합니다."
            leading={<RowIcon symbol="PL" tone="neutral" />}
          />
          <ValueRow
            label="내비게이션 방식"
            description="입력은 하위 화면으로 이동해 처리합니다."
            value="Push"
            leading={<RowIcon symbol="IA" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>캘린더에서 생성하기 전 플랜 컨텍스트를 확인하세요.</SectionFootnote>
      </section>
    </div>
  );
}
