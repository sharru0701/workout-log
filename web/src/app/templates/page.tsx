import {
  BaseGroupedList,
  NavigationRow,
  RowIcon,
  SectionFootnote,
  SectionHeader,
  ValueRow,
} from "@/components/ui/settings-list";
import { ScreenTitleCard } from "@/components/ui/screen-title-card";

export default function TemplatesIndexPage() {
  return (
    <div className="native-page native-page-enter tab-screen momentum-scroll">
      <ScreenTitleCard title="템플릿" note="템플릿 작업을 선택하세요." />

      <section className="grid gap-2">
        <SectionHeader title="라이브러리" />
        <BaseGroupedList ariaLabel="Template library">
          <NavigationRow
            href="/templates/manage"
            label="템플릿 워크스페이스"
            subtitle="기본"
            description="공개/개인 템플릿을 확인합니다."
            leading={<RowIcon symbol="TW" tone="green" />}
          />
          <NavigationRow
            href="/templates/manage"
            label="템플릿 포크"
            subtitle="흐름"
            description="공개 템플릿을 복사해 편집합니다."
            leading={<RowIcon symbol="FK" tone="tint" />}
          />
        </BaseGroupedList>
        <SectionFootnote>읽기 전용 템플릿은 먼저 포크한 뒤 수정하세요.</SectionFootnote>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="편집" />
        <BaseGroupedList ariaLabel="Template editing">
          <NavigationRow
            href="/templates/manage"
            label="템플릿 편집기"
            description="수동/로직 파라미터를 편집합니다."
            leading={<RowIcon symbol="ED" tone="blue" />}
          />
          <NavigationRow
            href="/templates/manage"
            label="버전 기록"
            description="버전 타임라인을 확인합니다."
            leading={<RowIcon symbol="VH" tone="neutral" />}
          />
          <ValueRow
            label="입력 방식"
            description="편집기는 하위 화면에서 동작합니다."
            value="Push"
            leading={<RowIcon symbol="IA" tone="neutral" />}
          />
        </BaseGroupedList>
        <SectionFootnote>편집 후에는 새 버전으로 저장하세요.</SectionFootnote>
      </section>
    </div>
  );
}
