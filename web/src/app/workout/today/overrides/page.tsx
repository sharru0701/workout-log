import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";

export default function WorkoutOverridesPage() {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">

      <section className="grid gap-2">
        <SectionHeader title="오버라이드 동작" />
        <BaseGroupedList ariaLabel="Session override actions">
          <NavigationRow
            href="/workout/today/log"
            label="보조 운동 고정"
            description="보조 운동 선택을 기본값으로 저장합니다."
            value="워크스페이스"
            leading={<RowIcon symbol="AP" tone="orange" />}
          />
          <NavigationRow
            href="/workout/today/log"
            label="운동 교체"
            description="세션 대상 운동을 다른 운동으로 바꿉니다."
            value="워크스페이스"
            leading={<RowIcon symbol="RE" tone="orange" />}
          />
          <ValueRow
            label="상호작용 방식"
            description="설정은 하위 화면에서 진행합니다."
            value="Push"
            leading={<RowIcon symbol="IA" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>세부 변경은 운동 로그 화면에서 이어서 진행하세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="돌아가기" />
        <BaseGroupedList ariaLabel="Session override return">
          <NavigationRow
            href="/workout/today/log"
            label="운동 로그로 돌아가기"
            description="이전 화면으로 돌아가 기록을 계속합니다."
            leading={<RowIcon symbol="BK" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>변경 내용은 세션 목록에서 바로 확인할 수 있습니다.</SectionFootnote>
      </section>
    </div>
  );
}
