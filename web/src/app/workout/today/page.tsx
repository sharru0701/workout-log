import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";

export default function WorkoutTodayIndexPage() {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <header className="grid gap-1 px-1">
        <h1 className="type-title m-0">오늘 운동</h1>
        <p className="type-caption m-0">오늘 세션을 열고 세트를 기록합니다.</p>
      </header>

      <section className="grid gap-2">
        <SectionHeader title="세션" />
        <BaseGroupedList ariaLabel="Workout session actions">
          <NavigationRow
            href="/workout/today/log"
            label="운동 로그"
            subtitle="기본"
            description="생성, 기록, 저장을 한 화면에서 진행합니다."
            leading={<RowIcon symbol="WL" tone="blue" />}
          />
          <NavigationRow
            href="/workout/today/overrides"
            label="세션 오버라이드"
            description="교체/보조 운동 규칙을 설정합니다."
            leading={<RowIcon symbol="OV" tone="orange" />}
          />
          <NavigationRow
            href="/workout/session"
            label="세션 기록"
            description="저장한 세션 내역을 확인합니다."
            disabled
            value="준비 중"
            leading={<RowIcon symbol="HS" tone="neutral" />}
            badge="!"
            badgeTone="warning"
          />
        </BaseGroupedList>
        <SectionFootnote>일일 기록은 운동 로그에서 시작하세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="컨텍스트" />
        <BaseGroupedList ariaLabel="Workout context settings">
          <NavigationRow
            href="/plans/manage"
            label="플랜 선택"
            description="현재 사용할 플랜을 고릅니다."
            leading={<RowIcon symbol="PL" tone="neutral" />}
          />
          <NavigationRow
            href="/calendar/manage"
            label="날짜 기준 세션"
            description="선택한 날짜 기준으로 세션을 생성합니다."
            leading={<RowIcon symbol="CA" tone="blue" />}
          />
          <ValueRow
            label="내비게이션 방식"
            description="입력은 하위 화면에서 처리합니다."
            value="Push"
            leading={<RowIcon symbol="IA" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>생성 전에 플랜 컨텍스트를 먼저 맞추세요.</SectionFootnote>
      </section>
    </div>
  );
}
