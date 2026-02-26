import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";
import { ScreenTitleCard } from "@/components/ui/screen-title-card";

export default function WorkoutTodayIndexPage() {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <ScreenTitleCard title="오늘 운동" note="기본 흐름만 따라가면 바로 기록할 수 있습니다." />

      <section className="grid gap-2">
        <SectionHeader title="기본 흐름" description="운동 프로그램 선택 후 바로 기록을 시작하세요." />
        <BaseGroupedList ariaLabel="Workout primary flow">
          <NavigationRow
            href="/workout/today/log"
            label="운동 수행 후 기록"
            subtitle="1순위"
            description="세션 생성/수행/저장을 한 화면에서 완료합니다."
            leading={<RowIcon symbol="GO" tone="blue" />}
          />
          <NavigationRow
            href="/plans/manage"
            label="프로그램 선택/생성"
            subtitle="사전 준비"
            description="기존 플랜 선택 또는 새 플랜 생성 후 운동으로 이동합니다."
            leading={<RowIcon symbol="PL" tone="green" />}
          />
        </BaseGroupedList>
        <SectionFootnote>운동 추가는 로그 화면의 ‘+ 운동 추가’에서 바로 진행됩니다.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="고급 도구" description="기능 퇴보 없이 고급 제어 기능을 분리해 제공합니다." />
        <BaseGroupedList ariaLabel="Workout advanced tools">
          <NavigationRow
            href="/workout/today/overrides"
            label="세션 오버라이드"
            description="교체/보조 운동 규칙을 설정합니다."
            leading={<RowIcon symbol="OV" tone="orange" />}
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
        <SectionFootnote>고급 입력이 필요할 때만 하위 화면을 사용하세요.</SectionFootnote>
      </section>
    </div>
  );
}
