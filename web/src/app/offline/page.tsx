import {
  BaseGroupedList,
  InfoRow,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";
import { ScreenTitleCard } from "@/components/ui/screen-title-card";

export default function OfflinePage() {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <ScreenTitleCard title="오프라인" note="오프라인 복구 동작을 확인합니다." />

      <section className="grid gap-2">
        <SectionHeader title="복구" />
        <BaseGroupedList ariaLabel="Offline recovery">
          <NavigationRow
            href="/workout/today/log"
            label="운동 로그 열기"
            description="지금 기록하고 로컬 대기열에 저장합니다."
            leading={<RowIcon symbol="WL" tone="blue" />}
          />
          <NavigationRow
            href="/settings/data"
            label="로컬 데이터 내보내기"
            description="재연결 전에 백업 파일을 만듭니다."
            leading={<RowIcon symbol="EX" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>동기화가 실패하면 먼저 내보낸 뒤 온라인에서 다시 시도하세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="상태" />
        <BaseGroupedList ariaLabel="Offline status">
          <ValueRow
            label="동기화 동작"
            description="대기 중인 로그를 자동으로 전송합니다."
            value="자동"
            leading={<RowIcon symbol="SY" tone="green" />}
          />
          <InfoRow
            label="모드"
            description="핵심 화면은 오프라인에서도 사용 가능합니다."
            value="지원됨"
            leading={<RowIcon symbol="OK" tone="green" />}
            tone="success"
          />
        </BaseGroupedList>
        <SectionFootnote>재연결하면 대기 로그가 순서대로 전송됩니다.</SectionFootnote>
      </section>
    </div>
  );
}
