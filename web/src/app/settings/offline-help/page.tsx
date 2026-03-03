import { BaseGroupedList, InfoRow, RowIcon, SectionFootnote, SectionHeader } from "@/components/ui/settings-list";

export default function SettingsOfflineHelpPage() {
  return (
    <div className="native-page native-page-enter tab-screen settings-screen momentum-scroll">
      <section className="grid gap-2">
        <SectionHeader title="C-5 오프라인 도움말" description="오프라인 상태에서도 기록이 유실되지 않도록 동작합니다." />
        <BaseGroupedList ariaLabel="Offline help summary">
          <InfoRow
            label="오프라인 기록 저장"
            description="운동 기록은 네트워크가 없어도 로컬 큐에 먼저 저장됩니다."
            leading={<RowIcon symbol="Q" tone="blue" />}
          />
          <InfoRow
            label="자동 동기화"
            description="온라인 복귀 시 백그라운드에서 서버 동기화를 자동으로 재시도합니다."
            leading={<RowIcon symbol="SY" tone="green" />}
          />
          <InfoRow
            label="동기화 실패 대응"
            description="반복 실패 시 C-4 Data Export로 백업 파일을 생성해 보관할 수 있습니다."
            leading={<RowIcon symbol="BK" tone="orange" />}
          />
        </BaseGroupedList>
        <SectionFootnote>이 화면은 오프라인에서도 열람 가능한 정적 도움말 계층입니다.</SectionFootnote>
      </section>
    </div>
  );
}
