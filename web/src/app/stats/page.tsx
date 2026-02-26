import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";
import { ScreenTitleCard } from "@/components/ui/screen-title-card";

export default function StatsIndexPage() {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <ScreenTitleCard title="통계" note="대시보드와 필터를 확인하세요." />

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
          <NavigationRow
            href="/stats/dashboard"
            label="UX 퍼널"
            description="전환 퍼널과 오늘/7일/14일 UX 스냅샷을 확인합니다."
            leading={<RowIcon symbol="UX" tone="tint" />}
          />
          <NavigationRow
            href="/stats/dashboard"
            label="운영 마이그레이션 상태"
            description="배포 마이그레이션 실행 상태와 최근 실패/락 타임아웃을 확인합니다."
            leading={<RowIcon symbol="OP" tone="neutral" />}
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
