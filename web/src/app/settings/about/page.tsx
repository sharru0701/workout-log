import pkg from "../../../../package.json";
import { BaseGroupedList, InfoRow, RowIcon, SectionFootnote, SectionHeader, ValueRow } from "@/components/ui/settings-list";

export default function SettingsAboutPage() {
  return (
    <div className="native-page native-page-enter tab-screen settings-screen momentum-scroll">
      <section className="grid gap-2">
        <SectionHeader title="앱 정보" description="표준 About 정보 계층" />
        <BaseGroupedList ariaLabel="App information">
          <ValueRow
            label="앱 이름"
            description="Product"
            value="Workout Log"
            showChevron={false}
            leading={<RowIcon symbol="AP" tone="neutral" />}
          />
          <ValueRow
            label="버전"
            description="Version"
            value={pkg.version}
            showChevron={false}
            leading={<RowIcon symbol="V" tone="blue" />}
          />
          <ValueRow
            label="플랫폼"
            description="Runtime"
            value="Next.js PWA"
            showChevron={false}
            leading={<RowIcon symbol="NW" tone="tint" />}
          />
          <InfoRow
            label="지원 정보"
            description="문의/버그 리포트는 프로젝트 저장소 이슈 채널을 사용하세요."
            leading={<RowIcon symbol="?" tone="orange" />}
          />
        </BaseGroupedList>
        <SectionFootnote>About 화면은 오프라인에서도 기본 정보를 확인할 수 있습니다.</SectionFootnote>
      </section>
    </div>
  );
}
